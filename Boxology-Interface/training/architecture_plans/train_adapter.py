"""Continue each original T4B adapter on description -> architecture JSON.

Writes NEW adapters; never overwrites the original yes/no research checkpoints.
Run --check-only first to verify complete target lengths and response-only masks.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
INTERFACE = HERE.parents[1]
sys.path.insert(0, str(INTERFACE / "backend"))
from boxology_contract import PLAN_SCHEMA, get_plan_prompt
from boxology_render import validate_plan

DIRECTORIES = {
    "baseline": "finetuned_LLaMA_3.2_1B_baseline",
    "cot2": "finetuned_LLaMA_3.2_1B_with_rules_CoT2",
    "cot3": "finetuned_LLaMA_3.2_1B_with_rules_CoT3",
}
BASE_MODEL = "meta-llama/Llama-3.2-1B-Instruct"


def encode_record(record, tokenizer, max_length):
    import jsonschema
    messages = record["messages"]
    if [m["role"] for m in messages] != ["system", "user", "assistant"]:
        raise ValueError(f"{record['id']}: expected one system/user/assistant training turn")
    if messages[0]["content"] != get_plan_prompt():
        raise ValueError("Dataset skill prompt is stale; run build_dataset.py again.")
    plan = json.loads(messages[-1]["content"])
    jsonschema.validate(plan, PLAN_SCHEMA)
    issues = validate_plan(plan)
    if issues:
        raise ValueError(f"{record['id']}: {issues}")
    prefix = tokenizer.apply_chat_template(messages[:-1], tokenize=True, add_generation_prompt=True)
    full = tokenizer.apply_chat_template(messages, tokenize=True, add_generation_prompt=False)
    if full[:len(prefix)] != prefix:
        raise ValueError("Chat template does not preserve the assistant prefix; refusing incorrect loss masking.")
    if len(full) > max_length:
        raise ValueError(f"{record['id']}: {len(full)} tokens exceeds {max_length}; increase --max-length. Never truncate targets.")
    if len(full) <= len(prefix):
        raise ValueError(f"{record['id']}: empty assistant target")
    return {"input_ids": full, "attention_mask": [1] * len(full),
            "labels": [-100] * len(prefix) + full[len(prefix):]}


def load_split(path, tokenizer, max_length):
    records = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not records:
        raise ValueError(f"Empty dataset: {path}")
    return records, [encode_record(r, tokenizer, max_length) for r in records]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variant", choices=DIRECTORIES, required=True)
    parser.add_argument("--dataset", type=Path, default=HERE / "generated")
    parser.add_argument("--source-root", type=Path, default=INTERFACE / "T4B-LLM/T4B_cloudrift")
    parser.add_argument("--output-root", type=Path, default=HERE / "trained_adapters")
    parser.add_argument("--max-length", type=int, default=8192)
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    from transformers import AutoTokenizer
    source = args.source_root / DIRECTORIES[args.variant]
    output = args.output_root / DIRECTORIES[args.variant]
    if output.resolve() == source.resolve() or output.exists():
        raise ValueError("Output must be a new directory, separate from the original adapter.")
    tokenizer = AutoTokenizer.from_pretrained(str(source))
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    train_records, train = load_split(args.dataset / "train.jsonl", tokenizer, args.max_length)
    val_records, validation = load_split(args.dataset / "validation.jsonl", tokenizer, args.max_length)
    if {r["id"] for r in train_records} & {r["id"] for r in val_records}:
        raise ValueError("Train/validation IDs overlap")
    summary = {
        "variant": args.variant, "source": str(source), "base_model": BASE_MODEL,
        "training_task": "description-to-architecture-plan", "train_records": len(train),
        "validation_records": len(validation), "max_record_tokens": max(len(r["input_ids"]) for r in train + validation),
        "skill_sha256": hashlib.sha256(get_plan_prompt().encode()).hexdigest(),
        "train_sha256": hashlib.sha256((args.dataset / "train.jsonl").read_bytes()).hexdigest(),
        "validation_sha256": hashlib.sha256((args.dataset / "validation.jsonl").read_bytes()).hexdigest(),
    }
    print(json.dumps(summary, indent=2))
    if args.check_only:
        return
    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, Trainer, TrainingArguments, DataCollatorForSeq2Seq, set_seed
    if not torch.cuda.is_available():
        raise RuntimeError("Training requires a CUDA GPU. --check-only works on CPU.")
    set_seed(42)
    base = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=torch.float16)
    model = PeftModel.from_pretrained(base, str(source), is_trainable=True)
    model.config.use_cache = False
    model.enable_input_require_grads()
    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir=str(output), num_train_epochs=args.epochs, learning_rate=2e-5,
            per_device_train_batch_size=1, per_device_eval_batch_size=1,
            gradient_accumulation_steps=8, gradient_checkpointing=True,
            gradient_checkpointing_kwargs={"use_reentrant": False}, fp16=True,
            eval_strategy="epoch", save_strategy="epoch", save_total_limit=2,
            load_best_model_at_end=True, logging_steps=1, report_to="none", seed=42,
        ),
        train_dataset=train, eval_dataset=validation,
        data_collator=DataCollatorForSeq2Seq(tokenizer, padding=True, label_pad_token_id=-100),
    )
    trainer.train()
    trainer.save_model(str(output))
    tokenizer.save_pretrained(str(output))
    (output / "architecture_training.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
