"""T4B adapter inference on Modal GPU with schema-constrained architecture output.

Deploy from Boxology-Interface: modal deploy modal_app/serve.py
Set MODAL_T4B_CHAT_URL and MODAL_T4B_HEALTH_URL on the backend to the printed URLs.
Secrets: t4b-llama-hf-token (HF_TOKEN), t4b-llama-api-key (T4B_MODAL_API_KEY).
T4B_ADAPTERS_DIR optionally selects architecture-trained PEFT directories at deploy time.
Each variant has its own merged weights; no adapter switching or compiled graph reuse.
"""

from pathlib import Path
import os

import modal
from fastapi import Request

REPO_ROOT = Path(__file__).resolve().parent.parent  # .../Boxology-Interface
ADAPTERS_SRC = Path(os.getenv("T4B_ADAPTERS_DIR") or REPO_ROOT / "T4B-LLM" / "T4B_cloudrift")

BASE_MODEL = "meta-llama/Llama-3.2-1B-Instruct"

# variant id (as used by the Boxology-Interface "modal" provider) -> (adapter dir
# name on disk, in-container adapter path, PEFT adapter_name)
VARIANTS: dict[str, str | None] = {
    # Preserve the selected adapter identity. T4B_ADAPTERS_DIR can point to
    # architecture-trained versions; the original checkpoints classify entailment.
    "modal-planner": None,
    "modal-baseline": "finetuned_LLaMA_3.2_1B_baseline",
    "modal-cot2": "finetuned_LLaMA_3.2_1B_with_rules_CoT2",
    "modal-cot3": "finetuned_LLaMA_3.2_1B_with_rules_CoT3",
}
ADAPTER_CONTAINER_DIR = "/adapters"

app = modal.App("t4b-llama-adapters")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch>=2.1.0",
        "transformers==4.57.6",
        "peft>=0.18.0,<0.22",
        "lm-format-enforcer==0.11.3",
        "accelerate",
        "fastapi",
        "huggingface_hub",
    )
)
image = image.add_local_file(str(REPO_ROOT / "backend/boxology_contract.py"), "/root/boxology_contract.py", copy=True)
for variant_id, dirname in VARIANTS.items():
    if dirname is None:
        continue
    image = image.add_local_dir(
        str(ADAPTERS_SRC / dirname),
        f"{ADAPTER_CONTAINER_DIR}/{dirname}",
        copy=True,
        # Only the adapter weights/config are needed on the GPU container, not the
        # training checkpoints/eval artifacts that live alongside them on disk.
        ignore=lambda p: "checkpoint-" in str(p),
    )

hf_secret = modal.Secret.from_name("t4b-llama-hf-token", required_keys=["HF_TOKEN"])
api_key_secret = modal.Secret.from_name("t4b-llama-api-key", required_keys=["T4B_MODAL_API_KEY"])


@app.cls(
    image=image,
    gpu="T4",
    secrets=[hf_secret, api_key_secret],
    scaledown_window=300,  # scale to zero 5 min after the last request
    timeout=600,
    min_containers=0,
)
class T4BLlama:
    @modal.enter()
    def load(self):
        import os

        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        from peft import PeftModel

        token = os.environ["HF_TOKEN"]

        print(f"Loading tokenizer {BASE_MODEL} ...")
        self.tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, token=token)

        self.models = {}
        for variant_id, dirname in VARIANTS.items():
            print(f"Loading base model for '{variant_id}' ...")
            base = AutoModelForCausalLM.from_pretrained(
                BASE_MODEL,
                dtype=torch.float16,
                device_map="cuda",
                token=token,
                attn_implementation="sdpa",
            )
            merged = (
                PeftModel.from_pretrained(base, f"{ADAPTER_CONTAINER_DIR}/{dirname}").merge_and_unload()
                if dirname is not None
                else base
            )
            merged.eval()
            # Eager dynamic cache avoids implicit compilation on the first
            # request and keeps cold-start latency within the backend timeout.
            merged.generation_config.cache_implementation = "dynamic"
            merged.generation_config.disable_compile = True
            self.models[variant_id] = merged

        print(
            "Ready. cuda_available=", torch.cuda.is_available(),
            "gpu_name=", torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        )

    def _generate(
        self,
        variant_id: str,
        messages: list,
        max_tokens: int,
        temperature: float,
        structured_json: bool = False,
    ) -> str:
        import torch

        if variant_id not in self.models:
            raise ValueError(f"Unknown variant '{variant_id}'. Choose one of: {', '.join(VARIANTS)}")

        model = self.models[variant_id]

        # All variants use eager execution so compilation does not consume the
        # cold-start generation budget.

        prompt = self.tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True,
        )
        # The template already includes BOS/EOT. Adding BOS again changes inference.
        inputs = self.tokenizer(prompt, return_tensors="pt", add_special_tokens=False).to(model.device)
        if inputs["input_ids"].shape[1] + max_tokens > 16384:
            raise ValueError("Prompt plus output exceeds the service's 16384-token context budget.")

        generation_args = {
            **inputs,
            "max_new_tokens": max_tokens,
            "do_sample": temperature > 0,
            "temperature": temperature if temperature > 0 else None,
            "pad_token_id": self.tokenizer.eos_token_id,
            # Structured JSON necessarily repeats field-name token sequences
            # ("key", "name", "type", ...). A no-repeat n-gram constraint makes
            # a complete architecture plan impossible, so JSON mode uses only a
            # light repetition penalty. General chat retains the stronger loop
            # protection used for these small legacy adapters.
            "repetition_penalty": 1.0 if structured_json else 1.15,
        }
        if structured_json:
            from boxology_contract import PLAN_SCHEMA
            from lmformatenforcer import JsonSchemaParser
            from lmformatenforcer.integrations.transformers import build_transformers_prefix_allowed_tokens_fn
            generation_args["prefix_allowed_tokens_fn"] = build_transformers_prefix_allowed_tokens_fn(
                self.tokenizer, JsonSchemaParser(PLAN_SCHEMA),
            )
        else:
            generation_args["no_repeat_ngram_size"] = 4

        with torch.no_grad():
            output_ids = model.generate(**generation_args)

        new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
        if structured_json and len(new_tokens) >= max_tokens and int(new_tokens[-1]) not in {
            self.tokenizer.eos_token_id, self.tokenizer.convert_tokens_to_ids("<|eot_id|>"),
        }:
            raise ValueError("Architecture plan was truncated; increase the generation token budget.")
        return self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    @modal.method()
    def evaluate(self, variant_id: str, messages: list, max_tokens: int = 4096):
        """Authenticated Modal CLI evaluation of this source, without deploying endpoints."""
        return self._generate(variant_id, messages, max_tokens, 0.0, structured_json=True)

    @modal.fastapi_endpoint(method="POST")
    def chat(self, payload: dict, request: Request):
        import os

        from fastapi import HTTPException

        expected = f"Bearer {os.environ['T4B_MODAL_API_KEY']}"
        if request.headers.get("authorization") != expected:
            raise HTTPException(status_code=401, detail="Invalid or missing bearer token")

        variant_id = payload.get("variant") or payload.get("model_id") or "modal-baseline"
        messages = payload.get("messages") or []
        structured_json = bool(payload.get("structured_json", False))
        try:
            max_tokens = int(payload.get("max_tokens", 4096 if structured_json else 512))
            temperature = float(payload.get("temperature", 0.0))
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=400, detail="Invalid token budget or temperature") from exc
        if not 1 <= max_tokens <= 8192:
            raise HTTPException(status_code=400, detail="max_tokens must be between 1 and 8192")

        try:
            text = self._generate(
                variant_id, messages, max_tokens, temperature,
                structured_json=structured_json,
            )
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        return {"status": "ok", "variant": variant_id, "response": text}

    @modal.fastapi_endpoint(method="GET")
    def health(self, request: Request):
        import os

        from fastapi import HTTPException

        expected = f"Bearer {os.environ['T4B_MODAL_API_KEY']}"
        if request.headers.get("authorization") != expected:
            raise HTTPException(status_code=401, detail="Invalid or missing bearer token")

        return {"status": "ok", "variants": list(VARIANTS)}


@app.local_entrypoint()
def smoke(variant: str = "modal-cot2", output: str = "training/architecture_plans/evaluation"):
    """Run the warehouse regression with new GPU code without replacing production."""
    import sys
    import json
    import time
    sys.path.insert(0, str(REPO_ROOT / "backend"))
    from boxology_contract import get_plan_prompt
    from boxology_render import extract_plan, validate_plan, GENERATE_INSTRUCTION
    description = (
        "We have images from a warehouse where workers first label boxes and shelves. "
        "Then we train a model to recognize where every box is. After that, a robot "
        "can use the detected boxes together with warehouse rules to decide where to store new items."
    )
    start = time.monotonic()
    raw = T4BLlama().evaluate.remote(variant, [
        {"role": "system", "content": get_plan_prompt()},
        {"role": "user", "content": GENERATE_INSTRUCTION + description},
    ])
    plan = extract_plan(raw)
    report = {"model": variant, "raw": raw, "issues": validate_plan(plan), "seconds": time.monotonic() - start}
    target = Path(output)
    target.mkdir(parents=True, exist_ok=True)
    (target / f"{variant}-warehouse-raw.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
