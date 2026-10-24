"""Live adapter evaluation. Saves raw attempts, failures, and valid diagrams separately.

python evaluate_generation.py --provider local --variants baseline cot2 cot3
For new GPU source without deploying: modal run modal_app/serve.py --variant modal-cot2
"""
import argparse
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / "backend"))
import main as backend
import llm_config
from fastapi import HTTPException

WAREHOUSE = (
    "We have images from a warehouse where workers first label boxes and shelves. "
    "Then we train a model to recognize where every box is. After that, a robot can use "
    "the detected boxes together with warehouse rules to decide where to store new items."
)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", choices=["local", "modal"], default="local")
    parser.add_argument("--variants", nargs="+", choices=["baseline", "cot2", "cot3", "planner"], default=["baseline", "cot2", "cot3"])
    parser.add_argument("--prompt", default=WAREHOUSE)
    parser.add_argument("--output", type=Path, default=HERE / "evaluation")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    original = backend._chat_provider_text
    all_passed = True
    for variant in args.variants:
        attempts = []
        calls = []
        def capture(*a, **k):
            raw = original(*a, **k)
            attempts.append(raw)
            calls.append({"provider": a[0], "model": a[2], "structured": k.get("use_skill", False)})
            return raw
        backend._chat_provider_text = capture
        model_id = f"{args.provider}-{variant}"
        start = time.monotonic()
        report = {"model": model_id, "prompt": args.prompt}
        try:
            diagram, plan, _, _ = backend._generate_boxology_plan(llm_config, args.provider, "", model_id, args.prompt)
            report["structurally_valid"] = True
            report["generation"] = diagram["modelData"].get("generation", {})
            report["stages"] = [p["label"] for p in plan["processes"]]
            # This is a regression assertion for the held-out example, NEVER a
            # generation heuristic or replacement architecture.
            if args.prompt == WAREHOUSE:
                names = [p["name"] for p in plan["processes"]]
                report["warehouse_minimum_coverage"] = (
                    "Engineer" in names and "Train" in names and names.count("Deduce") >= 2
                    and any(a["type"] == "Robot" for a in plan["artifacts"])
                    and any(a["type"] == "Rules" for a in plan["artifacts"])
                )
            (args.output / f"{model_id}.boxology").write_text(json.dumps(diagram, indent=2), encoding="utf-8")
        except HTTPException as exc:
            report.update(structurally_valid=False, error=exc.detail)
        finally:
            backend._chat_provider_text = original
        all_passed = all_passed and report["structurally_valid"] and report.get("warehouse_minimum_coverage", True)
        report.update(seconds=time.monotonic() - start, raw_attempts=attempts, calls=calls)
        (args.output / f"{model_id}-evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps({k: v for k, v in report.items() if k not in {"raw_attempts", "generation"}}), flush=True)

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
