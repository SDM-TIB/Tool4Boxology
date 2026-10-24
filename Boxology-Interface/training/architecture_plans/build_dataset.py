"""Build description -> architecture-plan SFT data from human Boxology examples.

The source diagrams under ``NeSy-Example/BoxologyFiles`` use an older export
schema.  This builder intentionally keeps their topology while translating the
training target to the current compact plan contract used by
``backend/boxology_render.py``:

* current canonical root/type vocabulary;
* short semantic keys instead of timestamp-based GoJS keys;
* descriptive system names supplied with the reverse-authored prompts; and
* only examples that pass the current plan validator.

Run from anywhere with ``python build_dataset.py``.  Generated plans, JSONL
splits, and an audit report are written below ``generated/`` by default.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from pathlib import Path
from typing import Any


HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[2]
BACKEND_DIR = REPO_ROOT / "Boxology-Interface" / "backend"
SOURCE_DIR = REPO_ROOT / "NeSy-Example" / "BoxologyFiles"
DEFAULT_DESCRIPTIONS = HERE / "descriptions.json"
DEFAULT_OUTPUT = HERE / "generated"

sys.path.insert(0, str(BACKEND_DIR))
import boxology_render as br  # noqa: E402
from llm_config import BOXOLOGY_PLANNING_SKILL  # noqa: E402
from boxology_contract import PLAN_SCHEMA  # noqa: E402


ALLOWED_TYPES: dict[str, set[str]] = {
    "Data": {"Data", "Number", "Dataset", "Tensor", "Text", "Image", "Audio", "Video", "TimeSeries", "Table"},
    "Symbol": {"Symbol", "DB", "KG", "Label", "Trace", "Rules"},
    "Actor": {"Actor", "Human", "Robot"},
    "Model": {
        "Model", "NeuralModel", "NeuralNetwork", "CNN", "RNN", "LSTM", "GRU",
        "Transformer", "DecoderOnlyTransformer", "EncoderDecoderTransformer",
        "EncoderOnlyTransformer", "GNN", "GCN", "GAT", "LLM", "SemanticModel",
        "OWLOntology", "RDFModel", "RDFSModel", "RuleBasedModel",
        "SHACLShapesModel", "StatisticalModel", "RegressionModel",
        "ClassificationModel", "ClusteringModel", "FuzzyModel", "InductiveModel",
        "NumericModel", "SymbolicLearningModel",
    },
    "Transform": {"Transform"},
    "Train": {"Train"},
    "Engineer": {"Engineer"},
    "Deduce": {"Deduce", "classification", "prediction"},
}

TYPE_ALIASES = {
    "statisticmodel": "StatisticalModel",
    "time series": "TimeSeries",
    "timeseries": "TimeSeries",
    "hybridmodel": "Model",
    "normalize": "Transform",
}

BANNED_DESCRIPTION_WORDS = re.compile(
    r"\b(cluster|artifact|process|node|key|plan|json)\b", re.IGNORECASE
)


def _clean_text(value: Any, fallback: str) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text or fallback


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug or "item"


def _unique_key(prefix: str, label: str, used: set[str]) -> str:
    base = f"{prefix}_{_slug(label)}"
    key = base
    index = 2
    while key in used:
        key = f"{base}_{index}"
        index += 1
    used.add(key)
    return key


def _current_type(name: str, raw_type: Any) -> str:
    value = _clean_text(raw_type, name)
    value = TYPE_ALIASES.get(value.lower(), value)
    return value if value in ALLOWED_TYPES[name] else name


def convert_one(data: dict[str, Any], system_name: str) -> dict[str, Any]:
    """Convert one old GraphLinksModel export into the current compact plan."""
    nodes = data.get("nodeDataArray") or []
    links = data.get("linkDataArray") or []
    groups = [node for node in nodes if node.get("isGroup")]
    components = [node for node in nodes if not node.get("isGroup")]

    used_keys: set[str] = set()
    group_keys: dict[str, str] = {}
    clusters: list[dict[str, Any]] = []
    for group in groups:
        label = _clean_text(group.get("label"), "Stage")
        new_key = _unique_key("g", label, used_keys)
        group_keys[group["key"]] = new_key
        clusters.append({"key": new_key, "label": label})

    node_keys: dict[str, str] = {}
    normalized_nodes: list[tuple[dict[str, Any], str, str]] = []
    prefix_for = {
        "Data": "d", "Symbol": "s", "Actor": "a", "Model": "m",
        "Transform": "p", "Train": "p", "Deduce": "p", "Engineer": "p",
    }
    for node in components:
        name = br._canon(node.get("name", ""))
        label = _clean_text(node.get("label"), name)
        new_key = _unique_key(prefix_for[name], label, used_keys)
        node_keys[node["key"]] = new_key
        normalized_nodes.append((node, name, label))

    artifacts: list[dict[str, Any]] = []
    processes: list[dict[str, Any]] = []
    processes_by_cluster: dict[str, list[str]] = {}
    for node, name, label in normalized_nodes:
        new_key = node_keys[node["key"]]
        old_group = node.get("group")
        cluster = group_keys.get(old_group)
        if name in br.PROCESS_NAMES:
            process = {
                "key": new_key,
                "name": name,
                "type": _current_type(name, node.get("type")),
                "label": label,
                "cluster": cluster,
            }
            processes.append(process)
            if cluster:
                processes_by_cluster.setdefault(cluster, []).append(name)
        else:
            old_shared = node.get("sharedGroups") or []
            old_clusters = old_shared if node.get("isShared") and old_shared else ([old_group] if old_group else [])
            new_clusters = [group_keys[key] for key in old_clusters if key in group_keys]
            artifacts.append({
                "key": new_key,
                "name": name,
                "type": _current_type(name, node.get("type")),
                "label": label,
                "clusters": list(dict.fromkeys(new_clusters)),
            })

    for cluster in clusters:
        process_names = processes_by_cluster.get(cluster["key"], [])
        if len(process_names) == 1:
            cluster["process"] = process_names[0]

    plan_links = []
    seen_links: set[tuple[str, str]] = set()
    for link in links:
        src = node_keys.get(link.get("from"))
        dst = node_keys.get(link.get("to"))
        if not src or not dst or (src, dst) in seen_links:
            continue
        seen_links.add((src, dst))
        plan_links.append({"from": src, "to": dst})

    # Old editor exports usually assign an artifact only to the group where it
    # was drawn, even when an edge reuses it in a later stage.  The current plan
    # contract represents that reuse explicitly through ``clusters`` so the
    # deterministic renderer can mark the artifact as shared.
    artifact_by_key = {artifact["key"]: artifact for artifact in artifacts}
    process_by_key = {process["key"]: process for process in processes}
    for link in plan_links:
        if link["from"] in artifact_by_key and link["to"] in process_by_key:
            artifact = artifact_by_key[link["from"]]
            cluster = process_by_key[link["to"]].get("cluster")
        elif link["from"] in process_by_key and link["to"] in artifact_by_key:
            artifact = artifact_by_key[link["to"]]
            cluster = process_by_key[link["from"]].get("cluster")
        else:
            continue
        if cluster and cluster not in artifact["clusters"]:
            artifact["clusters"].append(cluster)

    return {
        "system_name": system_name,
        "diagnosis": [],
        "clusters": clusters,
        "artifacts": artifacts,
        "processes": processes,
        "links": plan_links,
    }


def _load_descriptions(path: Path) -> dict[str, dict[str, str]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("descriptions.json must contain a JSON array")
    result: dict[str, dict[str, str]] = {}
    for entry in raw:
        source_id = entry.get("file")
        if not source_id or source_id in result:
            raise ValueError(f"Missing or duplicate description file id: {source_id!r}")
        result[source_id] = entry
    return result


def _description_issues(entry: dict[str, str]) -> list[str]:
    issues: list[str] = []
    description = _clean_text(entry.get("description"), "")
    system_name = _clean_text(entry.get("system_name"), "")
    if not description:
        issues.append("description is empty")
    if not system_name:
        issues.append("system_name is empty")
    banned = sorted({match.group(0).lower() for match in BANNED_DESCRIPTION_WORDS.finditer(description)})
    if banned:
        issues.append(f"description contains internal vocabulary: {', '.join(banned)}")
    sentence_count = len(re.findall(r"[.!?](?:\s|$)", description))
    if sentence_count < 2 or sentence_count > 4:
        issues.append(f"description has {sentence_count} sentences; expected 2-4")
    return issues


def _record(source_id: str, description: str, plan: dict[str, Any]) -> dict[str, Any]:
    # Train exactly the constrained inference schema, not legacy metadata fields.
    target = {key: plan[key] for key in PLAN_SCHEMA["required"]}
    target["clusters"] = [{"key": c["key"], "label": c["label"]} for c in plan["clusters"]]
    assistant = json.dumps(target, ensure_ascii=False, separators=(",", ":"))
    return {
        "id": source_id,
        "messages": [
            {"role": "system", "content": BOXOLOGY_PLANNING_SKILL},
            {"role": "user", "content": br.GENERATE_INSTRUCTION + description},
            {"role": "assistant", "content": assistant},
        ],
    }


def _write_jsonl(path: Path, records: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")


def build(descriptions_path: Path, output_dir: Path, seed: int, validation_fraction: float) -> dict[str, Any]:
    descriptions = _load_descriptions(descriptions_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    plans_dir = output_dir / "plans"
    plans_dir.mkdir(exist_ok=True)

    audit: list[dict[str, Any]] = []
    records: list[dict[str, Any]] = []
    seen_system_names: set[str] = set()

    for source_path in sorted(SOURCE_DIR.glob("*.json")):
        source_id = source_path.stem
        entry = descriptions.get(source_id)
        entry_issues = ["no reverse-authored description"] if entry is None else _description_issues(entry)
        system_name = entry.get("system_name", source_id) if entry else source_id
        if system_name in seen_system_names:
            entry_issues.append("system_name is duplicated")
        seen_system_names.add(system_name)

        data = json.loads(source_path.read_text(encoding="utf-8"))
        plan = convert_one(data, system_name)
        plan_issues = br.validate_plan(plan)
        included = not entry_issues and not plan_issues

        plan_path = plans_dir / f"{source_id}.json"
        plan_path.write_text(json.dumps(plan, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        if included:
            records.append(_record(source_id, entry["description"], plan))

        audit.append({
            "file": source_id,
            "included": included,
            "clusters": len(plan["clusters"]),
            "artifacts": len(plan["artifacts"]),
            "processes": len(plan["processes"]),
            "links": len(plan["links"]),
            "description_issues": entry_issues,
            "plan_issues": plan_issues,
        })

    ids = [record["id"] for record in records]
    rng = random.Random(seed)
    rng.shuffle(ids)
    validation_count = max(1, round(len(ids) * validation_fraction)) if ids else 0
    validation_ids = set(ids[:validation_count])
    train = sorted((record for record in records if record["id"] not in validation_ids), key=lambda item: item["id"])
    validation = sorted((record for record in records if record["id"] in validation_ids), key=lambda item: item["id"])
    all_records = sorted(records, key=lambda item: item["id"])

    _write_jsonl(output_dir / "all.jsonl", all_records)
    _write_jsonl(output_dir / "train.jsonl", train)
    _write_jsonl(output_dir / "validation.jsonl", validation)

    report = {
        "source_directory": str(SOURCE_DIR),
        "descriptions": str(descriptions_path),
        "seed": seed,
        "validation_fraction": validation_fraction,
        "source_files": len(audit),
        "included_examples": len(records),
        "excluded_examples": len(audit) - len(records),
        "train_examples": len(train),
        "validation_examples": len(validation),
        "validation_ids": sorted(validation_ids),
        "audit": audit,
    }
    (output_dir / "report.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--descriptions", type=Path, default=DEFAULT_DESCRIPTIONS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--validation-fraction", type=float, default=0.10)
    args = parser.parse_args()
    if not 0 < args.validation_fraction < 1:
        parser.error("--validation-fraction must be between 0 and 1")
    report = build(args.descriptions.resolve(), args.output.resolve(), args.seed, args.validation_fraction)
    print(
        f"Built {report['included_examples']} examples from {report['source_files']} source files: "
        f"{report['train_examples']} train, {report['validation_examples']} validation, "
        f"{report['excluded_examples']} excluded."
    )


if __name__ == "__main__":
    main()
