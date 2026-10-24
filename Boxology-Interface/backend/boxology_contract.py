"""Shared generation contract; constraints describe syntax, never a domain template."""

from pathlib import Path

SKILL_PATH = Path(__file__).resolve().parents[1] / "public/download/boxology-ai-skill-restored.md"

ALLOWED_TYPES = {
    "Data": {"Data", "Number", "Dataset", "Tensor", "Text", "Image", "Audio", "Video", "TimeSeries", "Table"},
    "Symbol": {"Symbol", "DB", "KG", "Label", "Trace", "Rules"},
    "Actor": {"Actor", "Human", "Robot"},
    "Model": {
        "Model", "NeuralModel", "NeuralNetwork", "CNN", "RNN", "LSTM", "GRU",
        "Transformer", "DecoderOnlyTransformer", "EncoderDecoderTransformer",
        "EncoderOnlyTransformer", "GNN", "GCN", "GAT", "LLM", "SemanticModel",
        "OWLOntology", "RDFModel", "RDFSModel", "RuleBasedModel", "SHACLShapesModel",
        "StatisticalModel", "RegressionModel", "ClassificationModel", "ClusteringModel",
        "FuzzyModel", "InductiveModel", "NumericModel", "SymbolicLearningModel",
        "SelfSupervisedRuleMiningModel", "AxiomMiningModel",
        "UnsupervisedCommunityDetectionModel", "SupervisedGraphNNModel",
    },
    "Transform": {"Transform", "transform", "embed", "Normalize", "aggregate"},
    "Train": {"Train", "training", "Symbolic Learning", "Statistical Learning", "Deep Learning", "Reinforcement Learning"},
    "Engineer": {"Engineer", "engineering"},
    "Deduce": {"Deduce", "deduce", "classification", "prediction"},
}


def obj(properties):
    return {"type": "object", "properties": properties, "required": list(properties), "additionalProperties": False}


TEXT = {"type": "string", "minLength": 1}


def array(items, minimum=1):
    return {"type": "array", "items": items, "minItems": minimum}


def component(names, membership):
    return {"anyOf": [obj({
        "key": TEXT, "name": {"enum": [name]},
        "type": {"enum": sorted(ALLOWED_TYPES[name])}, "label": TEXT, **membership,
    }) for name in names]}


PLAN_SCHEMA = obj({
    "system_name": TEXT,
    "clusters": array(obj({"key": TEXT, "label": TEXT})),
    "artifacts": array(component(("Data", "Symbol", "Actor", "Model"), {"clusters": array(TEXT)})),
    "processes": array(component(("Engineer", "Transform", "Train", "Deduce"), {"cluster": TEXT})),
    "links": array(obj({"from": TEXT, "to": TEXT})),
})

PLAN_CONTRACT = """
Application transport contract (overrides ONLY the skill's output format):
Return a compact architecture plan as one JSON object, with these fields:
system_name: a short domain-specific title
clusters: [{key: unique stage ID, label: stage title}]
artifacts: [{key: unique ID, name: Data|Symbol|Actor|Model, type: allowed subtype, label: domain label, clusters: [all stage IDs that use this artifact]}]
processes: [{key: unique ID, name: Engineer|Transform|Train|Deduce, type: allowed subtype, label: action, cluster: stage ID}]
links: [{from: component ID, to: component ID}]
Use JSON double quotes. Do not output styles, coordinates, prose, or KG export JSON.
The application adds only visual styles and layout; YOU choose every stage, artifact and edge.
Use short unique IDs across ALL arrays. Links must reference artifacts/processes, never clusters.
Exactly one process per cluster. Every component must participate in a link.
Preserve ALL described activities, actors, resources, and their dependencies. Distinguish
annotation, training, inference, and downstream decisions when described. Do not reduce
a multi-stage system to one activity or copy an example architecture.
Model outputs must feed their consumers. Training and inference are separate stages;
reuse the trained model. Combine labels and observations into a labeled dataset with
Transform before supervised Train when both are supplied. Rules are Symbol/Rules;
an executable reasoner is Model/RuleBasedModel, not a rules artifact or an Actor.
Train means learning/fitting, not merely compiling or configuring supplied rules.
Use Transform for representation conversion, or Actor + resource -> Engineer ->
Model when an actor configures a reasoning model. A reasoning actor is not an
extra Deduce input. Do not invent execution of decisions when only deciding is
requested; preserve the actual requested final output.
Include supporting preparation/engineering only when needed to connect the described
activities under the elementary grammar. Do not invent preprocessing for every system.
Before answering, check the user's whole description for omitted stages, then check
all process inputs/outputs and all key references. Return the complete plan JSON only.
"""


def get_skill() -> str:
    # Fail explicitly on packaging errors instead of silently using a divergent prompt.
    return SKILL_PATH.read_text(encoding="utf-8")


def get_plan_prompt() -> str:
    return get_skill() + "\n\n" + PLAN_CONTRACT
