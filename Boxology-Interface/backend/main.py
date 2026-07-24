from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from SPARQLWrapper import SPARQLWrapper, JSON
import sys, os, socket, importlib, traceback, json, hashlib, re

# Turns a raw upstream error body (which may be an HTML block/error page from a CDN/WAF
# such as Cloudflare) into a short, readable message instead of dumping raw HTML to the UI.
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)

def is_cloudflare_block(text: str) -> bool:
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
            if is_cloudflare_block(stripped):
                return (
                    f"{title}. The provider's backend blocked this request "
                    "(a Cloudflare/network restriction), not this app. Try again, switch to a "
                    "different model, or try another provider."
                )
            return title
        return f"{fallback} (the provider returned an HTML error page instead of JSON)"

    return stripped

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
for p in (str(SRC), str(ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

def _detect_host(service_name: str = "boxology_kg") -> str:
    env_host = os.getenv("SPARQL_HOST")
    if env_host:
        return env_host
    try:
        socket.gethostbyname(service_name)
        return service_name
    except OSError:
        return "localhost"

_kg_host = _detect_host()
SPARQL_ENDPOINT = f"http://{_kg_host}:8890/sparql"
SPARQL_UPDATE_ENDPOINT = f"http://{_kg_host}:8890/sparql-auth"
print(f"[BOOT] Virtuoso host={_kg_host}")

DEFAULT_HF_MODEL_ID = os.getenv("DEFAULT_HF_MODEL_ID", "openai/gpt-oss-120b")
HF_CHAT_COMPLETIONS_URL = os.getenv(
    "HF_CHAT_COMPLETIONS_URL",
    "https://router.huggingface.co/v1/chat/completions",
)
HF_REQUEST_TIMEOUT_SECONDS = float(os.getenv("HF_REQUEST_TIMEOUT_SECONDS", "120"))
HF_DEFAULT_MAX_TOKENS = int(os.getenv("HF_DEFAULT_MAX_TOKENS", "512"))
HF_BOXOLOGY_MAX_TOKENS = int(os.getenv("HF_BOXOLOGY_MAX_TOKENS", "4096"))

BOXOLOGY_GENERATOR_SYSTEM_PROMPT = """You convert natural-language neuro-symbolic AI system descriptions into Tool4Boxology files.

Return only one JSON object. Do not wrap it in Markdown. Do not add commentary.

The JSON must be a GoJS GraphLinksModel with this shape:
{
  "class": "GraphLinksModel",
  "modelData": {
    "boxologyId": "ai-generated-short-id",
    "boxologyLabel": "Short system name",
    "boxologyDescription": "One-sentence natural-language explanation"
  },
  "nodeDataArray": [
    {
      "key": "node_1",
      "name": "Data",
      "label": "Training Dataset",
      "type": "Dataset",
      "shape": "Rectangle",
      "color": "#c4e8ffff",
      "stroke": "#1E5F8B",
      "loc": "0 0",
      "width": 180,
      "height": 60,
      "group": "group_1",
      "isShared": false,
      "sharedGroups": []
    },
    {
      "key": "node_2",
      "name": "Transform",
      "label": "Preprocess Data",
      "type": "Transform",
      "shape": "RoundedRectangle",
      "color": "#fbf1b0ff",
      "stroke": "#B8A600",
      "loc": "200 0",
      "width": 180,
      "height": 60,
      "group": "group_1",
      "isShared": false,
      "sharedGroups": []
    },
    {
      "key": "group_1",
      "isGroup": true,
      "category": "ClusterGroup",
      "label": "1a Training"
    }
  ],
  "linkDataArray": [
    { "from": "node_1", "to": "node_2" }
  ]
}

Use only these root component names:
- Data: input/output datasets, text, images, tables, tensors, time series
- Symbol: labels, rules, classes, knowledge graph, traces, explanations
- Actor: humans, domain experts, robots, agents
- Model: neural, statistical, semantic, hybrid, ontology, rule, embedding, or LLM models
- Transform: preprocessing, feature extraction, normalization, embedding, conversion
- Train: training, learning, fine-tuning, optimization
- Deduce: inference, prediction, classification, reasoning, diagnosis
- Engineer: human/model engineering, ontology authoring, rule construction

Use these visual styles:
- Data: shape Rectangle, color #c4e8ffff, stroke #1E5F8B
- Symbol: shape Rectangle, color #d1f0c9ff, stroke #218721ff
- Actor: shape Triangle, color #ffdcabff, stroke #9c6921
- Model: shape Hexagon, color #edd3f3ff, stroke #8B4F8B
- Transform: shape RoundedRectangle, color #fbf1b0ff, stroke #B8A600
- Train: shape RoundedRectangle, color #ffc2a0, stroke #c05f30
- Deduce: shape RoundedRectangle, color #ffcdcd, stroke #4c003bff
- Engineer: shape RoundedRectangle, color #f6d6cf, stroke #b85068

Enforced connectivity grammar (validNext): the editor checks every link against this fixed adjacency table and deletes any link that is not in it. Only emit a link A -> B in linkDataArray when B is listed after A below:
- Actor -> Engineer, Transform, Deduce
- Symbol -> Transform, Train, Engineer, Deduce
- Data -> Transform, Train, Engineer, Deduce
- Model -> Transform, Train, Engineer, Deduce
- Transform -> Data, Symbol, Model
- Train -> Model
- Engineer -> Data, Symbol, Model
- Deduce -> Data, Symbol, Model
A link between two process nodes (Transform, Train, Deduce, Engineer) is never valid in either direction. Every link is artifact -> process or process -> artifact.

Elementary pattern library (allPatterns): every process node's inputs+output must match one of these exact shapes, the same fixed library the editor's "insert pattern" menu offers users. Do not invent a combination that is not listed; pick the closest one and adjust labels/types, not the structure.
- Train (always outputs Model): {Symbol}, {Data}, {Model,Data}, {Model,Symbol} -> Train -> Model
- Transform (output Data, Symbol, or Model): {Symbol}->Data, {Data}->Data, {Data}->Symbol, {Symbol}->Symbol, {Model}->Model, {Symbol,Data}->Data, {Symbol,Data}->Model (embedding step, type embed)
- Engineer (Actor required; output Data, Symbol, or Model): {Actor}, {Actor,Data}, {Actor,Symbol}, {Actor,Model} -> Engineer -> any one of Data, Symbol, Model
- Deduce (Model required plus one evidence input; output exactly one of Data/Symbol/Model): {Model,Symbol}, {Model,Data}, {Model,Model} (two cooperating models) -> Deduce -> any one of Data, Symbol, Model

Model the system as connected input-process-output clusters. Create one ClusterGroup per meaningful stage, such as preprocessing, training, inference, explanation, or validation. Each non-group node should belong to a group unless it is intentionally shared across clusters. Use sharedGroups for nodes reused by multiple stages. Links must reference existing node keys and satisfy the connectivity grammar and pattern library above. Keep labels concise and domain-specific. Before returning, verify the JSON syntax carefully: every object property and every array item must be separated by commas."""

BOXOLOGY_STYLE_BY_NAME = {
    "Data": {"shape": "Rectangle", "color": "#c4e8ffff", "stroke": "#1E5F8B"},
    "Symbol": {"shape": "Rectangle", "color": "#d1f0c9ff", "stroke": "#218721ff"},
    "Actor": {"shape": "Triangle", "color": "#ffdcabff", "stroke": "#9c6921"},
    "Model": {"shape": "Hexagon", "color": "#edd3f3ff", "stroke": "#8B4F8B"},
    "Transform": {"shape": "RoundedRectangle", "color": "#fbf1b0ff", "stroke": "#B8A600"},
    "Train": {"shape": "RoundedRectangle", "color": "#ffc2a0", "stroke": "#c05f30"},
    "Deduce": {"shape": "RoundedRectangle", "color": "#ffcdcd", "stroke": "#4c003bff"},
    "Engineer": {"shape": "RoundedRectangle", "color": "#f6d6cf", "stroke": "#b85068"},
}

BOXOLOGY_ROOTS = set(BOXOLOGY_STYLE_BY_NAME.keys())
BOXOLOGY_PROCESS_ROOTS = {"Transform", "Train", "Deduce", "Engineer"}

BOXOLOGY_ALLOWED_TYPES_BY_ROOT = {
    "Data": {"Data", "Number", "Dataset", "Tensor", "Text", "Image", "Audio", "Video", "TimeSeries", "Table"},
    "Symbol": {"Symbol", "DB", "KG", "Label", "Trace", "Rules"},
    "Actor": {"Actor", "Human", "Robot"},
    "Model": {
        "Model",
        "InductiveModel",
        "NumericModel",
        "SymbolicLearningModel",
        "SelfSupervisedRuleMiningModel",
        "AxiomMiningModel",
        "UnsupervisedCommunityDetectionModel",
        "NeuralModel",
        "NeuralNetwork",
        "CNN",
        "RNN",
        "LSTM",
        "GRU",
        "Transformer",
        "DecoderOnlyTransformer",
        "EncoderDecoderTransformer",
        "EncoderOnlyTransformer",
        "GNN",
        "GCN",
        "GAT",
        "SupervisedGraphNNModel",
        "LLM",
        "SemanticModel",
        "OWLOntology",
        "RDFModel",
        "RDFSModel",
        "RuleBasedModel",
        "SHACLShapesModel",
        "StatisticalModel",
        "RegressionModel",
        "ClassificationModel",
        "ClusteringModel",
        "FuzzyModel",
        "HybridModel",
    },
    "Transform": {"Transform"},
    "Train": {"Train"},
    "Deduce": {"Deduce", "classification", "prediction"},
    "Engineer": {"Engineer"},
}

BOXOLOGY_TYPE_ALIASES = [
    ("bounding boxes", "Label"),
    ("bounding box", "Label"),
    ("annotations", "Label"),
    ("annotation", "Engineer"),
    ("annotating", "Engineer"),
    ("annotate", "Engineer"),
    ("labeling", "Engineer"),
    ("labelling", "Engineer"),
    ("labelled", "Label"),
    ("labeled", "Label"),
    ("labels", "Label"),
    ("label", "Label"),
    ("raw images", "Image"),
    ("raw image", "Image"),
    ("fisheye photos", "Image"),
    ("fisheye photo", "Image"),
    ("fisheye images", "Image"),
    ("fisheye image", "Image"),
    ("photos", "Image"),
    ("photo", "Image"),
    ("images", "Image"),
    ("image", "Image"),
    ("frames", "Image"),
    ("frame", "Image"),
    ("video", "Video"),
    ("table", "Table"),
    ("dataset", "Dataset"),
    ("data set", "Dataset"),
    ("tensor", "Tensor"),
    ("text", "Text"),
    ("parking space map", "Rules"),
    ("parking map", "Rules"),
    ("rule set", "Rules"),
    ("rules", "Rules"),
    ("rule", "Rules"),
    ("knowledge graph", "KG"),
    ("ontology", "SemanticModel"),
    ("owl", "OWLOntology"),
    ("rdf", "RDFModel"),
    ("shacl", "SHACLShapesModel"),
    ("human expert", "Human"),
    ("expert", "Human"),
    ("human", "Human"),
    ("annotator", "Human"),
    ("operator", "Human"),
    ("robot", "Robot"),
    ("agent", "Robot"),
    ("yolo", "CNN"),
    ("cnn", "CNN"),
    ("convolution", "CNN"),
    ("detector", "CNN"),
    ("classifier", "ClassificationModel"),
    ("classification model", "ClassificationModel"),
    ("clusterer", "ClusteringModel"),
    ("clustering model", "ClusteringModel"),
    ("llm", "LLM"),
    ("large language model", "LLM"),
    ("transformer", "Transformer"),
    ("gnn", "GNN"),
    ("rule based", "RuleBasedModel"),
    ("statistical", "StatisticalModel"),
    ("hybrid", "HybridModel"),
    ("preprocessing", "Transform"),
    ("preprocess", "Transform"),
    ("normalization", "Transform"),
    ("normalize", "Transform"),
    ("resizing", "Transform"),
    ("resize", "Transform"),
    ("feature extraction", "Transform"),
    ("embedding", "Transform"),
    ("conversion", "Transform"),
    ("training", "Train"),
    ("train", "Train"),
    ("fine tune", "Train"),
    ("finetune", "Train"),
    ("learning", "Train"),
    ("prediction", "prediction"),
    ("predict", "prediction"),
    ("detection", "prediction"),
    ("detect", "prediction"),
    ("classification", "classification"),
    ("classify", "classification"),
    ("reasoning", "Deduce"),
    ("infer", "Deduce"),
    ("inference", "Deduce"),
    ("writing", "Engineer"),
    ("write", "Engineer"),
    ("authoring", "Engineer"),
    ("author", "Engineer"),
    ("engineering", "Engineer"),
    ("designing", "Engineer"),
    ("design", "Engineer"),
    ("creation", "Engineer"),
    ("create", "Engineer"),
]

BOXOLOGY_KEYWORDS = [
    ("Actor", ("actor", "human", "expert", "annotator", "operator", "user", "robot", "agent")),
    ("Train", ("train", "training", "fit", "fitting", "fine tune", "fine-tune", "learn", "learning", "optimize")),
    ("Deduce", ("deduce", "infer", "inference", "predict", "prediction", "classify", "classification", "detect", "detection", "reason", "diagnosis")),
    ("Transform", ("transform", "preprocess", "pre-process", "normalize", "resize", "augment", "embed", "extract", "align", "convert", "project")),
    ("Engineer", ("engineer", "annotation", "annotate", "labeling", "author", "authoring", "write", "writing", "curate", "design", "designing", "create", "creation", "rule construction", "map creation")),
    ("Model", ("model", "detector", "classifier", "cnn", "yolo", "neural", "statistical", "semantic model", "hybrid", "llm", "embedding model")),
    ("Symbol", ("symbol", "label", "class", "rule", "knowledge graph", "ontology", "map", "parking space", "explanation", "trace", "bounding box", "mask")),
    ("Data", ("data", "dataset", "image", "photo", "video", "tensor", "table", "stream", "sensor", "observation")),
]


def _canonical_boxology_root(value) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None

    for root in BOXOLOGY_ROOTS:
        if text.lower() == root.lower():
            return root

    searchable = text.replace("_", " ").replace("-", " ").lower()
    for root, keywords in BOXOLOGY_KEYWORDS:
        if any(keyword in searchable for keyword in keywords):
            return root
    return None


def _shape_boxology_root(shape) -> str | None:
    normalized = str(shape or "").strip().lower()
    if normalized == "triangle":
        return "Actor"
    if normalized == "hexagon":
        return "Model"
    return None


def _simplify_boxology_text(value) -> str:
    return " ".join(str(value or "").replace("_", " ").replace("-", " ").lower().split())


def _normalize_boxology_type(root: str, value, label: str | None = "") -> str:
    allowed = BOXOLOGY_ALLOWED_TYPES_BY_ROOT.get(root, {root})
    raw = str(value or "").strip()

    for candidate in (raw, str(label or "").strip()):
        if not candidate:
            continue
        for type_name in allowed:
            if candidate.lower() == type_name.lower():
                return type_name

    search_text = _simplify_boxology_text(" ".join([raw, str(label or "")]))
    for alias, target in BOXOLOGY_TYPE_ALIASES:
        if alias in search_text:
            if target in allowed:
                return target
            if target == root or target in BOXOLOGY_ROOTS:
                return root

    return root if root in allowed else next(iter(allowed))


def _infer_boxology_root(node: dict) -> str:
    # Trust an already-valid explicit name/shape over a keyword guess from the label:
    # a "Training Data" artifact node (name="Data") must not be reclassified as the
    # "Train" process just because its label contains the word "training", or two
    # process nodes end up chained directly (Train -> Train), which the connectivity
    # grammar forbids.
    shape_root = _shape_boxology_root(node.get("shape"))
    if shape_root:
        return shape_root

    explicit_name = _canonical_boxology_root(node.get("name"))
    if explicit_name:
        return explicit_name

    explicit_type = _canonical_boxology_root(node.get("type"))
    if explicit_type:
        return explicit_type

    key = str(node.get("key") or "")
    label = str(node.get("label") or "")
    combined_root = _canonical_boxology_root(" ".join([key, label, str(node.get("type") or "")]))
    if combined_root:
        return combined_root
    return "Data"


def _normalize_shared_groups(node: dict) -> None:
    shared_groups = node.get("sharedGroups")
    if isinstance(shared_groups, str):
        shared_groups = [shared_groups]
    elif not isinstance(shared_groups, list):
        shared_groups = []

    node["sharedGroups"] = [str(group) for group in shared_groups if group]
    if len(node["sharedGroups"]) > 1:
        node["isShared"] = True
    else:
        node["isShared"] = bool(node.get("isShared", False))

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

@app.exception_handler(Exception)
async def _unhandled_exception_handler(request, exc: Exception):
    from fastapi.responses import JSONResponse
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})

def _hf_error_detail(error_body: str, fallback: str) -> str:
    try:
        data = json.loads(error_body)
    except json.JSONDecodeError:
        return clean_upstream_error(error_body, fallback)

    if isinstance(data, dict):
        message = data.get("error") or data.get("message") or data.get("detail")
        if isinstance(message, dict):
            return message.get("message") or fallback
        if message:
            return str(message)
    return fallback

def _provider_http_error(provider: str, status_code: int, error_body: str) -> HTTPException:
    detail = _hf_error_detail(error_body, f"{provider} API error: {status_code}")
    if status_code in (401, 403):
        detail = f"{provider} rejected the credential: {detail}"
    return HTTPException(status_code=status_code, detail=detail)

def _request_json(provider: str, request: Request, timeout: float = 20) -> dict:
    try:
        with urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        raise _provider_http_error(provider, e.code, error_body)
    except (URLError, TimeoutError) as e:
        raise HTTPException(status_code=503, detail=f"{provider} connection error: {str(e)}")

def _ensure_model_available(provider: str, model_id: str, response_data: dict) -> None:
    if not model_id or not isinstance(response_data, dict):
        return

    model_items = response_data.get("data") or response_data.get("models") or []
    if not isinstance(model_items, list):
        return

    available = set()
    for item in model_items:
        if not isinstance(item, dict):
            continue
        model_name = item.get("id") or item.get("name")
        if not model_name:
            continue
        model_name = str(model_name)
        available.add(model_name)
        if model_name.startswith("models/"):
            available.add(model_name.split("/", 1)[1])

    if available and model_id not in available:
        raise HTTPException(
            status_code=400,
            detail=f"{provider} credential is valid, but model '{model_id}' is not available for this account/API.",
        )

def _validate_remote_credentials(provider: str, api_key: str, model_id: str) -> str:
    if provider == "openai":
        request = Request(
            "https://api.openai.com/v1/models",
            headers={"Authorization": f"Bearer {api_key}"},
            method="GET",
        )
        data = _request_json("OpenAI", request)
        _ensure_model_available("OpenAI", model_id, data)
        return "OpenAI API key is valid."

    if provider == "gemini":
        request = Request(
            f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
            method="GET",
        )
        data = _request_json("Google Gemini", request)
        _ensure_model_available("Google Gemini", model_id, data)
        return "Gemini API key is valid."

    if provider == "huggingface":
        request = Request(
            "https://huggingface.co/api/whoami-v2",
            headers={"Authorization": f"Bearer {api_key}"},
            method="GET",
        )
        _request_json("Hugging Face", request)
        return "Hugging Face token is valid."

    if provider == "claude":
        request = Request(
            "https://api.anthropic.com/v1/models",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            method="GET",
        )
        _request_json("Anthropic", request)
        return "Anthropic API key is valid."

    raise HTTPException(status_code=400, detail=f"Provider '{provider}' not implemented")

def _message_content_to_text(content) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text") or item.get("content")
                if text:
                    parts.append(str(text))
            elif item:
                parts.append(str(item))
        return "\n".join(parts).strip()
    if content is not None:
        return str(content).strip()
    return ""

def _extract_hf_response_text(data: dict) -> str:
    try:
        choice = data["choices"][0]
        message = choice.get("message") or {}
    except (KeyError, IndexError, TypeError):
        raise HTTPException(status_code=502, detail="Unexpected Hugging Face response format")

    response_text = _message_content_to_text(message.get("content"))
    if response_text:
        return response_text

    finish_reason = choice.get("finish_reason") or "unknown"
    usage = data.get("usage") or {}
    completion_tokens = usage.get("completion_tokens", "unknown")
    raise HTTPException(
        status_code=502,
        detail=(
            "Hugging Face returned an empty final message. "
            f"finish_reason={finish_reason}, completion_tokens={completion_tokens}. "
            "Try again, increase max tokens, or use a provider suffix such as "
            "openai/gpt-oss-120b:fastest."
        ),
    )

def _hf_base_model_id(model_id: str) -> str:
    return model_id.rsplit(":", 1)[0] if ":" in model_id else model_id

def _hf_is_reasoning_model(model_id: str) -> bool:
    """gpt-oss models spend hidden chain-of-thought tokens before the final answer.

    With the default reasoning effort they can burn the whole max_tokens budget on
    thinking and return no visible content at all (finish_reason=length, empty message).
    Asking for low reasoning effort leaves more of the budget for the actual answer.
    """
    return "gpt-oss" in _hf_base_model_id(model_id).lower()

HF_MAX_TOKENS_CEILING = int(os.getenv("HF_MAX_TOKENS_CEILING", "8192"))

_hf_provider_cache: dict[str, list[str]] = {}

def _hf_live_providers(base_model_id: str, hf_token: str) -> list[str]:
    """Ask Hugging Face which inference providers actually serve this model.

    Used to hop to a different backend when the one HF auto-routed to gets blocked
    (e.g. a provider's Cloudflare/WAF rejects requests from this server's network).
    """
    if base_model_id in _hf_provider_cache:
        return _hf_provider_cache[base_model_id]

    providers: list[str] = []
    try:
        request = Request(
            f"https://huggingface.co/api/models/{base_model_id}?expand[]=inferenceProviderMapping",
            headers={"Authorization": f"Bearer {hf_token}"},
            method="GET",
        )
        with urlopen(request, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
        mapping = data.get("inferenceProviderMapping") or {}
        providers = [
            name for name, info in mapping.items()
            if not isinstance(info, dict) or info.get("status") in (None, "live")
        ]
    except Exception as e:
        print(f"[LLM] Could not fetch Hugging Face provider list for {base_model_id}: {e}")

    _hf_provider_cache[base_model_id] = providers
    return providers

def _chat_with_hugging_face(
    model_id: str,
    hf_token: str,
    messages: list,
    max_tokens: int,
    temperature: float = 0.7,
    _tried_model_ids: frozenset = frozenset(),
    _retried_for_length: bool = False,
):
    tried_model_ids = _tried_model_ids | {model_id}
    payload = {
        "model": model_id,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": False,
    }
    if _hf_is_reasoning_model(model_id):
        payload["reasoning_effort"] = "low"
    request = Request(
        HF_CHAT_COMPLETIONS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {hf_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    print(f"[LLM] Sending hosted Hugging Face request: {model_id}")
    try:
        with urlopen(request, timeout=HF_REQUEST_TIMEOUT_SECONDS) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        if is_cloudflare_block(error_body):
            base_model_id = _hf_base_model_id(model_id)
            next_model_id = next(
                (
                    f"{base_model_id}:{provider}"
                    for provider in _hf_live_providers(base_model_id, hf_token)
                    if f"{base_model_id}:{provider}" not in tried_model_ids
                ),
                None,
            )
            if next_model_id:
                print(f"[LLM] {model_id} blocked upstream (Cloudflare); retrying via {next_model_id}")
                return _chat_with_hugging_face(
                    next_model_id,
                    hf_token,
                    messages,
                    max_tokens,
                    temperature=temperature,
                    _tried_model_ids=tried_model_ids,
                    _retried_for_length=_retried_for_length,
                )
        detail = _hf_error_detail(error_body, f"Hugging Face API error: {e.code}")
        if is_cloudflare_block(error_body) and len(tried_model_ids) > 1:
            detail += f" (tried {len(tried_model_ids)} Hugging Face inference providers, all blocked)"
        print(f"[LLM] Hugging Face API error {e.code}: {detail}")
        raise HTTPException(status_code=e.code, detail=detail)
    except (URLError, TimeoutError) as e:
        print(f"[LLM] Hugging Face connection error: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Hugging Face connection error: {str(e)}")

    choice = ((data or {}).get("choices") or [{}])[0]
    content_text = _message_content_to_text((choice.get("message") or {}).get("content"))
    if not content_text and choice.get("finish_reason") == "length" and not _retried_for_length:
        boosted_max_tokens = min(max_tokens * 2, HF_MAX_TOKENS_CEILING)
        if boosted_max_tokens > max_tokens:
            print(
                f"[LLM] {model_id} spent the whole token budget on reasoning with no final answer; "
                f"retrying with max_tokens={boosted_max_tokens}"
            )
            return _chat_with_hugging_face(
                model_id,
                hf_token,
                messages,
                boosted_max_tokens,
                temperature=temperature,
                _tried_model_ids=tried_model_ids,
                _retried_for_length=True,
            )

    response_text = _extract_hf_response_text(data)

    return {
        "status": "ok",
        "model_id": model_id,
        "response": response_text,
        "tokens_generated": data.get("usage", {}).get("completion_tokens", max_tokens),
        "provider": "huggingface",
    }

def _extract_json_object(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise HTTPException(status_code=502, detail="AI response did not contain a JSON object")
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI response was not valid JSON: {str(e)}")

def _repair_json_with_hugging_face(
    model_id: str,
    hf_token: str,
    malformed_json_text: str,
    parse_error: str,
) -> dict:
    repair_prompt = (
        "Repair the following malformed Tool4Boxology JSON. Return only one valid JSON object. "
        "Do not add Markdown, comments, or explanation. Preserve the intended nodes, links, "
        "groups, labels, and modelData. Fix missing commas, trailing commas, quote issues, "
        "unclosed arrays, and unclosed objects.\n\n"
        f"Parser error:\n{parse_error}\n\n"
        f"Malformed JSON:\n{malformed_json_text}"
    )
    repaired = _chat_with_hugging_face(
        model_id,
        hf_token,
        [
            {"role": "system", "content": "You are a strict JSON repair tool. Return valid JSON only."},
            {"role": "user", "content": repair_prompt},
        ],
        HF_BOXOLOGY_MAX_TOKENS,
        temperature=0,
    )
    try:
        return _extract_json_object(repaired["response"])
    except HTTPException as e:
        raise HTTPException(
            status_code=502,
            detail=f"AI returned malformed JSON, and the repair attempt also failed: {e.detail}",
        )

def _normalize_boxology_model(data: dict, description: str) -> dict:
    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="AI response JSON must be an object")

    node_data = data.get("nodeDataArray")
    link_data = data.get("linkDataArray")
    if not isinstance(node_data, list):
        raise HTTPException(status_code=502, detail="Boxology JSON must include nodeDataArray")
    if not isinstance(link_data, list):
        raise HTTPException(status_code=502, detail="Boxology JSON must include linkDataArray")

    data["class"] = "GraphLinksModel"
    raw_model_data = data.get("modelData")
    model_data = raw_model_data if isinstance(raw_model_data, dict) else {}
    description_hash = int(hashlib.md5(description.encode("utf-8")).hexdigest(), 16)
    model_data.setdefault("boxologyId", f"ai-boxology-{description_hash % 1000000}")
    model_data.setdefault("boxologyLabel", "AI Generated Boxology")
    model_data.setdefault("boxologyDescription", description[:500])
    data["modelData"] = model_data

    seen_keys = set()
    for index, node in enumerate(node_data, start=1):
        if not isinstance(node, dict):
            raise HTTPException(status_code=502, detail="Every nodeDataArray item must be an object")
        node.setdefault("key", f"node_{index}")
        if node["key"] in seen_keys:
            node["key"] = f"{node['key']}_{index}"
        seen_keys.add(node["key"])

        if node.get("isGroup"):
            node.setdefault("category", "ClusterGroup")
            node.setdefault("label", f"Stage {index}")
            continue

        normalized_name = _infer_boxology_root(node)
        style = BOXOLOGY_STYLE_BY_NAME[normalized_name]
        node["name"] = normalized_name
        node.setdefault("label", normalized_name)
        node["type"] = _normalize_boxology_type(normalized_name, node.get("type"), node.get("label"))
        node["shape"] = style["shape"]
        node["color"] = style["color"]
        node["stroke"] = style["stroke"]
        node.setdefault("loc", f"{(index - 1) * 180} 120")
        node.setdefault("width", 180)
        node.setdefault("height", 60)
        if normalized_name in BOXOLOGY_PROCESS_ROOTS:
            node.setdefault("parameter1", 45)
        _normalize_shared_groups(node)

    group_keys = {str(node.get("key")) for node in node_data if isinstance(node, dict) and node.get("isGroup")}
    group_label_to_key = {
        str(node.get("label")): str(node.get("key"))
        for node in node_data
        if isinstance(node, dict) and node.get("isGroup") and node.get("label") and node.get("key")
    }

    for node in node_data:
        if not isinstance(node, dict) or node.get("isGroup"):
            continue

        raw_group = node.get("group")
        if raw_group is not None:
            group_text = str(raw_group)
            node["group"] = group_label_to_key.get(group_text, group_text)

        mapped_shared_groups = []
        for group in node.get("sharedGroups", []):
            group_text = str(group)
            mapped_group = group_label_to_key.get(group_text, group_text)
            if mapped_group in group_keys and mapped_group not in mapped_shared_groups:
                mapped_shared_groups.append(mapped_group)

        if node.get("name") in BOXOLOGY_PROCESS_ROOTS:
            if not node.get("group") and mapped_shared_groups:
                node["group"] = mapped_shared_groups[0]
            node["isShared"] = False
            node["sharedGroups"] = []
            continue

        node["sharedGroups"] = mapped_shared_groups
        node["isShared"] = bool(node.get("isShared")) and len(mapped_shared_groups) > 0
        if len(mapped_shared_groups) > 1:
            node["isShared"] = True
        if node["isShared"]:
            node.pop("group", None)

    for link in link_data:
        if not isinstance(link, dict):
            raise HTTPException(status_code=502, detail="Every linkDataArray item must be an object")
        if link.get("from") not in seen_keys or link.get("to") not in seen_keys:
            raise HTTPException(status_code=502, detail="Every link must reference existing node keys")

    return data

def _latest_user_description(messages: list) -> str:
    for message in reversed(messages):
        if isinstance(message, dict) and message.get("role") == "user":
            return str(message.get("content") or "")
    return ""

def _chat_provider_text(
    provider: str,
    api_key: str,
    model_id: str,
    messages: list,
    max_tokens: int,
    system_prompt: str | None,
    use_skill: bool = False,
) -> str:
    if provider == "openai":
        from skill_handler import chat_with_openai
        return chat_with_openai(api_key, model_id, messages, max_tokens, system_prompt)

    if provider == "claude":
        from skill_handler import chat_with_claude
        return chat_with_claude(api_key, model_id, messages, max_tokens, system_prompt)

    if provider == "gemini":
        from skill_handler import chat_with_gemini
        return chat_with_gemini(api_key, model_id, messages, max_tokens, system_prompt)

    if provider in ["huggingface", "local"]:
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)
        result = _chat_with_hugging_face(
            model_id,
            api_key,
            full_messages,
            max_tokens,
            temperature=0 if use_skill else 0.7,
        )
        return result["response"]

    raise HTTPException(status_code=400, detail=f"Provider '{provider}' not implemented")

def _plan_boxology_architecture(
    llm,
    provider: str,
    api_key: str,
    model_id: str,
    messages: list,
) -> str:
    planner_prompt = (
        llm.get_planning_prompt()
        if hasattr(llm, "get_planning_prompt")
        else "Plan a Tool4Boxology architecture as strict JSON."
    )
    user_description = _latest_user_description(messages)
    planner_messages = [
        {
            "role": "user",
            "content": (
                "Create the intermediate architecture plan for this Tool4Boxology request.\n\n"
                f"User description:\n{user_description}"
            ),
        }
    ]
    return _chat_provider_text(
        provider,
        api_key,
        model_id,
        planner_messages,
        1800,
        planner_prompt,
        use_skill=True,
    )

def _fresh_kg_module():
    # Drop any cached kg_creation modules
    for name in list(sys.modules.keys()):
        if name.startswith("kg_creation"):
            del sys.modules[name]
    import kg_creation.kg_creation as kg_module
    importlib.reload(kg_module)  # ensure fresh code + globals
    return kg_module

@app.post("/api/kg")
def api_create_kg(source: dict):
    try:
        ids = [b.get("id") for b in source.get("boxologies", [])]
        print(f"[API] incoming boxologies={ids}")
        kg_module = _fresh_kg_module()
        result = kg_module.create_kg(source)  # create_kg returns dict (after you implement)
        if not isinstance(result, dict):
            result = {"mode": "unknown"}
        return {
            "status": "ok",
            "mode": result.get("mode"),
            "triples_len": result.get("triples_len"),
            "rdf": result.get("rdf"),
            "rdf_format": result.get("rdf_format"),
        }
    except (URLError, TimeoutError) as e:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=f"Virtuoso connection error: {str(e)}")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/t4b/sparql")
def api_t4b_sparql(payload: dict):
    query = (payload.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Missing SPARQL query")
    try:
        sparql = SPARQLWrapper(SPARQL_ENDPOINT)
        sparql.setReturnFormat(JSON)
        sparql.setQuery(query)
        return sparql.query().convert()
    except (URLError, TimeoutError) as e:
        traceback.print_exc()
        raise HTTPException(status_code=503, detail=f"Virtuoso connection error: {str(e)}")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/")
async def root():
    return {"status": "running", "sparql_query": SPARQL_ENDPOINT, "sparql_update": SPARQL_UPDATE_ENDPOINT}

@app.get("/api/health")
async def api_health():
    return {
        "status": "ok",
        "service": "boxology-backend",
        "sparql_query": SPARQL_ENDPOINT,
        "sparql_update": SPARQL_UPDATE_ENDPOINT,
    }


@app.post("/api/llm/boxology")
def api_generate_boxology(payload: dict):
    """
    Generate a Tool4Boxology .boxology model from a natural-language system description
    using hosted Hugging Face inference.
    """
    try:
        model_id = (payload.get("model_id") or DEFAULT_HF_MODEL_ID).strip()
        hf_token = payload.get("hf_token", "")
        description = (payload.get("description") or "").strip()

        if not hf_token:
            raise HTTPException(status_code=400, detail="Hugging Face token required")
        if not description:
            raise HTTPException(status_code=400, detail="System description required")

        config_module = get_llm_config()
        system_prompt = config_module.get_system_prompt() if config_module else BOXOLOGY_GENERATOR_SYSTEM_PROMPT

        result = _chat_with_hugging_face(
            model_id,
            hf_token,
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": description},
            ],
            int(payload.get("max_tokens", HF_BOXOLOGY_MAX_TOKENS)),
            temperature=0,
        )
        try:
            raw_boxology = _extract_json_object(result["response"])
        except HTTPException as e:
            raw_boxology = _repair_json_with_hugging_face(
                model_id,
                hf_token,
                result["response"],
                str(e.detail),
            )

        boxology = _normalize_boxology_model(raw_boxology, description)
        label = boxology["modelData"].get("boxologyLabel") or "AI Generated Boxology"
        safe_label = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in label).strip("_")
        filename = f"{safe_label or 'ai_generated_boxology'}.boxology"

        node_count = len([n for n in boxology["nodeDataArray"] if not n.get("isGroup")])
        group_count = len([n for n in boxology["nodeDataArray"] if n.get("isGroup")])
        link_count = len(boxology["linkDataArray"])
        return {
            "status": "ok",
            "provider": "huggingface",
            "model_id": model_id,
            "filename": filename,
            "boxology": boxology,
            "explanation": (
                f"Generated {node_count} components, {group_count} groups, and "
                f"{link_count} links as a Tool4Boxology GraphLinksModel."
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# NEW ENDPOINTS: Multi-LLM Provider Support + Skill Download
# ============================================================================

from pathlib import Path
from fastapi.responses import FileResponse, StreamingResponse
import io

# Lazy imports to avoid import errors
def get_llm_config():
    try:
        import sys
        import os
        sys.path.insert(0, os.path.dirname(__file__))
        import llm_config
        return llm_config
    except ImportError:
        return None

SKILL_FILE_PATH = Path(__file__).parent.parent / "public" / "download" / "boxology-ai-skill-restored.md"

@app.get("/api/skill/download")
async def download_skill():
    """Download the Boxology AI Skill as markdown file"""
    try:
        if not SKILL_FILE_PATH.exists():
            raise HTTPException(status_code=404, detail="Skill file not found")

        return FileResponse(
            path=SKILL_FILE_PATH,
            filename="boxology-ai-skill.md",
            media_type="text/markdown"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/skill/content")
async def get_skill_content():
    """Get Boxology AI Skill content as JSON"""
    try:
        if not SKILL_FILE_PATH.exists():
            config = get_llm_config()
            default_skill = config.get_system_prompt() if config else ""
            return {"skill": default_skill}

        with open(SKILL_FILE_PATH, 'r') as f:
            skill_content = f.read()

        return {
            "skill": skill_content,
            "version": "1.0.0",
            "name": "boxology-diagram-generator",
            "downloadable": True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/llm/providers")
async def list_llm_providers():
    """List all available LLM providers and their models"""
    try:
        llm = get_llm_config()
        if not llm:
            raise HTTPException(status_code=500, detail="LLM config module not available")

        providers = llm.list_providers()
        result = {}

        for provider_key, config in providers.items():
            result[provider_key] = {
                "name": config.get("name"),
                "models": config.get("models", []),
                "requires": config.get("requires", []),
                "auth_type": config.get("auth_type"),
                "free_tier": config.get("free_tier"),
                "docs": config.get("docs"),
                "local_inference": config.get("local_inference", False)
            }

        return {
            "providers": result,
            "skill_available": SKILL_FILE_PATH.exists(),
            "skill_download_url": "/api/skill/download"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/llm/providers/{provider}/models")
async def get_provider_models(provider: str):
    """Get available models for a specific provider"""
    try:
        llm = get_llm_config()
        if not llm:
            raise HTTPException(status_code=500, detail="LLM config module not available")

        config = llm.get_provider_config(provider)
        if not config:
            raise HTTPException(status_code=404, detail=f"Provider '{provider}' not found")

        return {
            "provider": provider,
            "provider_name": config.get("name"),
            "models": config.get("models", []),
            "requires": config.get("requires", []),
            "docs": config.get("docs")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/llm/chat")
def chat_with_llm(payload: dict):
    """
    Chat with any LLM provider using the Boxology AI Skill

    Request body:
    {
        "provider": "openai|claude|gemini|huggingface|local",
        "model_id": "gpt-4|claude-3-opus|gemini-2.0-flash|...",
        "api_key": "...",  // API key for provider
        "messages": [
            {"role": "user", "content": "..."}
        ],
        "max_tokens": 4096,
        "use_boxology_skill": true  // Use Boxology AI Skill as system prompt
    }
    """
    try:
        llm = get_llm_config()
        if not llm:
            raise HTTPException(status_code=500, detail="LLM config module not available")

        provider = payload.get("provider", "").lower()
        model_id = payload.get("model_id", "")
        api_key = payload.get("api_key", "")
        messages = payload.get("messages", [])
        max_tokens = int(payload.get("max_tokens", 4096))
        use_skill = payload.get("use_boxology_skill", True)

        if isinstance(api_key, str) and api_key.strip().lower().startswith(("http://", "https://")):
            raise HTTPException(
                status_code=400,
                detail="The credential field contains a URL. Paste the API key/token, not the API base URL.",
            )

        # Validate provider
        config = llm.get_provider_config(provider)
        if not config:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
        if not model_id:
            models = config.get("models") or []
            if models:
                model_id = models[0].get("id", "")

        # Validate credentials
        creds = {"api_key": api_key}
        if provider in ["huggingface", "local"]:
            creds["hf_token"] = api_key
            creds["model_id"] = model_id

        valid, msg = llm.validate_credentials(provider, creds)
        if not valid:
            raise HTTPException(status_code=400, detail=msg)

        # Get system prompt
        system_prompt = llm.get_system_prompt() if use_skill else payload.get("system_prompt")
        architecture_plan = None
        user_description = _latest_user_description(messages)

        if use_skill:
            architecture_plan = _plan_boxology_architecture(llm, provider, api_key, model_id, messages)
            generation_messages = [
                {
                    "role": "user",
                    "content": (
                        "Generate the final Tool4Boxology .boxology GraphLinksModel JSON from this plan.\n"
                        "Use the plan keys exactly when possible. Use group keys, not group labels, in group/sharedGroups references. "
                        "Ensure linkDataArray is complete and non-empty for a multi-stage system.\n\n"
                        f"Original user description:\n{user_description}\n\n"
                        f"Architecture plan JSON:\n{architecture_plan}"
                    ),
                }
            ]
            response_text = _chat_provider_text(
                provider,
                api_key,
                model_id,
                generation_messages,
                max_tokens,
                system_prompt,
                use_skill=True,
            )
        else:
            response_text = _chat_provider_text(
                provider,
                api_key,
                model_id,
                messages,
                max_tokens,
                system_prompt,
                use_skill=False,
            )

        if use_skill:
            try:
                raw_boxology = _extract_json_object(response_text)
            except HTTPException as e:
                if provider in ["huggingface", "local"]:
                    raw_boxology = _repair_json_with_hugging_face(model_id, api_key, response_text, str(e.detail))
                else:
                    raise HTTPException(
                        status_code=502,
                        detail=f"The AI did not return a valid Boxology JSON object: {e.detail}",
                    )

            boxology = _normalize_boxology_model(raw_boxology, user_description)
            label = boxology["modelData"].get("boxologyLabel") or "AI Generated Boxology"
            safe_label = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in label).strip("_")
            filename = f"{safe_label or 'ai_generated_boxology'}.boxology"
            pretty_json = json.dumps(boxology, indent=2)

            return {
                "status": "ok",
                "provider": provider,
                "model_id": model_id,
                "response": pretty_json,
                "used_boxology_skill": True,
                "filename": filename,
                "boxology": boxology,
                "architecture_plan": architecture_plan,
                "explanation": "Generated a Tool4Boxology GraphLinksModel file.",
            }

        return {
            "status": "ok",
            "provider": provider,
            "model_id": model_id,
            "response": response_text,
            "used_boxology_skill": use_skill
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/llm/validate")
def validate_llm_credentials(payload: dict):
    """Validate LLM provider credentials"""
    try:
        provider = payload.get("provider", "").lower()
        api_key = (payload.get("api_key") or "").strip()
        model_id = (payload.get("model_id") or "").strip()

        llm = get_llm_config()
        if not llm:
            raise HTTPException(status_code=500, detail="LLM config module not available")

        config = llm.get_provider_config(provider)
        if not config:
            raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")
        if api_key.lower().startswith(("http://", "https://")):
            return {
                "valid": False,
                "provider": provider,
                "error": "This is an endpoint URL. Paste the API key/token instead.",
            }
        if not model_id:
            models = config.get("models") or []
            if models:
                model_id = models[0].get("id", "")

        creds = {"api_key": api_key}
        if provider in ["huggingface", "local"]:
            creds["hf_token"] = api_key
            creds["model_id"] = model_id

        valid, msg = llm.validate_credentials(provider, creds)
        if not valid:
            return {"valid": False, "provider": provider, "error": msg}

        msg = _validate_remote_credentials(provider, api_key, model_id)

        return {
            "valid": True,
            "provider": provider,
            "message": msg
        }
    except HTTPException as e:
        return {"valid": False, "provider": payload.get("provider", ""), "error": str(e.detail)}
    except Exception as e:
        traceback.print_exc()
        return {"valid": False, "error": str(e)}
