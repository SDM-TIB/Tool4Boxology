"""Render model-authored architecture plans into GoJS without changing topology.

The shared skill supplies the modeling rules, the selected LLM supplies semantic
content, and strict validation gates every render. Styles and coordinates are the
only deterministic additions; no domain examples are consulted at inference time.
"""

from __future__ import annotations

import json
import re
import uuid
from typing import Any

# --- Vocabulary, styles ------------------------------------------------------
# Canonical root names and their GoJS shape/fill/stroke (matches llm_config.py's
# BOXOLOGY_SKILL legend).
NODE_STYLE: dict[str, tuple[str, str, str]] = {
    "Data": ("Rectangle", "#c4e8ffff", "#1E5F8B"),
    "Symbol": ("Rectangle", "#d1f0c9ff", "#218721ff"),
    "Actor": ("Triangle", "#ffdcabff", "#9c6921"),
    "Model": ("Hexagon", "#edd3f3ff", "#8B4F8B"),
    "Transform": ("RoundedRectangle", "#fbf1b0ff", "#B8A600"),
    "Train": ("RoundedRectangle", "#ffc2a0", "#c05f30"),
    "Deduce": ("RoundedRectangle", "#ffcdcd", "#4c003bff"),
    "Engineer": ("RoundedRectangle", "#f6d6cf", "#b85068"),
}
PROCESS_NAMES = {"Transform", "Train", "Deduce", "Engineer"}
ARTIFACT_NAMES = {"Data", "Symbol", "Actor", "Model"}

_CANON = {
    "data": "Data", "symbol": "Symbol", "actor": "Actor", "model": "Model",
    "transform": "Transform", "embed": "Transform", "train": "Train",
    "deduce": "Deduce", "engineer": "Engineer",
}


def _canon(name: str) -> str:
    """Map a free-form node name to a canonical Boxology root."""
    n = (name or "").strip().lower()
    if n in _CANON:
        return _CANON[n]
    if "model" in n:
        return "Model"
    if name in NODE_STYLE:
        return name
    return "Data"


# Prefix for the user's natural-language system description.
GENERATE_INSTRUCTION = (
    "Produce the architecture plan (strict JSON only) for this neuro-symbolic "
    "system:\n\n"
)


def recommendation_from_plan(plan: dict[str, Any]) -> str:
    """Return a compact user-facing summary of a generated architecture."""
    labels = []
    for cluster in plan.get("clusters") or []:
        label = re.sub(r"^\d+[a-z]?\s+", "", str(cluster.get("label") or "")).strip()
        if label:
            labels.append(label)
    if not labels:
        return "Generated a validated Tool4Boxology architecture."
    return "Recommended architecture: " + " -> ".join(labels) + "."


# --- Extracting the plan the model emits -------------------------------------

_FENCE_RE = re.compile(r"```(?:json|boxology-spec)?\s*(.*?)```", re.DOTALL)
_PLAN_KEYS = ("processes", "links", "clusters", "artifacts")


def extract_plan(text: str) -> dict[str, Any] | None:
    """Pull the architecture plan (a JSON object) out of model text, tolerantly."""
    candidates: list[str] = _FENCE_RE.findall(text or "")
    if not candidates and "{" in (text or ""):
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            candidates.append(text[start : end + 1])
    for blob in candidates:
        try:
            parsed = json.loads(blob)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict) and any(k in parsed for k in _PLAN_KEYS):
            return parsed
    return None


# --- Validation (Tool4Boxology hard rules) -----------------------------------

from boxology_validation import validate_plan


# --- Deterministic rendering: plan -> valid .boxology -------------------------

def _kebab(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (text or "boxology").lower()).strip("-") or "boxology"


def _link_maps(plan: dict[str, Any], artifacts: dict, processes: dict):
    inputs_of = {pk: [] for pk in processes}
    output_of = {pk: None for pk in processes}
    for link in plan.get("links") or []:
        src, dst = link.get("from"), link.get("to")
        if src in processes and dst in artifacts:
            output_of[src] = dst
        elif dst in processes and src in artifacts:
            inputs_of[dst].append(src)
    return inputs_of, output_of


def plan_to_boxology(plan: dict[str, Any], description: str = "") -> dict[str, Any]:
    """Render an architecture plan as a valid GoJS ``GraphLinksModel`` file."""
    problems = validate_plan(plan)
    if problems:
        raise ValueError("Invalid architecture plan: " + "; ".join(problems))
    system_name = plan.get("system_name") or plan.get("label") or "Untitled Boxology"
    clusters = plan.get("clusters") or []
    artifacts = {a.get("key"): a for a in (plan.get("artifacts") or []) if a.get("key")}
    processes = {p.get("key"): p for p in (plan.get("processes") or []) if p.get("key")}

    cluster_index = {c.get("key"): i for i, c in enumerate(clusters) if c.get("key")}
    inputs_of, output_of = _link_maps(plan, artifacts, processes)

    # Tidy left-to-right coordinates: one column per cluster. auto-arrange (the
    # frontend's "Auto-arrange" action / the AI-generation open flow) re-lays
    # this out properly from measured node sizes; these are just a reasonable
    # non-overlapping starting point.
    loc: dict[str, str] = {}

    def place(key: str, x: int, y: int) -> None:
        if key and key not in loc:
            loc[key] = f"{x} {y}"

    for pk, process in processes.items():
        column = 300 + cluster_index.get(process.get("cluster"), 0) * 820
        place(pk, column, 260)
        for j, art_key in enumerate(inputs_of[pk]):
            place(art_key, column - 280, 160 + j * 160)
        if output_of[pk]:
            place(output_of[pk], column + 280, 260)
    stray_y = 520
    for art_key in artifacts:
        if art_key not in loc:
            place(art_key, 140, stray_y)
            stray_y += 90

    node_array: list[dict[str, Any]] = []
    for cluster in clusters:
        if not cluster.get("key"):
            continue
        node_array.append({
            "key": cluster["key"], "isGroup": True,
            "category": "ClusterGroup", "label": cluster.get("label", ""),
        })

    # Stable dimensions match the generation skill and the initial layout.
    for art_key, art in artifacts.items():
        name = _canon(art.get("name", "Data"))
        shape, color, stroke = NODE_STYLE.get(name, NODE_STYLE["Data"])
        clusters_of = art.get("clusters") or ([art["cluster"]] if art.get("cluster") else [])
        clusters_of = [c for c in clusters_of if c in cluster_index]
        shared = len(clusters_of) > 1
        node = {
            "key": art_key, "name": name, "label": art.get("label", "") or name,
            "type": art.get("type", name), "shape": shape, "color": color,
            "stroke": stroke, "loc": loc.get(art_key, "140 140"),
            "isShared": shared, "sharedGroups": clusters_of if shared else [],
            "width": 180, "height": 60,
        }
        if shape == "Hexagon":
            node["parameter1"] = 1
        # GoJS's GraphLinksModel throws "GroupKey value ... is not a number or a
        # string: null" if `group` is explicitly null - omit the key entirely
        # for shared nodes instead of null-ing it (confirmed against the real
        # editor; a null `group` crashes it on load).
        group_key = None if shared else (clusters_of[0] if clusters_of
                                         else (clusters[0].get("key") if clusters else None))
        if group_key is not None:
            node["group"] = group_key
        node_array.append(node)

    # Process styles follow the downloadable skill.
    for pk, process in processes.items():
        name = _canon(process.get("name", "Transform"))
        shape, color, stroke = NODE_STYLE.get(name, NODE_STYLE["Transform"])
        node = {
            "key": pk, "name": name, "label": process.get("label", name) or name,
            "type": process.get("type", name), "shape": shape, "color": color,
            "stroke": stroke, "loc": loc.get(pk, "140 140"), "parameter1": 45,
            "isShared": False, "sharedGroups": [], "width": 180, "height": 60,
        }
        if process.get("cluster") in cluster_index:
            node["group"] = process["cluster"]
        node_array.append(node)

    # Validation already checked uniqueness and endpoints. Preserve every edge.
    link_array = [
        {"from": link["from"], "to": link["to"]} for link in plan["links"]
    ]

    # Each generation gets its own document identity, including repeated requests.
    model_data = {"boxologyId": str(uuid.uuid4()), "boxologyLabel": system_name}
    plan_description = plan.get("boxologyDescription") or description
    if plan_description:
        model_data["boxologyDescription"] = str(plan_description)[:500]

    return {
        "class": "GraphLinksModel", "modelData": model_data,
        "nodeDataArray": node_array, "linkDataArray": link_array,
    }
