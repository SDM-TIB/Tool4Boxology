# LLM Provider Configuration
# Supports: OpenAI, Anthropic (Claude), Google (Gemini), Hugging Face, Local Models

from typing import Dict, List

from boxology_contract import get_skill, get_plan_prompt

# Compatibility exports for the dataset builder. Both prompts use the downloadable skill.
BOXOLOGY_SKILL = get_skill()
BOXOLOGY_PLANNING_SKILL = get_plan_prompt()

PROVIDERS = {
    "openai": {
        "name": "OpenAI",
        "models": [
            {"id": "gpt-4.1", "name": "GPT-4.1"},
            {"id": "gpt-4.1-mini", "name": "GPT-4.1 Mini"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini"},
        ],
        "auth_type": "api_key",
        "auth_header": "Authorization: Bearer",
        "endpoint": "https://api.openai.com/v1/chat/completions",
        "requires": ["api_key"],
        "docs": "https://platform.openai.com/api-keys",
    },
    "claude": {
        "name": "Anthropic Claude",
        "models": [
            {"id": "claude-sonnet-5", "name": "Claude Sonnet 5"},
            {"id": "claude-opus-4-8", "name": "Claude Opus 4.8"},
            {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5"},
        ],
        "auth_type": "api_key",
        "auth_header": "x-api-key",
        "endpoint": "https://api.anthropic.com/v1/messages",
        "requires": ["api_key"],
        "docs": "https://console.anthropic.com/api/keys",
    },
    "gemini": {
        "name": "Google Gemini",
        "models": [
            {"id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash"},
            {"id": "gemini-3.1-flash-lite", "name": "Gemini 3.1 Flash Lite"},
        ],
        "auth_type": "api_key",
        "auth_header": "key (query param)",
        "endpoint": "https://generativelanguage.googleapis.com/v1beta/models",
        "requires": ["api_key"],
        "free_tier": "60 requests/minute",
        "docs": "https://aistudio.google.com/apikey",
    },
    "huggingface": {
        "name": "Hugging Face",
        "models": [
            {"id": "openai/gpt-oss-120b", "name": "GPT-OSS 120B"},
            {"id": "openai/gpt-oss-120b:fastest", "name": "GPT-OSS 120B Fastest"},
        ],
        "auth_type": "huggingface_token",
        "endpoint": "https://router.huggingface.co/v1/chat/completions",
        "requires": ["hf_token", "model_id"],
        "docs": "https://huggingface.co/settings/tokens",
    },
    "local": {
        "name": "Local T4B Model (offline)",
        "models": [
            {"id": "local-baseline", "name": "T4B LLaMA-3.2-1B (baseline)"},
            {"id": "local-cot2", "name": "T4B LLaMA-3.2-1B (rules + CoT2)"},
            {"id": "local-cot3", "name": "T4B LLaMA-3.2-1B (rules + CoT3)"},
            {"id": "local-planner", "name": "Qwen diagram builder (no advisor)"},
        ],
        "auth_type": "none",
        "requires": [],
        "local_inference": True,
        "docs": "Runs fully offline via llama.cpp on this machine/server - no API key or network call needed.",
    },
    "modal": {
        "name": "T4B Fine-tune (Modal GPU)",
        "models": [
            {"id": "modal-baseline", "name": "T4B LLaMA-3.2-1B (baseline)"},
            {"id": "modal-cot2", "name": "T4B LLaMA-3.2-1B (rules + CoT2)"},
            {"id": "modal-cot3", "name": "T4B LLaMA-3.2-1B (rules + CoT3)"},
            {"id": "modal-planner", "name": "Gemini diagram builder (no advisor)"},
            {"id": "modal-compare", "name": "Compare builder alone vs CoT3 advisor + builder"},
        ],
        "auth_type": "none",
        "endpoint": "https://mahsa-f91--t4b-llama-adapters-t4bllama-chat.us-east.modal.run",
        "requires": [],
        "docs": (
            "Server-hosted - the Modal bearer token lives in the backend's "
            "MODAL_T4B_API_KEY env var, never sent to the browser. Subject to a "
            "shared rate limit since the site operator pays for GPU time."
        ),
    },
}


def get_system_prompt() -> str:
    return get_skill()


def get_planning_prompt() -> str:
    return get_plan_prompt()


def get_provider_config(provider: str) -> Dict | None:
    return PROVIDERS.get(provider)


def list_providers() -> Dict[str, Dict]:
    return PROVIDERS


def get_models(provider: str) -> List[Dict]:
    config = get_provider_config(provider)
    if config:
        return config.get("models", [])
    return []


def validate_credentials(provider: str, credentials: Dict) -> tuple[bool, str]:
    config = get_provider_config(provider)
    if not config:
        return False, f"Unknown provider: {provider}"

    required = config.get("requires", [])
    for field in required:
        if field not in credentials or not credentials[field]:
            return False, f"Missing required field: {field}"

    return True, "OK"
