---
name: boxology-diagram-generator
description: Convert natural-language neuro-symbolic AI system descriptions into valid Tool4Boxology .boxology / GoJS GraphLinksModel files. Use the Tool4Boxology component vocabulary, elementary process grammar, clustering rules, shared artifact rules, and Kautz neuro-symbolic pattern hints.
---

# Boxology Diagram Generator

Turn a prose description of a neuro-symbolic AI system into a Tool4Boxology `.boxology` file that opens on the canvas, validates as elementary Boxology patterns, and remains useful for KG export/querying.

Tool4Boxology models NeSy architectures as semantic components and interconnections. A good file is not just a visual workflow: it should encode reusable architecture patterns with stable root component names, valid process input/output structure, clusters, and shared artifacts.

## Output Contract

Return one strict JSON object only when called by the application.

```json
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
```

Do not emit KG export JSON with `DesignPattern`, `input`, `process`, or `output` arrays. The editor import format is the flat GoJS `nodeDataArray` plus `linkDataArray`.

## Component Vocabulary

The app validates by stable node `name`. Use exactly one canonical root in `name`; put subtype in `type`; put domain text in `label`.

| `name` | Meaning | shape | color | stroke |
| --- | --- | --- | --- | --- |
| `Data` | datasets, images, tensors, text, audio, video, tables, time series, numeric observations | `Rectangle` | `#c4e8ffff` | `#1E5F8B` |
| `Symbol` | labels, traces, rules, classes, ontologies, KGs, maps, explanations, constraints | `Rectangle` | `#d1f0c9ff` | `#218721ff` |
| `Actor` | humans, experts, robots, agents | `Triangle` | `#ffdcabff` | `#9c6921` |
| `Model` | neural, statistical, semantic, hybrid, embedding, detector, classifier, LLM, ontology, rule, solver models | `Hexagon` | `#edd3f3ff` | `#8B4F8B` |
| `Transform` | preprocessing, normalization, aggregation, embedding, feature extraction, alignment, conversion | `RoundedRectangle` | `#fbf1b0ff` | `#B8A600` |
| `Train` | learning, fitting, fine-tuning, optimization | `RoundedRectangle` | `#ffc2a0` | `#c05f30` |
| `Deduce` | inference, prediction, classification, detection, reasoning | `RoundedRectangle` | `#ffcdcd` | `#4c003bff` |
| `Engineer` | annotation, labeling, rule/ontology/map/model construction by an actor | `RoundedRectangle` | `#f6d6cf` | `#b85068` |

Avoid `comment` unless the user explicitly asks for notes.

Useful `type` values from `shapeTypesTree`: `Dataset`, `Image`, `Tensor`, `Text`, `Audio`, `Video`, `Table`, `TimeSeries`, `Number`, `Label`, `Trace`, `Rules`, `KG`, `Human`, `Robot`, `NeuralModel`, `NeuralNetwork`, `CNN`, `RNN`, `Transformer`, `GNN`, `LLM`, `SemanticModel`, `OWLOntology`, `RDFModel`, `RuleBasedModel`, `StatisticalModel`, `ClassificationModel`, `ClusteringModel`, `Transform`, `Train`, `Deduce`, `Engineer`.

`type` is a closed vocabulary per root, not free text — pick one of these, never invent a new one:

- `Data`: `Number`, `Dataset`, `Tensor`, `Text`, `Image`, `Audio`, `Video`, `TimeSeries`, `Table`
- `Symbol`: `Trace`, `Label`, `Rules`, `KG`, `DB`
- `Actor`: `Human`, `Robot`
- `Model`: the `shapeTypesTree` model branch (`NeuralModel`, `NeuralNetwork`, `CNN`, `RNN`, `LSTM`, `GRU`, `Transformer` and its variants, `GNN`/`GCN`/`GAT`, `LLM`, `SemanticModel`, `OWLOntology`, `RDFModel`, `RuleBasedModel`, `StatisticalModel`, `RegressionModel`, `ClassificationModel`, `ClusteringModel`, `FuzzyModel`, `InductiveModel` and its branch)
- `Transform`: `transform`, `embed`, `Normalize`, `aggregate`
- `Train`: `training`, `Symbolic Learning`, `Statistical Learning`, `Deep Learning`, `Reinforcement Learning`
- `Deduce`: `deduce`, `classification`, `prediction` — detection/forecasting/reasoning/diagnosis/clustering-as-a-step all normalize to `prediction` unless it's specifically a discrete-label task, then use `classification`
- `Engineer`: `engineering`

If nothing fits, fall back to the root's own name as `type` and keep the exact wording in `label` instead.

## Process Synonym Mapping

The ontology has finer process subclasses (`Infer`, `Induce`, `Embed`, `Generate`) than the tool exposes as drawable shapes. Only `Transform`, `Train`, `Deduce`, `Engineer` are real shapes. Map anything else to the closest one and keep the domain word in `label`, never in `name`:

- **-> `Deduce`**: predict/prediction, classify/classification, detect/detection, forecast, infer/inference, induce/induction, reason/reasoning, diagnose/diagnosis. (`Infer`/`Induce` are not separate shapes.)
- **-> `Train`**: fit/fitting, fine-tune, optimize/optimization, learn/learning.
- **-> `Transform`**: preprocess, normalize/normalization, augment, clean, align/alignment, extract features, convert/conversion, resize, embed/embedding. (`Embed` is not a separate shape; it's `Transform` with `type: embed`.)
- **-> `Engineer`**: annotate/annotation, label/labeling (the action, not the `Symbol` artifact), author/authoring, curate, design a rule set/ontology/map.

Never invent a process root outside these four, and never rename a process node to its domain task (a prediction step is `name: Deduce`, not `name: Predict`).

## Elementary Grammar

Each cluster should normally contain one process node and its input/output artifacts.

- `Data/Symbol/Model -> Transform -> Data/Symbol/Model`
- `Data/Symbol/Model -> Train -> Model`
- `Actor` plus optional `Data/Symbol/Model -> Engineer -> Data/Symbol/Model`
- `Model` plus `Data/Symbol/Model evidence -> Deduce -> Data/Symbol/Model`

### Enforced Connectivity Grammar (`validNext`)

Use this generation grammar, a subset of the editor connectivity rules. Editor-only merge links are not architecture data flow. Only emit a link `A -> B` when `B` appears after `A` below:

| From | May link to |
| --- | --- |
| `Actor` | `Engineer`, `Transform`, `Deduce` |
| `Symbol` | `Transform`, `Train`, `Engineer`, `Deduce` |
| `Data` | `Transform`, `Train`, `Engineer`, `Deduce` |
| `Model` | `Transform`, `Train`, `Engineer`, `Deduce` |
| `Transform` | `Data`, `Symbol`, `Model` |
| `Train` | `Model` |
| `Engineer` | `Data`, `Symbol`, `Model` |
| `Deduce` | `Data`, `Symbol`, `Model` |

A link between two process nodes (`Transform`, `Train`, `Deduce`, `Engineer`) is never valid in either direction. Every link is artifact -> process or process -> artifact.

### Elementary Pattern Library (`allPatterns`)

Every process node's inputs+output must match one of these exact shapes — the same fixed library the editor's "insert pattern" menu offers users. Never invent a combination outside this library; pick the closest one and adjust labels/types, not the structure.

- **`Train`** (always outputs `Model`): `{Symbol}`, `{Data}`, `{Model, Data}`, `{Model, Symbol}` `-> Train ->` `Model`
- **`Transform`** (output is `Data`, `Symbol`, or `Model`): `{Symbol} -> Data`, `{Data} -> Data`, `{Data} -> Symbol`, `{Symbol} -> Symbol`, `{Model} -> Model`, `{Symbol, Data} -> Data`, `{Symbol, Data} -> Model` (an embedding step, `type: embed`)
- **`Engineer`** (`Actor` required; output is `Data`, `Symbol`, or `Model`): `{Actor}`, `{Actor, Data}`, `{Actor, Symbol}`, `{Actor, Model}` `-> Engineer ->` any one of `Data`/`Symbol`/`Model`
- **`Deduce`** (`Model` required plus one evidence input; output is exactly one of `Data`/`Symbol`/`Model`): `{Model, Symbol}`, `{Model, Data}`, `{Model, Model}` (two cooperating models) may output `Data` or `Symbol`; the other pairs may output `Data`, `Symbol`, or `Model`

Hard rules:

- Every process has at least one input and exactly one output target (`Data`, `Symbol`, or `Model`).
- `Train` outputs `Model`.
- `Deduce` requires a `Model` input plus evidence (`Data`, `Symbol`, or a second `Model`).
- Two process nodes must never link directly to each other, in either direction. Insert the artifact between them, e.g. `Train -> Model -> Deduce`, never `Train -> Deduce`. A link is always artifact-to-process or process-to-artifact.
- Process nodes should include `parameter1: 45`.

## Clustering

Use one `ClusterGroup` per meaningful stage with exactly one process in it.
Name clusters after activities actually described by the user, in dependency order.
The number and kinds of stages must follow the description; there is no fixed
sequence of annotation, preprocessing, training, inference, or explanation.

Every non-shared node must have `group` referencing an existing group.

Shared nodes are reused artifacts, never processes. For a shared trained model, rule set, ontology, map, labels, or dataset:

- set `isShared: true`
- set `sharedGroups` to all related group keys
- omit `group` (GoJS does not accept an explicit `null` group key)

Do not duplicate the same artifact in multiple groups.

## Kautz Pattern Hints

Use these when the user describes a recognizable neuro-symbolic architecture:

- `Symbolic > Neuro`: symbolic knowledge guides neural learning/prediction.
- `Neuro > Symbolic`: neural outputs feed a symbolic solver/reasoner; label the deduction `ss:deduce`.
- `Neuro + Symbolic`: neural and symbolic models cooperate in one reasoning step; label `co:deduce`.
- `Neuro: Symbolic > Neuro`: symbolic rules/annotations influence neural training.
- `Neuro {Symbolic}`: symbolic rules are encoded into a neural model via `Transform`.
- `Neuro [Symbolic]`: a symbolic reasoner is embedded/invoked inside a neural architecture; label `nn:deduce`.

These are labels or design intentions; the root `name` remains `Deduce`, `Model`, `Symbol`, etc.

## Common Repairs

- If the user says "train labels/symbols," repair to `Train -> Model`, then `Deduce -> Symbol`.
- Model annotation when the description includes it. Do not invent human labeling for unsupervised or already-labeled data. Pair observations and labels with `Data + Symbol -> Transform -> Data` before `Train`.
- Add preparation only when described or required to assemble an input. Do not add preprocessing automatically.
- If rules, maps, ontologies, or parking-space maps are mentioned, model them as `Symbol`, not `Data`.
- If the same model/rules/map is reused, make one shared artifact node.
- Use `Deduce` for prediction, classification, detection, forecasting, clustering-as-inference, reasoning, and induction. Use `Engineer` for annotation. Use `Transform` for normalization. Keep task wording in `label`, not `name`.

## Checklist

- JSON parses and has `class`, `modelData`, `nodeDataArray`, `linkDataArray`.
- Every root `name` is canonical.
- Shape/color/stroke match the root.
- All non-shared nodes are clustered.
- No process node is shared.
- All links reference existing keys.
- Every link matches a row in the Enforced Connectivity Grammar (`validNext`) table.
- Every process's input/output shape matches an entry in the Elementary Pattern Library (`allPatterns`).
- Every process has inputs and exactly one output.
- `Deduce` has model plus evidence.
- Labels are concise and domain-specific.


## Description fidelity

The description determines the architecture; do not start from a fixed workflow.
Represent every explicit stage, actor, resource, and dependency. Use supporting stages
only when required by the elementary grammar, and identify assumptions in the description.
Distinguish a learned model from the process that trains it and from the inference that
uses it. Distinguish symbolic rules from the executable rule model used with evidence.
Connect upstream outputs to downstream inputs through shared artifacts. Never omit a
stage merely to shorten JSON. A structurally valid graph can still misrepresent a request;
check both structure and coverage of the user's description before returning it.
