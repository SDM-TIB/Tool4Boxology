"""Convert architecture-trained PEFT adapters to offline GGUF via llama.cpp."""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from train_adapter import DIRECTORIES, BASE_MODEL, HERE


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--llama-cpp", type=Path, required=True, help="Local llama.cpp checkout with converter dependencies installed")
    parser.add_argument("--source", type=Path, default=HERE / "trained_adapters")
    parser.add_argument("--output", type=Path, default=HERE / "gguf_adapters")
    parser.add_argument("--variants", nargs="+", choices=DIRECTORIES, default=list(DIRECTORIES))
    parser.add_argument("--base-config", type=Path, help="Local base config/tokenizer directory; otherwise fetch base config from HF")
    args = parser.parse_args()
    converter = args.llama_cpp.resolve() / "convert_lora_to_gguf.py"
    if not converter.is_file():
        parser.error(f"Missing converter: {converter}")
    # Preflight all variants before writing any outputs.
    for variant in args.variants:
        source = args.source / DIRECTORIES[variant]
        if not (source / "architecture_training.json").is_file():
            parser.error(f"{source}: missing architecture-training manifest; train first")
        if json.loads((source / "adapter_config.json").read_text())["base_model_name_or_path"] != BASE_MODEL:
            parser.error(f"{source}: incompatible base model")
        if (args.output / f"{variant}.gguf").exists():
            parser.error("Output exists; select a new output directory to preserve previous weights")
    args.output.mkdir(parents=True, exist_ok=True)
    for variant in args.variants:
        source = args.source / DIRECTORIES[variant]
        target = args.output / f"{variant}.gguf"
        command = [sys.executable, str(converter), "--outtype", "f16", "--outfile", str(target.resolve())]
        command += ["--base", str(args.base_config.resolve())] if args.base_config else ["--base-model-id", BASE_MODEL]
        command.append(str(source.resolve()))
        subprocess.run(command, check=True)
        manifest = json.loads((source / "architecture_training.json").read_text())
        manifest["gguf_sha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
        target.with_suffix(".json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
