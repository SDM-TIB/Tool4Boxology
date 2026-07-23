![Tool4Boxology logo](images/Logo-tool4boxology.png)

# 🧰 Tool4Boxology — Hybrid AI Design Toolkit

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.17711495.svg)](https://doi.org/10.5281/zenodo.17711495)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](LICENSE-CC-BY-4.0)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
![Version](https://img.shields.io/badge/version-v1.0.0-blueviolet)
![React](https://img.shields.io/badge/React-19-61DAFB)
![GoJS](https://img.shields.io/badge/built%20with-GoJS-blue)
![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6)
![Docker Compose](https://img.shields.io/badge/DevOps-Docker%20Compose-2496ED)

Tool4Boxology is a toolkit for designing, validating, generating, and exporting
hybrid and neuro-symbolic AI system architectures using the Boxology
methodology.

[![Live demo](https://img.shields.io/badge/Live-Demo-green)](https://tool4boxology.service.tib.eu/)

The recommended entry point is the `Boxology-Interface` web application. It
combines a React and GoJS diagram editor, Boxology and Kautz pattern validation,
knowledge-graph generation, Virtuoso integration, and an AI-assisted
natural-language-to-Boxology workflow.

## What's new

- **Boxology AI Assistant:** describe a system in natural language and generate
  a valid `.boxology` GoJS `GraphLinksModel`, then open it directly in the
  editor or download it.
- **Multiple LLM providers:** the assistant supports OpenAI, Google Gemini,
  Anthropic Claude, and Hugging Face. Provider credentials are validated before
  a chat starts.
- **Optional Boxology generation skill:** the assistant can use a structured
  planning and generation prompt that enforces canonical components, process
  rules, clustering, shared artifacts, layout, and valid links.
- **Expanded Kautz patterns:** the palette and validators cover the six Kautz
  neuro-symbolic categories, including composed patterns and specialized
  `co:deduce`, `ss:deduce`, `nn:deduce`, and `transform:embed` processes.
- **Clearer validation feedback:** selection and whole-diagram checks now report
  elementary Boxology and Kautz results together, including invalid links,
  process cardinality, and missing model/evidence inputs.
- **Improved component typing:** newly created and edited components retain
  canonical root names while domain-specific meaning is represented by their
  label and type.
- **Runtime/API fixes:** frontend-to-backend routing works consistently in local
  and Docker development, including the AI Assistant endpoints.

## Main features

- Drag-and-drop `Data`, `Symbol`, `Actor`, `Model`, `Transform`, `Train`,
  `Deduce`, and `Engineer` components
- Semantic links, stage clusters, shared artifacts, and stable component IDs
- Real-time elementary Boxology and Kautz pattern validation
- Natural-language diagram generation with the Boxology AI Assistant
- Knowledge-graph generation and RDF/Turtle export
- Virtuoso upload, browsing, and SPARQL access
- JSON, styled JSON/`.boxology`, RDF/Turtle, DOT, and PNG export
- Reloadable diagrams with their visual layout and styling preserved
- Optional Draw.io distribution with Boxology libraries preinstalled

## Repository structure

| Path | Purpose |
|---|---|
| `Boxology-Interface/` | Main React, TypeScript, GoJS, and FastAPI application |
| `Boxology-Docker/` | Dockerized Draw.io with the Boxology plugin and libraries |
| `Boxology-Plugin/` | Standalone Draw.io plugin and Boxology shape libraries |
| `kg_creation/` | RML mappings, RDF generation, RDFizer integration, and SPARQL utilities |
| `KG/` | Knowledge-graph assets |
| `Ontology/` | Boxology ontology resources |
| `ElementaryPattern/` | Reusable elementary patterns in DOT format |
| `NeSy-Example/` | Neuro-symbolic system examples |
| `report/` | Project documentation and development material |

## Getting started

### Prerequisites

- Node.js 18 or newer and npm 9 or newer
- Python 3.8 or newer
- Docker and Docker Compose for the complete local stack

### Docker Compose (recommended)

From the repository root:

```bash
cd Boxology-Interface
docker compose up -d --build
```

This starts:

| Service | URL |
|---|---|
| Web interface | <http://localhost:5173> |
| FastAPI backend | <http://localhost:8000> |
| API documentation | <http://localhost:8000/docs> |
| Virtuoso SPARQL endpoint | <http://localhost:8890/sparql> |
| Virtuoso Conductor | <http://localhost:8890/conductor> |

To follow the services:

```bash
docker compose logs -f
```

To stop them:

```bash
docker compose down
```

### Manual development

Start Virtuoso:

```bash
docker run -d --name boxology_kg -p 8890:8890 kemele/virtuoso:7-stable
```

Create a Python environment and start the backend from
`Boxology-Interface/`:

```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend --reload-dir src
```

In a second terminal:

```bash
cd Boxology-Interface
npm install
npm run dev
```

Open <http://localhost:5173>.

## Using the Boxology AI Assistant

1. Open the web interface and select **AI Assistant**.
2. Choose OpenAI, Google Gemini, Anthropic Claude, or Hugging Face.
3. Select a model, paste the provider API key or access token, and validate it.
4. Keep **Boxology skill** enabled to generate a structured diagram, or disable
   it for general chat.
5. Describe the architecture. A generated `.boxology` artifact can be opened in
   the editor or downloaded.

The current UI exposes these model families:

| Provider | Models |
|---|---|
| OpenAI | GPT-4.1, GPT-4.1 Mini, GPT-4o Mini |
| Google Gemini | Gemini 3.5 Flash, Gemini 3.1 Flash Lite |
| Anthropic Claude | Claude Sonnet 5, Claude Opus 4.8, Claude Haiku 4.5 |
| Hugging Face | GPT-OSS 120B, GPT-OSS 120B (Fastest) |

Provider credentials are entered at runtime; no provider key is required to
build or start Tool4Boxology. Availability and account access for individual
models are controlled by the respective provider.

## Validation

Tool4Boxology checks both elementary process rules and composed Kautz
neuro-symbolic patterns.

Elementary validation includes:

- every process has an input and exactly one artifact output;
- `Train` outputs a `Model`;
- `Deduce` receives a model plus data, a symbol, or a second model as evidence;
- process nodes are not connected directly to other process nodes; and
- link endpoints and component types are compatible.

Kautz validation recognizes:

1. Symbolic → Neuro
2. Neuro → Symbolic
3. Neuro + Symbolic
4. Neuro: Symbolic → Neuro
5. Neuro {Symbolic}
6. Neuro [Symbolic]

Validation can be run for the current selection or the complete diagram. The KG
viewer also includes a **Validate Kautz** action.

## Typical workflow

1. Create a system manually or generate a first draft with the AI Assistant.
2. Organize processes into meaningful clusters and reuse shared artifacts.
3. Validate elementary and Kautz patterns.
4. Export a styled `.boxology` file for later editing.
5. Generate RDF/Turtle and upload the knowledge graph to Virtuoso.
6. Query the architecture with SPARQL or export it as DOT or PNG.

## Example

> A sample hybrid AI pipeline created with Tool4Boxology.

![Example Tool4Boxology diagram](images/DiagramExample2.png)

> Validation feedback for a diagram.

![Example validation result](images/ValidationExample2.png)

## Optional Draw.io distribution

`Boxology-Docker` provides a Draw.io image with the validation plugin, pattern
libraries, shape libraries, annotations, and sidebar previews preinstalled.

```bash
cd Boxology-Docker
docker build -t boxology-drawio .
docker run --name boxology-drawio -p 8080:8080 boxology-drawio
```

Open <http://localhost:8080>. See
[`Boxology-Docker/README.md`](Boxology-Docker/README.md) for module-specific
details.

## Technology

- React 19, TypeScript, Vite, Material UI
- GoJS
- FastAPI and Uvicorn
- Virtuoso and SPARQL
- Graphviz and RDF tooling
- Docker Compose

## License

- Diagrams, documentation, and educational assets: [CC BY 4.0](LICENSE-CC-BY-4.0)
- Software and extended modules: [Apache License 2.0](LICENSE)

GoJS is used for diagram rendering. Check the
[GoJS licensing terms](https://gojs.net/latest/license.html) when deploying the
editor.

## Publication

If you use Tool4Boxology in your research, please cite:

**Tool4Boxology: A Semantic Toolbox for Constructing and Analysing
Neuro-Symbolic Architectures**<br>
Johannes E. Bendler, Yashrajsinh Chudasama, Mahsa Forghani, Enrique Iglesias,
Disha Purohit, Jacquiline Roney, Annette ten Teije, Frank van Harmelen, and
Maria-Esther Vidal<br>
*The Semantic Web: 23rd European Semantic Web Conference (ESWC 2026)*,
Springer-Verlag, pp. 191–211.<br>
[https://doi.org/10.1007/978-3-032-25159-6_11](https://doi.org/10.1007/978-3-032-25159-6_11)

<details>
<summary>BibTeX</summary>

```bibtex
@inproceedings{10.1007/978-3-032-25159-6_11,
  author    = {Bendler, Johannes E. and Chudasama, Yashrajsinh and
               Forghani, Mahsa and Iglesias, Enrique and Purohit, Disha and
               Roney, Jacquiline and ten Teije, Annette and
               van Harmelen, Frank and Vidal, Maria-Esther},
  title     = {Tool4Boxology: A Semantic Toolbox for Constructing and
               Analysing Neuro-Symbolic Architectures},
  booktitle = {The Semantic Web: 23rd European Semantic Web Conference,
               ESWC 2026},
  year      = {2026},
  publisher = {Springer-Verlag},
  address   = {Berlin, Heidelberg},
  pages     = {191--211},
  doi       = {10.1007/978-3-032-25159-6_11}
}
```

</details>

## Contact

Developed by Mahsa Forghani Tehrani<br>
Email: mahsa.forghani.tehrani@stud.uni-hannover.de<br>
Repository: <https://github.com/SDM-TIB/Tool4Boxology>
