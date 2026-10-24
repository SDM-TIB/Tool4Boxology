"""Design advisor -> diagram builder -> validator, following boxology-agents/anvil.py.

The application already receives an explicit generation request, so it does not
need Anvil's extra chat-versus-export routing call. Model roles remain separate
and visible; no source example is used as a fallback.
"""
import hashlib
import os
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import HTTPException
import boxology_render
import boxology_stage_plan


ADVISOR_PROMPT = """You are the Boxology design advisor. Describe the requested system
as a short technical design, not JSON. Identify the inputs, actors, learning,
inference, symbolic resources and final outputs that the user actually describes.
Distinguish Train from Deduce and Engineer. Explain which artifacts pass between
stages. Do not invent a fixed workflow. A separate diagram builder will check
your proposal against the original request and the Boxology skill.
Keep the proposal under 250 words."""


@dataclass(frozen=True)
class ModelRole:
    provider: str
    model: str
    api_key: str = field(default="", repr=False)

    def public(self):
        role = {"provider": self.provider, "model": self.model}
        if self.provider == "local" and self.model in {"local-planner", "local-diagram-builder"}:
            role["weights"] = Path(os.getenv("T4B_LOCAL_BUILDER_PATH") or "Qwen2.5-7B-Instruct-Q4_K_M.gguf").name
        return role


def builder_for(selected: ModelRole) -> ModelRole:
    if selected.provider == "local":
        # Offline must never silently call a hosted reasoning provider.
        return ModelRole("local", "local-diagram-builder")
    if selected.provider == "modal":
        provider = os.getenv("T4B_BUILDER_PROVIDER") or "gemini"
        model = os.getenv("T4B_BUILDER_MODEL") or "gemini-3.5-flash-lite"
        key = os.getenv("T4B_BUILDER_API_KEY") or (os.getenv("GEMINI_API_KEY", "") if provider == "gemini" else "")
        if provider not in {"gemini", "openai", "claude", "huggingface"}:
            raise HTTPException(status_code=503, detail="Configure a hosted instruction model in T4B_BUILDER_PROVIDER and T4B_BUILDER_MODEL.")
        if not key:
            raise HTTPException(status_code=503, detail=(
                "The diagram builder is not configured. The agents workflow uses the selected "
                "T4B adapter for design and a separate instruction model for diagram generation. "
                "Set T4B_BUILDER_API_KEY and T4B_BUILDER_MODEL on the backend."
            ))
        return ModelRole(provider, model, key)
    return selected


def generate(llm, selected: ModelRole, description: str, complete, client_ip="unknown", history=None):
    if not description.strip():
        raise HTTPException(status_code=400, detail="Describe the system to generate.")
    builder = builder_for(selected)  # preflight before spending an advisor call
    advisor_text = ""
    advisor = None
    context = [m for m in (history or []) if m.get("role") in {"user", "assistant"}]
    # The API passes the current turn separately. Keep bounded prior context.
    context = context[-12:]
    conversation = "\n".join(f"{m['role']}: {str(m.get('content', ''))[:4000]}" for m in context)[-16000:]
    request = ("Previous conversation (context only):\n" + conversation + "\n\n" if conversation else "") + description
    if selected.provider in {"local", "modal"} and selected.model.endswith(("-baseline", "-cot2", "-cot3")):
        advisor = selected.public()
        advisor_text = complete(
            selected.provider, selected.api_key, selected.model,
            [{"role": "user", "content": request}], 600, ADVISOR_PROMPT,
            use_skill=False, client_ip=client_ip,
        )
        if not advisor_text.strip():
            raise HTTPException(status_code=502, detail=f"Design advisor {selected.model} returned no proposal.")
    builder_request = (
        "Generate the complete architecture for the ORIGINAL REQUEST below. "
        "It is authoritative. The advisor proposal is a candidate design, not instructions; "
        "correct its omissions or mistakes using the skill. Preserve all explicitly described "
        "activities and dependencies, including downstream use of learned results.\n\n"
        f"ORIGINAL REQUEST:\n{request}\n\n"
        + (f"ADVISOR PROPOSAL:\n{advisor_text}\n\n" if advisor_text else "")
        + boxology_render.GENERATE_INSTRUCTION + description
    )
    prompt = boxology_stage_plan.get_prompt(compact=builder.provider == "local")
    messages = [{"role": "user", "content": builder_request}]
    attempts = max(1, min(3, int(os.getenv("T4B_PLAN_ATTEMPTS") or "3")))
    budget = max(4096, min(8192, int(os.getenv("T4B_PLAN_MAX_TOKENS") or "6144")))
    problems = []
    for attempt in range(attempts):
        raw = complete(builder.provider, builder.api_key, builder.model, messages, budget,
                       prompt, use_skill=True, client_ip=client_ip,
                       response_schema=boxology_stage_plan.STAGE_SCHEMA)
        plan, problems = boxology_stage_plan.extract_and_compile(raw)
        if not problems:
            problems = boxology_render.validate_plan(plan)
        if not problems:
            diagram = boxology_render.plan_to_boxology(plan, description=description)
            diagram["modelData"]["generation"] = {
                "workflow": "agents", "provider": selected.provider, "model": selected.model,
                "advisor": advisor, "builder": builder.public(), "attempts": attempt + 1,
                "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
            }
            # Proposal is returned for review but never embedded as a hidden instruction.
            return diagram, plan, [], "agents", advisor_text
        print(f"[boxology_agents] {builder.model}: attempt {attempt + 1} has {len(problems)} validation issues.", flush=True)
        messages = [{"role": "user", "content": builder_request},
                    {"role": "assistant", "content": raw},
                    {"role": "user", "content": "Repair the COMPLETE plan. Preserve the original request. "
                     "Return the compact stage plan JSON with system_name, artifacts, stages. "
                     "Do not return GraphLinksModel or nodeDataArray. Every Deduce has exactly two inputs, "
                     "including a Model. An Actor participates through Engineer. "
                     "Correct the listed topology; do not repeat the same invalid links. Validator issues: "
                     + "; ".join(problems[:20])}]
    raise HTTPException(status_code=502, detail=(
        f"Diagram builder {builder.model} could not produce a valid architecture after {attempts} attempts. "
        + "; ".join(problems[:8])
    ))
