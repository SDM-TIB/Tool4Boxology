import json
import re

import build_dataset as dataset


def _records(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def test_build_is_valid_and_deterministic(tmp_path):
    first = tmp_path / "first"
    second = tmp_path / "second"
    report = dataset.build(dataset.DEFAULT_DESCRIPTIONS, first, seed=42, validation_fraction=0.10)
    dataset.build(dataset.DEFAULT_DESCRIPTIONS, second, seed=42, validation_fraction=0.10)

    assert report["source_files"] == 61
    assert report["included_examples"] == 26
    assert report["train_examples"] == 23
    assert report["validation_examples"] == 3
    excluded = [row for row in report["audit"] if not row["included"]]
    assert len(excluded) == 35
    assert all(row["plan_issues"] or row["description_issues"] for row in excluded)

    for filename in ("all.jsonl", "train.jsonl", "validation.jsonl"):
        assert (first / filename).read_bytes() == (second / filename).read_bytes()

    all_records = _records(first / "all.jsonl")
    train_records = _records(first / "train.jsonl")
    validation_records = _records(first / "validation.jsonl")
    assert len(all_records) == 26
    assert {row["id"] for row in train_records}.isdisjoint(
        {row["id"] for row in validation_records}
    )

    for record in all_records:
        assert [message["role"] for message in record["messages"]] == [
            "system", "user", "assistant"
        ]
        plan = json.loads(record["messages"][2]["content"])
        assert not dataset.br.validate_plan(plan)
        assert "diagnosis" not in plan

        components = plan["artifacts"] + plan["processes"]
        assert all(not re.match(r"(?:node|group)_\d+$", item["key"]) for item in components)
        assert all(item["type"] in dataset.ALLOWED_TYPES[item["name"]] for item in components)

        artifacts = {item["key"]: item for item in plan["artifacts"]}
        processes = {item["key"]: item for item in plan["processes"]}
        for link in plan["links"]:
            if link["from"] in artifacts and link["to"] in processes:
                assert processes[link["to"]]["cluster"] in artifacts[link["from"]]["clusters"]
            if link["from"] in processes and link["to"] in artifacts:
                assert processes[link["from"]]["cluster"] in artifacts[link["to"]]["clusters"]

        rendered = dataset.br.plan_to_boxology(plan, "test description")
        assert rendered["class"] == "GraphLinksModel"
        assert "modelData" in rendered and "ModelData" not in rendered
        keys = {node["key"] for node in rendered["nodeDataArray"]}
        assert all(link["from"] in keys and link["to"] in keys for link in rendered["linkDataArray"])
