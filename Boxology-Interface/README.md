# Boxology Interface

Boxology Interface is the web editor for [Tool4Boxology](https://github.com/SDM-TIB/Tool4Boxology). It provides an interactive environment for modeling, validating, and documenting hybrid and neuro-symbolic AI architectures with Boxology components.

The application combines a React/GoJS editor with a FastAPI backend and an optional Virtuoso triple store. Diagrams can be converted into knowledge graphs, queried with SPARQL, exported for reuse, or generated from natural-language descriptions with a supported LLM provider.

> **Project status:** This interface is under active development. Features and file formats may change.

## Features

- Drag-and-drop editor for data, symbols, actors, models, and process nodes
- Clustered, hierarchical diagrams for organizing architecture stages
- Connection and elementary-pattern validation
- Stable component identifiers for reuse and knowledge-graph updates
- Import and export of editable Boxology/JSON diagrams
- Export to DOT/Graphviz, PNG, and knowledge-graph-oriented JSON
- RDF knowledge-graph generation and upload to Virtuoso
- Built-in SPARQL query explorer
- Natural-language Boxology generation and assistant chat
- Support for hosted and local LLM providers
- Autosave and system-documentation generation

## Technology

- React 19, TypeScript, and Vite
- GoJS and `gojs-react`
- Material UI
- FastAPI and Uvicorn
- RDFLib and SPARQLWrapper
- Virtuoso

## Quick start with Docker Compose

### Prerequisites

- Docker with Docker Compose

From this directory, run:

```bash
docker compose up --build
```

The services are then available at:

| Service | URL |
| --- | --- |
| Interface | <http://localhost:5173> |
| Backend API | <http://localhost:8000> |
| Backend health check | <http://localhost:8000/api/health> |
| Virtuoso SPARQL endpoint | <http://localhost:8890/sparql> |
| Virtuoso Conductor | <http://localhost:8890/conductor> |

To stop the services:

```bash
docker compose down
```

The named `kg_data` volume preserves Virtuoso data between container restarts. Use `docker compose down -v` only when you intentionally want to remove that data.

## Local development

### Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- Python 3.11 recommended
- A Virtuoso instance if knowledge-graph upload or SPARQL querying is required

### 1. Install the frontend dependencies

```bash
npm install
```

### 2. Create a Python environment and install the backend dependencies

On macOS or Linux:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
```

On Windows PowerShell:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
```

The default requirements include packages for local model inference and can be large. If local inference is not needed, the Docker backend image provides a lighter setup for hosted providers.

### 3. Start Virtuoso

You can start only the repository's Virtuoso service:

```bash
docker compose up -d boxology_kg
```

For a manually started backend, the application resolves Virtuoso at `localhost:8890` by default. Set `SPARQL_HOST` to override the host.

### 4. Start the backend

Run this command from the `Boxology-Interface` directory:

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend --reload-dir src
```

### 5. Start the frontend

In another terminal:

```bash
npm run dev
```

Open <http://localhost:5173>.

## Configuration

Create a `.env.local` file in this directory when the frontend should use a backend other than the default:

```dotenv
VITE_BACKEND_URL=http://localhost:8000
```

Relevant backend environment variables include:

| Variable | Purpose | Default |
| --- | --- | --- |
| `SPARQL_HOST` | Virtuoso hostname used by a locally run backend | Automatically detected; otherwise `localhost` |
| `DEFAULT_HF_MODEL_ID` | Default Hugging Face model | `openai/gpt-oss-120b` |
| `HF_REQUEST_TIMEOUT_SECONDS` | Hugging Face request timeout | `120` |
| `HF_DEFAULT_MAX_TOKENS` | Default chat response limit | `512` |
| `HF_BOXOLOGY_MAX_TOKENS` | Boxology generation response limit | `4096` |
| `HF_MAX_TOKENS_CEILING` | Maximum accepted response limit | `8192` |

LLM credentials are entered through the interface and sent to the backend for the requested operation. Do not commit API keys or tokens to the repository.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the project with Prettier |
| `npm run deploy` | Build and publish `dist/` with `gh-pages` |
| `npm run docker:build` | Build the production frontend image |
| `npm run docker:run` | Run that image at <http://localhost:3000> |

There is currently no automated test suite; `npm test` is a placeholder.

## Project structure

```text
Boxology-Interface/
├── backend/                 FastAPI API, LLM integration, and KG endpoints
├── local-llm/               Local-model support files
├── nginx/                   Production web-server configuration
├── public/                  Static site, tutorial, and KG viewer assets
├── src/
│   ├── components/          Editor UI, sidebars, toolbar, dialogs, and chat
│   ├── data/                Shapes and Boxology pattern definitions
│   ├── Examples/            Example diagrams
│   ├── hooks/               Shared React hooks
│   ├── kg_creation/         RDF generation and mappings
│   ├── plugin/              Diagram setup and validation implementations
│   ├── styles/              Theme and shared styles
│   └── utils/               Import, export, validation, autosave, and docs
├── docker-compose.yml       Development service orchestration
├── Dockerfile               Production frontend image
├── Dockerfile.dev           Frontend development image
└── vite.config.ts           Vite build and development-server configuration
```

## Production frontend build

Create a static production build with:

```bash
npm run build
```

The generated frontend files are written to `dist/`.

The production `Dockerfile` builds the same static frontend and serves it with Nginx:

```bash
docker build -t boxology-interface .
docker run --rm -p 3000:80 boxology-interface
```

Then open <http://localhost:3000>.

This image contains only the frontend. Diagram editing and local import/export work without the Python service, but AI assistance, knowledge-graph generation, and SPARQL queries require the backend and Virtuoso to be running separately. By default, the browser connects to the backend at <http://localhost:8000>.

To run the complete application stack instead, use:

```bash
docker compose up --build
```

and open <http://localhost:5173>.

## Troubleshooting

- **The assistant cannot reach the backend:** verify <http://localhost:8000/api/health> and check `VITE_BACKEND_URL`.
- **Knowledge-graph upload or queries fail:** confirm Virtuoso is running at port `8890` and that `SPARQL_HOST` is correct for the backend's environment.
- **The GoJS evaluation watermark is visible:** the repository uses the GoJS evaluation distribution. A commercial GoJS license is required to remove it.
- **Docker data seems stale:** restart the services first. Removing the `kg_data` volume deletes stored Virtuoso data.

## License

Repository code is provided under the [Apache License 2.0](../LICENSE). Documentation and Boxology visual material covered separately are provided under [CC BY 4.0](../LICENSE-CC-BY-4.0).

GoJS is a product of Northwoods Software and has its own [license terms](https://gojs.net/latest/license.html).

## Contact

Developed by Mahsa Forghani Tehrani and the Tool4Boxology contributors.

- Email: mahsa.forghani.tehrani@stud.uni-hannover.de
- Repository: <https://github.com/SDM-TIB/Tool4Boxology>
