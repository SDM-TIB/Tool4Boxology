"""Provider boundaries: strict plan format, isolated credentials, explicit failures."""
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))
import skill_handler
from boxology_contract import PLAN_SCHEMA


def test_schema_and_keys_are_per_request(monkeypatch):
    sent = []
    def post(url, **kwargs):
        sent.append((url, kwargs))
        return SimpleNamespace(status_code=200, json=lambda: {"candidates": [{
            "finishReason": "STOP", "content": {"parts": [{"text": '{"system_name":"Demo"}'}]},
        }]})
    monkeypatch.setattr(skill_handler.requests, "post", post)
    for key in ("first-secret", "second-secret"):
        result = skill_handler.chat_with_gemini(key, "gemini-test", [{"role": "user", "content": "repair"}],
                                               response_schema=PLAN_SCHEMA)
        assert result.startswith('{"system_name"')
    assert [c[1]["headers"]["x-goog-api-key"] for c in sent] == ["first-secret", "second-secret"]
    assert all("secret" not in c[0] for c in sent)
    assert all(c[1]["json"]["generationConfig"]["responseJsonSchema"] == PLAN_SCHEMA for c in sent)


def test_quota_error_stays_explicit(monkeypatch):
    monkeypatch.setattr(skill_handler.requests, "post", lambda *a, **k: SimpleNamespace(
        status_code=429, text='{"error":{"details":[{"retryDelay":"40000s"}]}}'))
    monkeypatch.setattr(skill_handler.time, "sleep", lambda _: pytest.fail("Do not wait for daily quota"))
    with pytest.raises(HTTPException) as exc:
        skill_handler.chat_with_gemini("secret", "gemini-test", [])
    assert exc.value.status_code == 429
    assert "quota" in exc.value.detail and "40000" in exc.value.detail


def test_truncation_never_looks_like_success(monkeypatch):
    monkeypatch.setattr(skill_handler.requests, "post", lambda *a, **k: SimpleNamespace(
        status_code=200, json=lambda: {"candidates": [{"finishReason": "MAX_TOKENS"}]}))
    with pytest.raises(HTTPException, match="truncated"):
        skill_handler.chat_with_gemini("secret", "gemini-test", [])
