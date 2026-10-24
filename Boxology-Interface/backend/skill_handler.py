# Boxology AI Skill Download & Chat Handler

import os
import json
import re
import time
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import FileResponse
import requests
import anthropic
import openai

# Turns a raw upstream error body (which may be an HTML block/error page from a CDN/WAF
# such as Cloudflare) into a short, readable message instead of dumping raw HTML to the UI.
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)

def _is_cloudflare_block(text: str) -> bool:
    lowered = (text or "").lower()
    return "cloudflare" in lowered and (
        "access denied" in lowered or "blocked" in lowered or "attention required" in lowered
    )

def _looks_like_html(text: str) -> bool:
    stripped = (text or "").strip().lower()
    return stripped.startswith("<!doctype html") or stripped.startswith("<html") or "<title>" in stripped

def clean_upstream_error(text: str, fallback: str) -> str:
    stripped = (text or "").strip()
    if not stripped:
        return fallback

    if _looks_like_html(stripped):
        match = _TITLE_RE.search(stripped)
        title = re.sub(r"\s+", " ", match.group(1)).strip() if match else ""
        if title:
            if _is_cloudflare_block(stripped):
                return (
                    f"{title}. The provider's backend blocked this request "
                    "(a Cloudflare/network restriction), not this app. Try again, switch to a "
                    "different model, or try another provider."
                )
            return title
        return f"{fallback} (the provider returned an HTML error page instead of JSON)"

    return stripped

# Get the skill file path
SKILL_FILE_PATH = Path(__file__).parent.parent / "public" / "download" / "boxology-ai-skill-restored.md"

def _network_hint(e: Exception) -> str:
    """Give an actionable message for connection/timeout failures instead of a bare SDK error."""
    name = type(e).__name__
    if "Timeout" in name or "Connect" in name:
        return (
            f"{str(e)} — the backend could not reach the provider's API within the timeout. "
            "This usually means outbound HTTPS is blocked by a firewall/corporate proxy on this machine."
        )
    return str(e)

def _generation_temperature(system_prompt: str | None = None) -> float:
    return 0 if system_prompt and "Tool4Boxology" in system_prompt else 0.7

_GEMINI_RETRY_DELAY_RE = re.compile(r"retry_delay\s*\{\s*seconds:\s*(\d+)")

def _gemini_retry_seconds(text: str) -> int | None:
    match = _GEMINI_RETRY_DELAY_RE.search(text or "")
    if match:
        return int(match.group(1))
    match = re.search(r'"retryDelay"\s*:\s*"(\d+)s"', text or "")
    return int(match.group(1)) if match else None

def _clean_gemini_error(status_code, text: str, fallback: str) -> str:
    if status_code == 429:
        retry_seconds = _gemini_retry_seconds(text)
        retry_hint = f" Retry in ~{retry_seconds}s." if retry_seconds is not None else ""
        return (
            "Gemini rate limit/quota exceeded for this API key's tier."
            f"{retry_hint} Reduce request frequency, upgrade the plan, or switch models/providers."
        )
    try:
        text = json.loads(text).get("error", {}).get("message") or text
    except (ValueError, AttributeError):
        pass
    return clean_upstream_error(text, fallback)

def get_skill_content() -> str:
    """Read the Boxology AI Skill from file"""
    try:
        with open(SKILL_FILE_PATH, 'r') as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Skill file not found at {SKILL_FILE_PATH}"
        )

def chat_with_openai(
    api_key: str,
    model_id: str,
    messages: list,
    max_tokens: int = 4096,
    system_prompt: str | None = None
) -> str:
    """Chat with OpenAI GPT models"""
    try:
        client = openai.OpenAI(api_key=api_key, timeout=60.0, max_retries=0)

        all_messages = []
        if system_prompt:
            # OpenAI uses system role
            all_messages.append({"role": "system", "content": system_prompt})

        all_messages.extend([
            {"role": msg["role"] if msg["role"] != "assistant" else "assistant", "content": msg["content"]}
            for msg in messages
        ])

        create_kwargs = {
            "model": model_id,
            "messages": all_messages,
            "max_tokens": max_tokens,
            "temperature": _generation_temperature(system_prompt),
        }
        if system_prompt and "Tool4Boxology" in system_prompt:
            create_kwargs["response_format"] = {"type": "json_object"}

        response = client.chat.completions.create(**create_kwargs)

        return response.choices[0].message.content or ""
    except HTTPException:
        raise
    except Exception as e:
        status_code = getattr(e, "status_code", 502) or 502
        raw_detail = getattr(e, "message", None) or _network_hint(e)
        detail = clean_upstream_error(raw_detail, f"OpenAI API error: {status_code}")
        if status_code in (401, 403):
            detail = f"OpenAI rejected the API key: {detail}"
        raise HTTPException(status_code=status_code, detail=f"OpenAI error: {detail}")

def chat_with_claude(
    api_key: str,
    model_id: str,
    messages: list,
    max_tokens: int = 4096,
    system_prompt: str | None = None
) -> str:
    """Chat with Anthropic Claude models"""
    try:
        client = anthropic.Anthropic(api_key=api_key, timeout=60.0, max_retries=0)

        response = client.messages.create(
            model=model_id,
            max_tokens=max_tokens,
            system=system_prompt or "",
            thinking={"type": "disabled"},
            messages=[
                {"role": msg["role"], "content": msg["content"]}
                for msg in messages
            ],
        )

        text_blocks = [block.text for block in response.content if block.type == "text"]
        if not text_blocks:
            raise HTTPException(status_code=502, detail="Claude returned no text content (only thinking/tool blocks)")
        return "\n".join(text_blocks)
    except HTTPException:
        raise
    except Exception as e:
        status_code = getattr(e, "status_code", 502) or 502
        raw_detail = getattr(e, "message", None) or _network_hint(e)
        detail = clean_upstream_error(raw_detail, f"Anthropic API error: {status_code}")
        if status_code in (401, 403):
            detail = f"Anthropic rejected the API key: {detail}"
        raise HTTPException(status_code=status_code, detail=f"Claude error: {detail}")

def chat_with_gemini(
    api_key: str,
    model_id: str,
    messages: list,
    max_tokens: int = 4096,
    system_prompt: str | None = None,
    _retried_after_rate_limit: bool = False,
    response_schema: dict | None = None,
) -> str:
    """Per-request Gemini REST client, with schema-constrained architecture output.

    Avoid the retired SDK's process-global API key. Concurrent users must not
    share credentials, and JSON MIME type alone does not enforce the plan format.
    """
    from urllib.parse import quote
    generation = {
        "maxOutputTokens": max_tokens,
        "temperature": _generation_temperature(system_prompt),
    }
    if response_schema is not None:
        generation.update(responseMimeType="application/json", responseJsonSchema=response_schema)
    elif system_prompt and "Tool4Boxology" in system_prompt:
        generation["responseMimeType"] = "application/json"
    body = {
        "contents": [{"role": "model" if m["role"] == "assistant" else "user",
                      "parts": [{"text": m["content"]}]} for m in messages],
        "generationConfig": generation,
    }
    if system_prompt:
        body["systemInstruction"] = {"parts": [{"text": system_prompt}]}
    model = quote(model_id.removeprefix("models/"), safe="")
    try:
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"x-goog-api-key": api_key}, json=body,
            timeout=(10, float(os.getenv("T4B_BUILDER_TIMEOUT_SECONDS") or "180")),
        )
        if response.status_code >= 400:
            raw = response.text
            delay = _gemini_retry_seconds(raw)
            if response.status_code == 429 and not _retried_after_rate_limit and delay is not None and delay <= 20:
                time.sleep(delay)
                return chat_with_gemini(api_key, model_id, messages, max_tokens, system_prompt,
                                        True, response_schema)
            detail = _clean_gemini_error(response.status_code, raw, "Gemini request failed")
            raise HTTPException(status_code=response.status_code, detail=f"Gemini error: {detail}")
        data = response.json()
        candidates = data.get("candidates") or []
        if not candidates:
            raise HTTPException(status_code=502, detail="Gemini returned no candidate response.")
        candidate = candidates[0]
        if candidate.get("finishReason") == "MAX_TOKENS":
            raise HTTPException(status_code=502, detail="Gemini output was truncated. Increase T4B_PLAN_MAX_TOKENS.")
        result = "".join(part.get("text", "") for part in candidate.get("content", {}).get("parts", [])
                         if not part.get("thought"))
        if not result.strip():
            raise HTTPException(status_code=502, detail="Gemini returned no text response.")
        return result
    except HTTPException:
        raise
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Gemini connection failed: {type(exc).__name__}") from exc
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=502, detail="Gemini returned an invalid response envelope.") from exc


def chat_with_huggingface(
    api_key: str,
    model_id: str,
    messages: list,
    max_tokens: int = 4096,
    system_prompt: str | None = None
) -> str:
    """Chat with Hugging Face Inference API"""
    try:
        url = f"https://api-inference.huggingface.co/models/{model_id}"

        # Prepare messages with system prompt
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "inputs": {
                "messages": full_messages,
                "parameters": {
                    "max_new_tokens": max_tokens,
                    "temperature": 0.7
                }
            }
        }

        response = requests.post(url, json=payload, headers=headers, timeout=120)

        if response.status_code != 200:
            detail = clean_upstream_error(response.text, f"HF API error: {response.status_code}")
            raise HTTPException(status_code=response.status_code, detail=f"Hugging Face error: {detail}")

        result = response.json()
        if isinstance(result, list) and len(result) > 0:
            return result[0].get("generated_text", "No response")
        return str(result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hugging Face error: {clean_upstream_error(str(e), 'unexpected failure')}")

async def chat_multi_provider(
    provider: str,
    api_key: str,
    model_id: str,
    messages: list,
    max_tokens: int = 4096,
    system_prompt: str | None = None
) -> str:
    """Route chat request to appropriate provider"""

    if provider == "openai":
        return chat_with_openai(api_key, model_id, messages, max_tokens, system_prompt)
    elif provider == "claude":
        return chat_with_claude(api_key, model_id, messages, max_tokens, system_prompt)
    elif provider == "gemini":
        return chat_with_gemini(api_key, model_id, messages, max_tokens, system_prompt)
    elif provider in ["huggingface", "local"]:
        return chat_with_huggingface(api_key, model_id, messages, max_tokens, system_prompt)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
