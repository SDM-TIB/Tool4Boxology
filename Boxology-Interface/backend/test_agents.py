import json
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "training/architecture_plans"))
import boxology_agents as agents
import llm_config
import build_dataset
import boxology_stage_plan as stage_plan


def compact(plan):
    return {"system_name": plan["system_name"],
            "artifacts": [{k: a[k] for k in ("key", "name", "type", "label")} for a in plan["artifacts"]],
            "stages": [{"key": p["key"], "label": p["label"], "process": p["name"],
                        "inputs": [link["from"] for link in plan["links"] if link["to"] == p["key"]],
                        "output": next(link["to"] for link in plan["links"] if link["from"] == p["key"])}
                       for p in plan["processes"]]}


@pytest.fixture
def plan():
    source = json.loads((HERE.parent / "training/architecture_plans/warehouse-storage.boxology").read_text(encoding="utf-8"))
    return build_dataset.convert_one(source, "Warehouse")


@pytest.mark.parametrize("provider", ["local", "modal"])
@pytest.mark.parametrize("variant", ["baseline", "cot2", "cot3"])
def test_advisor_then_separate_builder(provider, variant, plan, monkeypatch):
    monkeypatch.setenv("T4B_BUILDER_API_KEY", "test-secret")
    monkeypatch.setenv("T4B_BUILDER_MODEL", "gemini-3.5-flash-lite")
    calls = []
    def complete(*args, **kwargs):
        calls.append((args, kwargs))
        return "Candidate: annotate, train, detect, decide." if len(calls) == 1 else json.dumps(compact(plan))
    result = agents.generate(llm_config, agents.ModelRole(provider, f"{provider}-{variant}"),
                             "Original request", complete)
    assert len(calls) == 2
    assert calls[0][0][2] == f"{provider}-{variant}"
    assert not calls[0][1]["use_skill"]
    expected = "local-diagram-builder" if provider == "local" else "gemini-3.5-flash-lite"
    assert calls[1][0][2] == expected and calls[1][1]["use_skill"]
    assert "Original request" in calls[1][0][3][0]["content"]
    assert "Candidate:" in calls[1][0][3][0]["content"]
    assert calls[1][1]["response_schema"] == stage_plan.STAGE_SCHEMA
    metadata = result[0]["modelData"]["generation"]
    assert metadata["advisor"]["model"] == f"{provider}-{variant}"
    assert metadata["builder"]["model"] == expected
    assert "test-secret" not in json.dumps(metadata)
    if provider == "local":
        assert all(c[0][0] == "local" for c in calls)


def test_builder_only_skips_adapter_and_uses_history(plan, monkeypatch):
    monkeypatch.setenv("T4B_BUILDER_API_KEY", "secret")
    calls = []
    def complete(*args, **kwargs):
        calls.append(args)
        return json.dumps(plan)
    result = agents.generate(llm_config, agents.ModelRole("modal", "modal-planner"),
                             "Add storage rules", complete,
                             history=[{"role": "user", "content": "Learn a box detector"}])
    assert len(calls) == 1 and calls[0][0] == "gemini"
    assert "Learn a box detector" in calls[0][3][0]["content"]
    assert result[0]["modelData"]["generation"]["advisor"] is None


def test_repair_belongs_to_builder(plan, monkeypatch):
    monkeypatch.setenv("T4B_BUILDER_API_KEY", "secret")
    calls = []
    def complete(*args, **kwargs):
        calls.append(args)
        return ["Design proposal", '{"processes":[]}', json.dumps(plan)][len(calls)-1]
    result = agents.generate(llm_config, agents.ModelRole("modal", "modal-cot3"), "request", complete)
    assert [a[0] for a in calls] == ["modal", "gemini", "gemini"]
    assert result[0]["modelData"]["generation"]["attempts"] == 2
    assert "Validator issues" in calls[2][3][-1]["content"]


def test_missing_builder_key_fails_before_adapter(monkeypatch):
    monkeypatch.delenv("T4B_BUILDER_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(HTTPException, match="builder is not configured"):
        agents.generate(llm_config, agents.ModelRole("modal", "modal-cot2"), "request",
                        lambda *a, **k: pytest.fail("Must preflight builder first"))


def test_builder_failure_never_blames_adapter_training(monkeypatch):
    monkeypatch.setenv("T4B_BUILDER_API_KEY", "secret")
    monkeypatch.setenv("T4B_PLAN_ATTEMPTS", "1")
    with pytest.raises(HTTPException) as exc:
        agents.generate(llm_config, agents.ModelRole("modal", "modal-planner"), "request",
                        lambda *a, **k: "broken JSON")
    assert "Diagram builder" in exc.value.detail
    assert "fine-tuning" not in exc.value.detail


def test_chat_endpoint_defaults_to_agents(plan, monkeypatch):
    import main
    from fastapi.testclient import TestClient
    monkeypatch.setenv("T4B_GENERATION_WORKFLOW", "agents")
    monkeypatch.setenv("T4B_BUILDER_API_KEY", "secret")
    monkeypatch.setattr(main, "_chat_provider_text", lambda *a, **k: json.dumps(plan))
    result = TestClient(main.app).post("/api/llm/chat", json={
        "provider": "modal", "model_id": "modal-planner", "use_boxology_skill": True,
        "messages": [{"role": "user", "content": "Warehouse"}],
    })
    assert result.status_code == 200
    assert result.json()["plan_generation_mode"] == "agents"
    assert "Diagram builder: gemini" in result.json()["explanation"]


def test_legacy_generation_endpoint_rejects_invalid_architecture(monkeypatch):
    import main
    from fastapi.testclient import TestClient
    monkeypatch.setenv("T4B_GENERATION_WORKFLOW", "agents")
    monkeypatch.setenv("T4B_PLAN_ATTEMPTS", "1")
    monkeypatch.setattr(main, "_chat_provider_text", lambda *a, **k: '{"processes":[]}')
    result = TestClient(main.app).post("/api/llm/boxology", json={
        "hf_token": "test-token", "description": "Learn a detector",
    })
    assert result.status_code == 502
    assert "boxology" not in result.json()


def test_stage_compilation_preserves_all_model_edges(plan):
    import jsonschema
    spec = compact(plan)
    jsonschema.validate(spec, stage_plan.STAGE_SCHEMA)
    result, issues = stage_plan.extract_and_compile(json.dumps(spec))
    assert not issues and not agents.boxology_render.validate_plan(result)
    assert len(result["artifacts"]) == len(spec["artifacts"])
    assert len(result["processes"]) == len(spec["stages"])
    expected = set()
    for stage in spec["stages"]:
        expected.update(("artifact:" + key, "process:" + stage["key"]) for key in stage["inputs"])
        expected.add(("process:" + stage["key"], "artifact:" + stage["output"]))
    assert {(link["from"], link["to"]) for link in result["links"]} == expected


def test_compiler_does_not_invent_missing_artifacts(plan):
    spec = compact(plan)
    spec["stages"][0]["inputs"].append("missing")
    result, issues = stage_plan.extract_and_compile(json.dumps(spec))
    assert result is None and "undeclared artifacts" in issues[0]


def test_schema_excludes_three_input_reasoning(plan):
    import jsonschema
    spec = compact(plan)
    stage = next(p for p in spec["stages"] if p["process"] == "Deduce")
    stage["inputs"].append("another-resource")
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(spec, stage_plan.STAGE_SCHEMA)
