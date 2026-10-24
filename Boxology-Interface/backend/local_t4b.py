"""Fully offline inference for the T4B LoRA fine-tunes of Llama-3.2-1B-Instruct.

Runs entirely in-process via llama.cpp (llama-cpp-python): no network call, no API key.
The base model and adapters are kept out of the (OneDrive-synced) repo tree at runtime -
they're cached under a stable local directory so the server/this machine always reads
from fast, non-synced local disk.
"""

import os
# HTTP downloads resume reliably on Windows; Xet can stall before writing bytes.
# Explicit operator settings still take precedence.
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")
import shutil
import threading
from pathlib import Path

from fastapi import HTTPException
from boxology_contract import PLAN_SCHEMA

REPO_ADAPTERS_DIR = Path(__file__).parent / "local_t4b" / "adapters"

BASE_MODEL_REPO = "bartowski/Llama-3.2-1B-Instruct-GGUF"
BASE_MODEL_FILENAME = "Llama-3.2-1B-Instruct-Q4_K_M.gguf"

LOCAL_VARIANTS = {
    "local-diagram-builder": {
        "name": "Qwen2.5-7B diagram builder",
        "adapter_filename": None,
    },
    "local-planner": {
        "name": "Qwen2.5-7B diagram builder (no advisor)",
        "adapter_filename": None,
    },
    "local-baseline": {
        "name": "T4B LLaMA-3.2-1B (baseline)",
        "adapter_filename": "baseline.gguf",
    },
    "local-cot2": {
        "name": "T4B LLaMA-3.2-1B (rules + CoT2)",
        "adapter_filename": "cot2.gguf",
    },
    "local-cot3": {
        "name": "T4B LLaMA-3.2-1B (rules + CoT3)",
        "adapter_filename": "cot3.gguf",
    },
}

N_CTX = int(os.getenv("T4B_LOCAL_N_CTX") or "16384")
# CPU-only by default: matches typical GPU-less servers and the small (2 GB) dev GPU,
# which is too tight for this model's KV cache at useful context lengths once other
# processes hold VRAM. Set T4B_LOCAL_N_GPU_LAYERS to opt into GPU offload.
N_GPU_LAYERS = int(os.getenv("T4B_LOCAL_N_GPU_LAYERS", "0"))

_lock = threading.RLock()
_llama_cache: dict = {}


def _cache_dir() -> Path:
    override = os.getenv("T4B_LOCAL_CACHE_DIR")
    if override:
        return Path(override)
    local_appdata = os.getenv("LOCALAPPDATA")
    if local_appdata:
        # Keeps large/frequently-touched model files out of any OneDrive-style synced
        # folder the repo might live under, which otherwise causes intermittent
        # file-visibility stalls for large binaries.
        return Path(local_appdata) / "T4B-LocalLLM"
    return Path.home() / ".cache" / "t4b_local_llm"


def _ensure_base_model() -> Path:
    models_dir = _cache_dir() / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    target = models_dir / BASE_MODEL_FILENAME
    if target.exists():
        return target
    try:
        from huggingface_hub import hf_hub_download
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail="huggingface_hub is required to fetch the local T4B base model on first use.",
        ) from e
    print(f"[local_t4b] Downloading base model {BASE_MODEL_REPO}/{BASE_MODEL_FILENAME} (~800MB, one-time)...")
    downloaded = hf_hub_download(
        repo_id=BASE_MODEL_REPO,
        filename=BASE_MODEL_FILENAME,
        local_dir=str(models_dir),
    )
    return Path(downloaded)


def _ensure_adapter(variant_id: str) -> Path | None:
    variant = LOCAL_VARIANTS.get(variant_id)
    if not variant:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown local model '{variant_id}'. Choose one of: {', '.join(LOCAL_VARIANTS)}",
        )
    if not variant["adapter_filename"]:
        return None
    adapters_dir = _cache_dir() / "adapters"
    adapters_dir.mkdir(parents=True, exist_ok=True)
    target = adapters_dir / variant["adapter_filename"]
    source = Path(os.getenv("T4B_LOCAL_ADAPTERS_DIR") or REPO_ADAPTERS_DIR) / variant["adapter_filename"]
    if not source.exists():
        raise HTTPException(status_code=500, detail=f"Missing adapter source file for '{variant_id}': {source}")
    if (not target.exists() or source.stat().st_size != target.stat().st_size
            or source.stat().st_mtime_ns != target.stat().st_mtime_ns):
        shutil.copy2(str(source), str(target))
    return target


def _ensure_builder_model() -> Path:
    override = os.getenv("T4B_LOCAL_BUILDER_PATH")
    if override:
        path = Path(override)
        if not path.is_file():
            raise HTTPException(status_code=503, detail=f"Local diagram builder not found: {path}")
        return path
    filename = "Qwen2.5-7B-Instruct-Q4_K_M.gguf"
    directory = _cache_dir() / "models"
    target = directory / filename
    if target.exists():
        return target
    from huggingface_hub import hf_hub_download
    return Path(hf_hub_download(repo_id="bartowski/Qwen2.5-7B-Instruct-GGUF",
                                filename=filename, local_dir=str(directory)))


def _get_llama(variant_id: str):
    with _lock:
        if variant_id not in LOCAL_VARIANTS:
            raise HTTPException(status_code=400, detail=f"Unknown local model '{variant_id}'")
        if variant_id in _llama_cache:
            return _llama_cache[variant_id]

        from llama_cpp import Llama

        # One resident model bounds memory and prevents different adapters sharing state.
        for cached in _llama_cache.values():
            cached.close()
        _llama_cache.clear()
        base_path = (_ensure_builder_model() if variant_id in {"local-planner", "local-diagram-builder"}
                     else _ensure_base_model())
        adapter_path = _ensure_adapter(variant_id)

        adapter_name = adapter_path.name if adapter_path else "none (instruction planner)"
        print(f"[local_t4b] Loading {variant_id} (base={base_path.name}, adapter={adapter_name})...")
        load_args = {
            "model_path": str(base_path),
            "n_ctx": N_CTX,
            "n_gpu_layers": N_GPU_LAYERS,
            "verbose": False,
        }
        if adapter_path:
            load_args["lora_path"] = str(adapter_path)
        llama = Llama(**load_args)
        _llama_cache[variant_id] = llama
        return llama


def ensure_local_ready(variant_id: str) -> str:
    """Warm up (download + load) the requested variant; raises HTTPException on failure."""
    _get_llama(variant_id)
    return "Local model loaded and ready. Runs fully offline on this machine - no API key or network call needed."


def chat_local(variant_id: str, messages: list, max_tokens: int, temperature: float = 0.0,
               structured_json: bool = False, response_schema: dict | None = None) -> str:
    # llama.cpp contexts are mutable and cannot service simultaneous completions.
    with _lock:
        llama = _get_llama(variant_id)
        options = {"response_format": {"type": "json_object", "schema": response_schema or PLAN_SCHEMA},
                   "repeat_penalty": 1.0} if structured_json else {}
        try:
            chunks = llama.create_chat_completion(
                messages=messages, max_tokens=max_tokens, temperature=temperature, stream=True, **options,
            )
            content, finish_reason, next_progress = "", None, 4000
            for chunk in chunks:
                choice = (chunk.get("choices") or [{}])[0]
                content += choice.get("delta", {}).get("content") or ""
                finish_reason = choice.get("finish_reason") or finish_reason
                if len(content) >= next_progress:
                    print(f"[local_t4b] {variant_id}: generated {len(content)} characters...", flush=True)
                    next_progress += 4000
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"Local generation failed: {exc}") from exc
    if finish_reason == "length" and structured_json:
        raise HTTPException(status_code=502, detail="Local plan was truncated. Increase T4B_LOCAL_N_CTX and the generation token budget.")
    return content.strip()


def repair_json_locally(variant_id: str, malformed_json_text: str, parse_error: str) -> str:
    repair_prompt = (
        "Repair the following malformed Tool4Boxology JSON. Return only one valid JSON object. "
        "Do not add Markdown, comments, or explanation. Preserve the intended nodes, links, "
        "groups, labels, and modelData. Fix missing commas, trailing commas, quote issues, "
        "unclosed arrays, and unclosed objects.\n\n"
        f"Parser error:\n{parse_error}\n\n"
        f"Malformed JSON:\n{malformed_json_text}"
    )
    return chat_local(
        variant_id,
        [
            {"role": "system", "content": "You are a strict JSON repair tool. Return valid JSON only."},
            {"role": "user", "content": repair_prompt},
        ],
        max_tokens=2048,
        temperature=0,
    )
