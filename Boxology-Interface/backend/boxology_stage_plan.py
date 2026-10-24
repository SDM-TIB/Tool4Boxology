"""Compact model-authored stages; compile bookkeeping without choosing topology."""
import json
import re

from boxology_contract import TEXT, array, component, get_skill, obj


STAGE_SCHEMA = obj({
    "system_name": TEXT,
    "artifacts": array(component(("Actor", "Data", "Symbol", "Model"), {})),
    "stages": array({"anyOf": [obj({
        "key": TEXT, "label": TEXT, "process": {"enum": [process]},
        "inputs": {"type": "array", "items": TEXT, "minItems": 2 if process == "Deduce" else 1,
                   "maxItems": 2},
        "output": TEXT,
    }) for process in ("Engineer", "Transform", "Train", "Deduce")]}),
})

STAGE_CONTRACT = """
APPLICATION OUTPUT CONTRACT: overrides only the skill's file/JSON format.
Return one compact JSON object with exactly system_name, artifacts, stages.
artifacts: [{key: short unique ID, name: Actor|Data|Symbol|Model,
             type: an allowed subtype, label: domain-specific label}]
stages: [{key: unique stage ID, label: action, process: Engineer|Transform|Train|Deduce,
          inputs: [artifact IDs], output: one artifact ID}]
Declare every input and output artifact once, then reuse its ID between stages.
Do NOT output clusters, links, coordinates, nodeDataArray, or GraphLinksModel.
The compiler creates one group per stage and exactly the edges YOU declare.

Choose stages from the original request. Include every explicit actor, resource,
activity, and final output; do not adopt the advisor's invented actors or tasks.
Actors such as humans and robots keep their identity and subtype throughout.
People or robots performing activities MUST be standalone Actor artifacts;
mentioning them only in a stage label is insufficient. Engineer always consumes
an Actor artifact. Each intermediate result needs its own artifact: observations,
annotations, learned models, predictions and decisions are different things.
Supplied rules are inputs, not the output of detection or decision making.
Before returning, check each sentence of the request against your stages.
Then check every stage against these EXACT signatures:
Engineer: Actor, optionally ONE Data/Symbol/Model -> Data/Symbol/Model.
Train: Data or Symbol, optionally ONE existing Model -> Model.
Deduce: exactly Model + Data, Model + Symbol, or Model + Model -> Data/Symbol.
        The first two pairs may also output Model. No Actor or third input.
Transform: Data -> Data/Symbol; Symbol -> Data/Symbol; Model -> Model;
           Data + Symbol -> Data/Model. No other combinations.
All stages have exactly one output artifact and at most two inputs.
For supervised learning, combine observations and labels with Transform into a
labeled dataset before Train; reuse the trained Model in a separate Deduce.
Raw rules are Symbol/Rules. A reasoning actor can configure an executable
Model/RuleBasedModel through Engineer with those rules, then Deduce consumes
that model and evidence. Configuration is not training. Keep provided actors;
do not replace a robot with a newly invented human expert.
Use supporting stages only when the grammar needs them. Do not add execution
when the user asks only for a decision. Do not invent a fixed sequence.
Return the complete compact JSON object, no prose.
"""


def get_prompt(compact=False):
    skill = get_skill()
    if compact:
        # File-format/clustering/style instructions belong to the compiler.
        # Keep the local model's context on the skill's semantic rules.
        sections = re.split(r"(?m)(?=^##(?:#)? )", skill)
        headings = ("## Component Vocabulary", "## Process Synonym Mapping",
                    "### Elementary Pattern Library", "## Common Repairs", "## Description fidelity")
        selected = [part for part in sections if part.startswith(headings)]
        if selected:
            skill = "\n".join(selected)
            # Keep the palette meanings, omit its renderer-owned style columns.
            skill = "\n".join(" | ".join(line.split("|")[:3]) + " |" if line.startswith("|") else line
                              for line in skill.splitlines())
    return "You are a careful Tool4Boxology architecture designer.\n\n" + skill + "\n\n" + STAGE_CONTRACT


def extract_and_compile(raw):
    """Return (standard plan, diagnostics); never add/remove a declared stage/edge."""
    start, end = raw.find("{"), raw.rfind("}")
    try:
        spec = json.loads(raw[start:end + 1])
    except (ValueError, TypeError):
        return None, ["Return a complete JSON object with system_name, artifacts, stages."]
    if not isinstance(spec, dict):
        return None, ["Stage plan must be an object."]
    # Existing plan clients and saved evaluation fixtures remain readable.
    if "stages" not in spec and "processes" in spec:
        return spec, []
    artifacts, stages = spec.get("artifacts"), spec.get("stages")
    if not isinstance(artifacts, list) or not artifacts or not isinstance(stages, list) or not stages:
        return None, ["artifacts and stages must be nonempty arrays."]
    for collection, rows in (("artifacts", artifacts), ("stages", stages)):
        if any(not isinstance(row, dict) or not isinstance(row.get("key"), str) or not row["key"] for row in rows):
            return None, [f"Every {collection} entry needs a string key."]
        if len({row["key"] for row in rows}) != len(rows):
            return None, [f"Duplicate {collection} keys. Give each entry a unique ID."]
    plan = {"system_name": spec.get("system_name"), "clusters": [], "processes": [],
            "artifacts": [], "links": []}
    members = {row["key"]: [] for row in artifacts}
    for stage in stages:
        inputs, output = stage.get("inputs"), stage.get("output")
        if not isinstance(inputs, list) or not inputs or any(not isinstance(k, str) for k in inputs) or not isinstance(output, str):
            return None, [f"Stage {stage['key']}: inputs must be artifact IDs and output must be one artifact ID."]
        unknown = [k for k in inputs + [output] if k not in members]
        if unknown:
            return None, [f"Stage {stage['key']}: undeclared artifacts {unknown}. Declare them in artifacts."]
        group, process = "group:" + stage["key"], "process:" + stage["key"]
        plan["clusters"].append({"key": group, "label": stage.get("label")})
        plan["processes"].append({"key": process, "name": stage.get("process"), "type": stage.get("process"),
                                  "label": stage.get("label"), "cluster": group})
        plan["links"].extend({"from": "artifact:" + key, "to": process} for key in inputs)
        plan["links"].append({"from": process, "to": "artifact:" + output})
        for key in inputs + [output]:
            if group not in members[key]:
                members[key].append(group)
    for row in artifacts:
        plan["artifacts"].append({"key": "artifact:" + row["key"], "name": row.get("name"),
                                  "type": row.get("type"), "label": row.get("label"),
                                  "clusters": members[row["key"]]})
    return plan, []
