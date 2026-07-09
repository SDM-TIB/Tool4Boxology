from urllib.error import URLError

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from SPARQLWrapper import SPARQLWrapper, JSON
import sys, os, socket, importlib, traceback

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

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
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
async def api_create_kg(source: dict):
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
async def api_t4b_sparql(payload: dict):
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