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

Useful `type` values from `shapeTypesTree`: `Dataset`, `Image`, `Tensor`, `Text`, `Audio`, `Video`, `Table`, `TimeSeries`, `Number`, `Label`, `Trace`, `Rules`, `KG`, `Human`, `Robot`, `NeuralModel`, `NeuralNetwork`, `CNN`, `RNN`, `Transformer`, `GNN`, `LLM`, `SemanticModel`, `OWLOntology`, `RDFModel`, `RuleBasedModel`, `StatisticalModel`, `ClassificationModel`, `ClusteringModel`, `HybridModel`, `Transform`, `Train`, `Deduce`, `Engineer`.

## Elementary Grammar

Each cluster should normally contain one process node and its input/output artifacts.

- `Data/Symbol/Model -> Transform -> Data/Symbol/Model`
- `Data/Symbol/Model -> Train -> Model`
- `Actor` plus optional `Data/Symbol/Model -> Engineer -> Data/Symbol/Model`
- `Model` plus `Data/Symbol/Model evidence -> Deduce -> Data/Symbol/Model`

Hard rules:

- Every process has at least one input and exactly one output target (`Data`, `Symbol`, or `Model`).
- `Train` outputs `Model`.
- `Deduce` requires a `Model` input plus evidence (`Data`, `Symbol`, or a second `Model`).
- Do not connect process-to-process directly. Insert the artifact between them, e.g. `Train -> Model -> Deduce`.
- Process nodes should include `parameter1: 45`.

## Clustering

Use one `ClusterGroup` per meaningful stage. Good labels are ordered and specific:

- `1c Annotation`
- `1d Preprocessing`
- `1d Feature Extraction`
- `1a Training`
- `2a Detection`
- `2b Symbolic Reasoning`
- `3a Explanation`

Every non-shared node must have `group` referencing an existing group.

Shared nodes are reused artifacts, never processes. For a shared trained model, rule set, ontology, map, labels, or dataset:

- set `isShared: true`
- set `sharedGroups` to all related group keys
- omit `group` or set it to `null`

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
- If supervised training lacks labels, add `Actor + Data -> Engineer -> Symbol`.
- If raw data goes directly to training/inference, add a `Transform` preprocessing stage when appropriate.
- If rules, maps, ontologies, or parking-space maps are mentioned, model them as `Symbol`, not `Data`.
- If the same model/rules/map is reused, make one shared artifact node.

## Checklist

- JSON parses and has `class`, `modelData`, `nodeDataArray`, `linkDataArray`.
- Every root `name` is canonical.
- Shape/color/stroke match the root.
- All non-shared nodes are clustered.
- No process node is shared.
- All links reference existing keys.
- Every process has inputs and exactly one output.
- `Deduce` has model plus evidence.
- Labels are concise and domain-specific.
