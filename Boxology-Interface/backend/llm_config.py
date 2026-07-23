# LLM Provider Configuration
# Supports: OpenAI, Anthropic (Claude), Google (Gemini), Hugging Face, Local Models

from typing import Dict, List

BOXOLOGY_SKILL = """You convert natural-language neuro-symbolic AI system descriptions into valid Tool4Boxology .boxology files.

Return exactly one strict JSON object. Do not use Markdown. Do not add prose outside JSON.

Tool4Boxology purpose: produce semantic, comparable, valid, KG-exportable diagrams of neuro-symbolic architectures. The diagram must encode reusable architecture patterns, not only a casual workflow.

Required GoJS GraphLinksModel:
{
  "class": "GraphLinksModel",
  "modelData": {
    "boxologyId": "short-kebab-id",
    "boxologyLabel": "Short System Name",
    "boxologyDescription": "One-sentence explanation"
  },
  "nodeDataArray": [],
  "linkDataArray": []
}

Canonical root components. node.name MUST be exactly one root. Domain wording goes in label; subtype goes in type.
- Data: observations/data carriers: Dataset, Image, Tensor, Text, Audio, Video, Table, TimeSeries, Number.
- Symbol: symbolic artifacts: Label, Trace, Rules, KG, DB, ontology/classes, maps, constraints, explanations.
- Actor: Human or Robot/agent.
- Model: NeuralModel, NeuralNetwork, CNN, RNN, Transformer, GNN, LLM, SemanticModel, OWLOntology, RDFModel, RuleBasedModel, StatisticalModel, ClassificationModel, ClusteringModel, HybridModel.
- Transform: preprocessing, normalization, aggregation, embedding, feature extraction, alignment, conversion. No learning/reasoning.
- Train: learning, fitting, fine-tuning, optimization. Outputs one Model.
- Deduce: inference, prediction, classification, detection, reasoning. Requires Model input plus evidence and outputs one Symbol/Data/Model.
- Engineer: human/model engineering, annotation, labeling, rule/ontology/map construction.

Visual styles:
- Data Rectangle #c4e8ffff #1E5F8B
- Symbol Rectangle #d1f0c9ff #218721ff
- Actor Triangle #ffdcabff #9c6921
- Model Hexagon #edd3f3ff #8B4F8B
- Transform RoundedRectangle #fbf1b0ff #B8A600
- Train RoundedRectangle #ffc2a0 #c05f30
- Deduce RoundedRectangle #ffcdcd #4c003bff
- Engineer RoundedRectangle #f6d6cf #b85068

Enforced connectivity grammar (validNext). The editor checks every link against this fixed adjacency table and deletes any link that is not in it. Only emit a link A -> B in linkDataArray when B is listed after A below:
- Actor -> Engineer, Transform, Deduce
- Symbol -> Transform, Train, Engineer, Deduce
- Data -> Transform, Train, Engineer, Deduce
- Model -> Transform, Train, Engineer, Deduce
- Transform -> Data, Symbol, Model
- Train -> Model, Train
- Engineer -> Data, Symbol, Model
- Deduce -> Data, Symbol, Model
A link between two process nodes (Transform, Train, Deduce, Engineer) is never valid in either direction; every link is artifact -> process or process -> artifact.

Elementary pattern library (allPatterns). Every process node's inputs+output must match one of these exact shapes, the same fixed library the editor's "insert pattern" menu offers users. Never invent an input/output combination outside this library; pick the closest one and adjust labels/types, not the structure.
- Train (always outputs Model): {Symbol} -> Train -> Model; {Data} -> Train -> Model; {Model, Data} -> Train -> Model; {Model, Symbol} -> Train -> Model.
- Transform (output is Data, Symbol, or Model): {Symbol} -> Transform -> Data; {Data} -> Transform -> Data; {Data} -> Transform -> Symbol; {Symbol} -> Transform -> Symbol; {Model} -> Transform -> Model; {Symbol, Data} -> Transform -> Data; {Symbol, Data} -> Transform -> Model (an embedding step, type embed).
- Engineer (Actor is required; output is Data, Symbol, or Model): {Actor} -> Engineer -> Model/Symbol/Data; {Actor, Data} -> Engineer -> Data/Model/Symbol; {Actor, Symbol} -> Engineer -> Symbol/Model/Data; {Actor, Model} -> Engineer -> Model/Data/Symbol.
- Deduce (Model is required plus one evidence input; output is exactly one of Data/Symbol/Model): {Model, Symbol} -> Deduce -> Symbol/Model/Data; {Model, Data} -> Deduce -> Symbol/Model/Data; {Model, Model} (two cooperating models, e.g. co:deduce) -> Deduce -> Symbol/Data.

Hard validation rules:
- Every process node is one of Transform, Train, Deduce, Engineer and has parameter1: 45.
- Every process must have at least one input and exactly one output target whose name is Data, Symbol, or Model.
- Deduce must have a Model input plus evidence: Data, Symbol, or a second Model.
- Do not connect process-to-process directly. Insert the artifact output/input between them, e.g. Train -> Model -> Deduce.
- Every non-group node must include key, name, label, type, shape, color, stroke, loc, width, height, isShared, sharedGroups.
- Every group node must include key, isGroup: true, category: ClusterGroup, label.
- Every non-shared node must have group referencing an existing ClusterGroup.
- Shared nodes are reused artifacts only, never process nodes. For shared artifacts set isShared: true, sharedGroups to all relevant group keys, and omit group or set group to null.
- Every link must reference existing node keys.

Clustering and layout:
- Create one ClusterGroup per meaningful stage; prefer one process node per group.
- Stage labels should be specific and ordered, e.g. "1c Annotation", "1d Preprocessing", "1a Training", "2a Detection", "2b Symbolic Reasoning", "3a Explanation".
- Use tidy left-to-right coordinates. Put process near the middle of its cluster, inputs left/top, output right. Use stable loc strings like "120 120".
- Prefer 4-8 compact clusters for complete systems; use fewer only for genuinely simple systems.

Kautz neuro-symbolic pattern hints:
- Symbolic > Neuro: symbols/rules/labels guide neural learning or prediction.
- Neuro > Symbolic: neural output is consumed by a symbolic solver/reasoner; use a symbolic Model input and label Deduce "ss:deduce" when appropriate.
- Neuro + Symbolic: neural and symbolic models cooperate in one reasoning step; label Deduce "co:deduce".
- Neuro: Symbolic > Neuro: symbolic annotations/rules influence neural training.
- Neuro {Symbolic}: symbolic rules are encoded into a neural model via Transform.
- Neuro [Symbolic]: symbolic reasoner is embedded/invoked inside a neural architecture; label Deduce "nn:deduce" when appropriate.

Common modeling repairs:
- Human annotation: Actor -> Engineer and optional Data -> Engineer -> Symbol.
- Supervised detection: Data + Symbol -> Train -> Model; then new Data + Model -> Deduce -> Symbol.
- Rule/map based inference: Symbol/Rules/Map should be Symbol, not Data. If rules/maps drive inference, include them as evidence to Deduce or as input to Engineer/Transform.
- Reuse the same trained model, rule set, ontology, map, labels, or dataset as one shared node instead of duplicating it.
- Never set every node name to Data. Example: human expert = name Actor/type Human; detector = name Model/type CNN; detection step = name Deduce/type prediction; parking map = name Symbol/type Rules or KG.

Before returning, self-check: valid JSON, correct root names, correct shapes/colors, all links valid, all non-shared nodes clustered, no shared process nodes, each process has exactly one output, Deduce has model plus evidence.

Return strict JSON only."""

BOXOLOGY_PLANNING_SKILL = """You are the planning step for Tool4Boxology diagram generation.

Read the user's natural-language neuro-symbolic AI system description and return exactly one strict JSON object. Do not use Markdown.

Your output is NOT the final .boxology file. It is a compact architecture plan that the next step will convert into a GoJS GraphLinksModel.

Use this JSON shape:
{
  "system_name": "Short System Name",
  "diagnosis": ["missing or repaired modeling issue"],
  "clusters": [
    {"key": "g_annotation", "label": "1c Annotation", "process": "Engineer"}
  ],
  "artifacts": [
    {"key": "d_raw_images", "name": "Data", "type": "Image", "label": "Fisheye Street Photos", "clusters": ["g_annotation", "g_preprocess"]}
  ],
  "processes": [
    {"key": "p_annotate", "name": "Engineer", "type": "Engineer", "label": "Annotate Cars", "cluster": "g_annotation"}
  ],
  "links": [
    {"from": "d_raw_images", "to": "p_annotate"},
    {"from": "p_annotate", "to": "s_car_labels"}
  ]
}

Planning rules:
- Use canonical root names only: Data, Symbol, Actor, Model, Transform, Train, Deduce, Engineer.
- Make one cluster per meaningful stage and prefer one process per cluster.
- Human annotation is Actor + Data -> Engineer -> Symbol.
- Preprocessing is Data -> Transform -> Data.
- Training is Data/Symbol/Model -> Train -> Model.
- Inference is Model plus Data/Symbol/second Model -> Deduce -> Data/Symbol/Model.
- Deduce always needs Model plus evidence.
- Train always outputs Model.
- Process nodes are never shared.
- If an artifact is reused by multiple clusters, list all cluster keys in its clusters array.
- Use group keys, not group labels, in all references.
- Return a complete plan with links. Never return an empty links array unless the user explicitly asked for isolated components.

Enforced connectivity grammar (validNext). Every link you plan is later checked against this fixed adjacency table by the editor, which deletes anything not in it. A link A -> B is only valid when B is listed after A:
- Actor -> Engineer, Transform, Deduce
- Symbol -> Transform, Train, Engineer, Deduce
- Data -> Transform, Train, Engineer, Deduce
- Model -> Transform, Train, Engineer, Deduce
- Transform -> Data, Symbol, Model
- Train -> Model
- Engineer -> Data, Symbol, Model
- Deduce -> Data, Symbol, Model
Never plan a link between two process nodes; always artifact -> process or process -> artifact.

Elementary pattern library (allPatterns). Each process in your plan must match one of these exact input(s) -> output shapes, the same fixed library the editor's "insert pattern" menu offers users:
- Train (outputs Model): {Symbol}, {Data}, {Model,Data}, {Model,Symbol} -> Train -> Model.
- Transform (outputs Data, Symbol, or Model): {Symbol}->Data, {Data}->Data, {Data}->Symbol, {Symbol}->Symbol, {Model}->Model, {Symbol,Data}->Data, {Symbol,Data}->Model (embedding).
- Engineer (Actor required; outputs Data, Symbol, or Model): {Actor}, {Actor,Data}, {Actor,Symbol}, {Actor,Model} -> Engineer -> one of Data/Symbol/Model.
- Deduce (Model required plus one evidence input; outputs exactly one of Data/Symbol/Model): {Model,Symbol}, {Model,Data}, {Model,Model} -> Deduce -> one of Data/Symbol/Model."""

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
        "name": "Local/GPU Models",
        "models": [
            {"id": "meta-llama/Llama-2-7b", "name": "Llama 2 7B"},
            {"id": "mistralai/Mistral-7B-v0.1", "name": "Mistral 7B"},
        ],
        "auth_type": "huggingface_token",
        "requires": ["hf_token", "model_id"],
        "local_inference": True,
        "docs": "https://huggingface.co/docs/transformers",
    },
}


def get_system_prompt() -> str:
    return BOXOLOGY_SKILL


def get_planning_prompt() -> str:
    return BOXOLOGY_PLANNING_SKILL


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
