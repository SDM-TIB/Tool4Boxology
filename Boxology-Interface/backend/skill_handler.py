# Boxology AI Skill Download & Chat Handler

import os
import json
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import FileResponse
import requests
import anthropic
import openai

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

def _generation_temperature(system_prompt: str = None) -> float:
    return 0 if system_prompt and "Tool4Boxology" in system_prompt else 0.7

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
    system_prompt: str = None
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

        response = client.chat.completions.create(
            model=model_id,
            messages=all_messages,
            max_tokens=max_tokens,
            temperature=_generation_temperature(system_prompt)
        )

        return response.choices[0].message.content or ""
    except HTTPException:
        raise
    except Exception as e:
        status_code = getattr(e, "status_code", 502) or 502
        detail = getattr(e, "message", None) or _network_hint(e)
        if status_code in (401, 403):
            detail = f"OpenAI rejected the API key: {detail}"
        raise HTTPException(status_code=status_code, detail=f"OpenAI error: {detail}")

def chat_with_claude(
    api_key: str,
    model_id: str,
    messages: list,
    max_tokens: int = 4096,
    system_prompt: str = None
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
        detail = getattr(e, "message", None) or _network_hint(e)
        if status_code in (401, 403):
            detail = f"Anthropic rejected the API key: {detail}"
        raise HTTPException(status_code=status_code, detail=f"Claude error: {detail}")

def chat_with_gemini(
    api_key: str,
    model_id: str,
    messages: list,
    max_tokens: int = 4096,
    system_prompt: str = None
) -> str:
    """Chat with Google Gemini models"""
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)

        model = genai.GenerativeModel(model_id, system_instruction=system_prompt or "")

        # Convert messages to Gemini format
        chat_messages = []
        for msg in messages:
            if msg["role"] == "user":
                chat_messages.append({"role": "user", "parts": [msg["content"]]})
            else:
                chat_messages.append({"role": "model", "parts": [msg["content"]]})

        response = model.generate_content(
            contents=chat_messages,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=_generation_temperature(system_prompt)
            ),
            request_options={"timeout": 60.0}
        )

        return response.text
    except HTTPException:
        raise
    except Exception as e:
        status_code = getattr(e, "code", None) or getattr(e, "status_code", 502) or 502
        detail = _network_hint(e)
        if status_code in (401, 403):
            detail = f"Gemini rejected the API key: {detail}"
        raise HTTPException(status_code=status_code, detail=f"Gemini error: {detail}")

def chat_with_huggingface(
    api_key: str,
    model_id: str,
    messages: list,
    max_tokens: int = 4096,
    system_prompt: str = None
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
            raise Exception(f"HF API error: {response.text}")

        result = response.json()
        if isinstance(result, list) and len(result) > 0:
            return result[0].get("generated_text", "No response")
        return str(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Hugging Face error: {str(e)}")

async def chat_multi_provider(
    provider: str,
    api_key: str,
    model_id: str,
    messages: list,
    max_tokens: int = 4096,
    system_prompt: str = None
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
