import copy
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "training/architecture_plans"))
import boxology_render as render
import boxology_contract as contract
import build_dataset
import llm_config


@pytest.fixture(autouse=True)
def direct_workflow(monkeypatch):
    monkeypatch.setenv("T4B_GENERATION_WORKFLOW", "direct")


@pytest.fixture
def warehouse():
    data = json.loads((HERE.parent / "training/architecture_plans/warehouse-storage.boxology").read_text(encoding="utf-8"))
    return build_dataset.convert_one(data, data["modelData"]["boxologyLabel"])


def test_reference_roundtrip_preserves_topology(warehouse):
    assert render.validate_plan(warehouse) == []
    diagram = render.plan_to_boxology(warehouse)
    assert len(diagram["nodeDataArray"]) == len(warehouse["clusters"] + warehouse["artifacts"] + warehouse["processes"])
    assert diagram["linkDataArray"] == warehouse["links"]
    components = [n for n in diagram["nodeDataArray"] if not n.get("isGroup")]
    assert all(n["width"] == 180 and n["height"] == 60 for n in components)
    assert len({n["loc"] for n in components}) == len(components)
    assert any(n["name"] == "Actor" and n["type"] == "Robot" for n in components)
    assert any(n["name"] == "Model" and n["type"] == "RuleBasedModel" for n in components)
    assert all("group" not in n for n in components if n["isShared"])


@pytest.mark.parametrize("mutation", [
    lambda p: p["artifacts"].append(copy.deepcopy(p["artifacts"][0])),
    lambda p: p["links"].append({"from": p["processes"][0]["key"], "to": p["processes"][1]["key"]}),
    lambda p: p["links"].append({"from": p["processes"][0]["key"], "to": p["clusters"][0]["key"]}),
    lambda p: p["artifacts"][0].update(name="Preprocessing"),
    lambda p: p["artifacts"][0].update(type="Machine Learning"),
    lambda p: p["processes"][0].update(cluster="missing"),
    lambda p: p["processes"][0].update(isShared=True),
    lambda p: p["artifacts"][0].update(clusters=[]),
    lambda p: p["links"].append(copy.deepcopy(p["links"][0])),
])
def test_invalid_topology_never_renders(warehouse, mutation):
    mutation(warehouse)
    assert render.validate_plan(warehouse)
    with pytest.raises(ValueError, match="Invalid architecture plan"):
        render.plan_to_boxology(warehouse)


@pytest.mark.parametrize("value", [None, [], {}, {"clusters": [None]}, {"processes": "bad"}])
def test_malformed_response_is_validation_error(value):
    assert render.validate_plan(value)


def test_prompt_uses_actual_skill():
    assert llm_config.get_system_prompt() == contract.SKILL_PATH.read_text(encoding="utf-8")
    assert llm_config.get_planning_prompt().startswith(llm_config.get_system_prompt())
    assert "warehouse-storage.boxology" not in llm_config.get_planning_prompt()


@pytest.mark.parametrize("provider", ["local", "modal"])
@pytest.mark.parametrize("variant", ["baseline", "cot2", "cot3"])
def test_repair_keeps_selected_adapter(provider, variant, warehouse, monkeypatch):
    import main
    calls = []
    bad = copy.deepcopy(warehouse)
    bad["links"].append({"from": bad["processes"][0]["key"], "to": bad["processes"][1]["key"]})
    def complete(*args, **kwargs):
        calls.append((args, kwargs))
        return json.dumps(bad if len(calls) == 1 else warehouse)
    monkeypatch.setattr(main, "_chat_provider_text", complete)
    monkeypatch.setenv("T4B_PLAN_ATTEMPTS", "2")
    result, plan, issues, mode = main._generate_boxology_plan(llm_config, provider, "", f"{provider}-{variant}", "original request")
    assert len(calls) == 2
    assert all(c[0][2] == f"{provider}-{variant}" and c[1]["use_skill"] for c in calls)
    assert "original request" in calls[1][0][3][0]["content"]
    assert result["modelData"]["generation"]["attempts"] == 2
    assert mode == "model" and not issues


def test_exhausted_repair_does_not_return_bad_diagram(monkeypatch):
    import main
    from fastapi import HTTPException
    monkeypatch.setattr(main, "_chat_provider_text", lambda *a, **k: '{"processes":[]}')
    monkeypatch.setenv("T4B_PLAN_ATTEMPTS", "2")
    with pytest.raises(HTTPException) as caught:
        main._generate_boxology_plan(llm_config, "modal", "", "modal-cot3", "example")
    assert caught.value.status_code == 502
    assert "No diagram was substituted" in caught.value.detail


def test_local_json_constraints_and_adapter(monkeypatch):
    import local_t4b
    received = {}
    class FakeLlama:
        def create_chat_completion(self, **kwargs):
            received.update(kwargs)
            return iter([{"choices": [{"delta": {"content": "{}"}, "finish_reason": "stop"}]}])
    monkeypatch.setattr(local_t4b, "_get_llama", lambda variant: FakeLlama() if variant == "local-cot3" else None)
    local_t4b.chat_local("local-cot3", [], 4096, structured_json=True)
    assert received["response_format"]["schema"] == contract.PLAN_SCHEMA
    assert received["repeat_penalty"] == 1.0


def test_schema_accepts_reference(warehouse):
    import jsonschema
    warehouse.pop("diagnosis")
    for group in warehouse["clusters"]:
        group.pop("process", None)
    jsonschema.validate(warehouse, contract.PLAN_SCHEMA)


def test_api_success_contains_real_adapter_provenance(warehouse, monkeypatch):
    import main
    from fastapi.testclient import TestClient
    monkeypatch.setattr(main, "_chat_provider_text", lambda *a, **k: json.dumps(warehouse))
    response = TestClient(main.app).post("/api/llm/chat", json={
        "provider": "local", "model_id": "local-cot3", "use_boxology_skill": True,
        "messages": [{"role": "user", "content": "Warehouse regression"}],
    })
    assert response.status_code == 200
    data = response.json()
    assert data["boxology"]["modelData"]["generation"]["model"] == "local-cot3"
    assert data["plan_validation_issues"] == []


def test_api_invalid_answer_has_no_downloadable_artifact(monkeypatch):
    import main
    from fastapi.testclient import TestClient
    monkeypatch.setattr(main, "_chat_provider_text", lambda *a, **k: '{"clusters":[]}')
    monkeypatch.setenv("T4B_PLAN_ATTEMPTS", "1")
    response = TestClient(main.app).post("/api/llm/chat", json={
        "provider": "local", "model_id": "local-baseline", "use_boxology_skill": True,
        "messages": [{"role": "user", "content": "Warehouse regression"}],
    })
    assert response.status_code == 502
    assert "boxology" not in response.json()


def test_local_truncation_is_reported(monkeypatch):
    import local_t4b
    from fastapi import HTTPException
    class Truncated:
        def create_chat_completion(self, **kwargs):
            return iter([{"choices": [{"finish_reason": "length", "delta": {"content": '{"clusters":['}}]}])
    monkeypatch.setattr(local_t4b, "_get_llama", lambda _: Truncated())
    with pytest.raises(HTTPException, match="truncated"):
        local_t4b.chat_local("local-cot2", [], 4, structured_json=True)


def test_adapter_cache_refreshes_updated_weights(tmp_path, monkeypatch):
    import local_t4b
    source = tmp_path / "source"
    source.mkdir()
    (source / "cot2.gguf").write_bytes(b"old")
    monkeypatch.setenv("T4B_LOCAL_ADAPTERS_DIR", str(source))
    monkeypatch.setenv("T4B_LOCAL_CACHE_DIR", str(tmp_path / "cache"))
    target = local_t4b._ensure_adapter("local-cot2")
    assert target.read_bytes() == b"old"
    (source / "cot2.gguf").write_bytes(b"new architecture adapter")
    assert local_t4b._ensure_adapter("local-cot2").read_bytes() == b"new architecture adapter"


@pytest.mark.parametrize("inputs,process,output", [
    (["Actor", "Model"], "Deduce", "Data"),  # actor is not evidence
    (["Data"], "Engineer", "Symbol"),         # annotation needs an actor
    (["Data"], "Train", "Symbol"),            # training outputs a model
    (["Data", "Symbol"], "Train", "Model"),  # pair observations/labels first
    (["Model"], "Deduce", "Data"),            # missing evidence
])
def test_invalid_elementary_signatures(inputs, process, output):
    from boxology_validation import pattern_allowed
    assert not pattern_allowed(process, inputs, output)
