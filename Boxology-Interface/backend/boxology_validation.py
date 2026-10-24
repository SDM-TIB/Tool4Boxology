"""Strict architecture validation before a generated diagram reaches the editor."""

from collections import Counter
from boxology_contract import ALLOWED_TYPES

PROCESSES = {"Engineer", "Transform", "Train", "Deduce"}
ARTIFACTS = {"Actor", "Data", "Symbol", "Model"}
REPAIR_HINTS = {
    "Train": "Use Data or Symbol (optionally an existing Model) as inputs; output Model. Assemble observations and labels into a dataset in a separate Transform first.",
    "Engineer": "Use exactly one Actor, optionally one Data/Symbol/Model, then one artifact output.",
    "Deduce": "Use exactly two inputs: Model + Data, Model + Symbol, or two Models. Separate prediction from downstream reasoning. Assemble extra context in a preceding stage. An Actor belongs in a separate Engineer stage; raw rules are Symbol, an executable reasoner is Model.",
    "Transform": "Use one Data/Symbol input to output Data/Symbol; Model to Model; or Data + Symbol to output Data/Model. Split other combinations into elementary stages.",
}


def pattern_allowed(name, inputs, output):
    """Elementary signatures from the downloadable skill (counts matter)."""
    ins = tuple(sorted(inputs))
    if output not in {"Data", "Symbol", "Model"}:
        return False
    if name == "Train":
        return output == "Model" and ins in {("Data",), ("Symbol",), ("Data", "Model"), ("Model", "Symbol")}
    if name == "Engineer":
        return ins in {("Actor",), ("Actor", "Data"), ("Actor", "Symbol"), ("Actor", "Model")}
    if name == "Deduce":
        return ins in {("Data", "Model"), ("Model", "Symbol")} or (ins == ("Model", "Model") and output != "Model")
    if name == "Transform":
        return (ins, output) in {
            (("Symbol",), "Data"), (("Data",), "Data"), (("Data",), "Symbol"),
            (("Symbol",), "Symbol"), (("Model",), "Model"),
            (("Data", "Symbol"), "Data"), (("Data", "Symbol"), "Model"),
        }
    return False


def validate_plan(plan):
    issues = []
    if not isinstance(plan, dict):
        return ["Plan must be an object."]
    for field in ("clusters", "artifacts", "processes", "links"):
        if not isinstance(plan.get(field), list) or not plan[field]:
            issues.append(f"{field} must be a nonempty array.")
        elif any(not isinstance(row, dict) for row in plan[field]):
            issues.append(f"Every {field} entry must be an object.")
    if issues:
        return issues
    if not isinstance(plan.get("system_name"), str) or not plan["system_name"].strip():
        issues.append("system_name must be a nonempty string.")
    rows = plan["clusters"] + plan["artifacts"] + plan["processes"]
    keys = [r.get("key") for r in rows]
    if any(not isinstance(k, str) or not k.strip() for k in keys):
        return issues + ["All keys must be nonempty strings."]
    duplicates = [k for k, count in Counter(keys).items() if count > 1]
    if duplicates:
        return issues + [f"Duplicate keys across clusters/components: {duplicates}."]
    clusters = {r["key"]: r for r in plan["clusters"]}
    artifacts = {r["key"]: r for r in plan["artifacts"]}
    processes = {r["key"]: r for r in plan["processes"]}
    nodes = {**artifacts, **processes}
    for row in rows:
        if not isinstance(row.get("label"), str) or not row["label"].strip():
            issues.append(f"'{row['key']}' needs a label.")
    for key, row in nodes.items():
        allowed = PROCESSES if key in processes else ARTIFACTS
        name = row.get("name")
        if not isinstance(name, str) or name not in allowed:
            issues.append(f"'{key}': invalid canonical name {name!r}.")
            continue
        if not isinstance(row.get("type"), str) or row["type"] not in ALLOWED_TYPES[name]:
            issues.append(f"'{key}': invalid {name} subtype {row.get('type')!r}; use the root if unsure.")
    counts = Counter()
    for key, row in processes.items():
        group = row.get("cluster")
        if not isinstance(group, str) or group not in clusters:
            issues.append(f"'{key}': unknown cluster {group!r}.")
        else:
            counts[group] += 1
        if row.get("isShared"):
            issues.append(f"'{key}': processes cannot be shared.")
    for group in clusters:
        if counts[group] != 1:
            issues.append(f"Cluster '{group}' must contain exactly one process (has {counts[group]}).")

    inputs = {key: [] for key in processes}
    outputs = {key: [] for key in processes}
    memberships = {key: set() for key in artifacts}
    seen = set()
    for link in plan["links"]:
        src, dst = link.get("from"), link.get("to")
        if not isinstance(src, str) or not isinstance(dst, str) or src not in nodes or dst not in nodes:
            issues.append(f"Link {src!r} -> {dst!r}: endpoints must be component keys, not groups/missing nodes.")
            continue
        if (src, dst) in seen:
            issues.append(f"Duplicate link {src} -> {dst}.")
            continue
        seen.add((src, dst))
        if src in artifacts and dst in processes:
            inputs[dst].append(src)
            group = processes[dst].get("cluster")
            if isinstance(group, str):
                memberships[src].add(group)
        elif src in processes and dst in artifacts:
            outputs[src].append(dst)
            group = processes[src].get("cluster")
            if isinstance(group, str):
                memberships[dst].add(group)
        else:
            issues.append(f"Link {src} -> {dst}: must alternate artifact and process.")
    for key, row in processes.items():
        if len(outputs[key]) != 1:
            issues.append(f"'{key}': must have exactly one output (has {len(outputs[key])}).")
            continue
        in_names = [artifacts[k].get("name") for k in inputs[key]]
        out_name = artifacts[outputs[key][0]].get("name")
        if all(isinstance(n, str) for n in in_names) and isinstance(row.get("name"), str) and isinstance(out_name, str):
            if not pattern_allowed(row["name"], in_names, out_name):
                issues.append(f"'{key}': {in_names} -> {row['name']} -> {out_name} is not an elementary pattern. " + REPAIR_HINTS.get(row["name"], "Use a canonical process."))
    for key, row in artifacts.items():
        groups = row.get("clusters")
        if not isinstance(groups, list) or any(not isinstance(g, str) for g in groups):
            issues.append(f"'{key}': clusters must be an array of group keys.")
            continue
        if not memberships[key]:
            issues.append(f"'{key}': isolated artifact; connect it to its process.")
        if set(groups) != memberships[key] or len(groups) != len(set(groups)):
            issues.append(f"'{key}': clusters must equal the stages connected by its links: {sorted(memberships[key])}.")
    return issues
