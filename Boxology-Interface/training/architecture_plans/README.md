# Description-to-Boxology adapters

The baseline, CoT2 and CoT3 checkpoints in `T4B-LLM/T4B_cloudrift` were trained
for **yes/no rule entailment**, not for generating architectures. Their audit
files and evaluation CSVs document that task. Changing the prompt or enforcing
JSON does not train this missing capability. Live warehouse evaluations in
`evaluation/` retain the actual model responses and validation failures.

## Default runtime: design advisor, diagram builder, validator

This follows the role split in the sibling `T4B-LLM/boxology-agents` project:

| Selection | Design advisor | Diagram builder |
| --- | --- | --- |
| Modal baseline / CoT2 / CoT3 | Selected fine-tuned Llama adapter on Modal | Gemini 3.5 Flash Lite |
| Offline baseline / CoT2 / CoT3 | Selected local GGUF adapter | Local Qwen2.5-7B-Instruct Q4_K_M |
| Modal planner | None | Gemini 3.5 Flash Lite |
| Local planner | None | Local Qwen2.5-7B-Instruct Q4_K_M |

The adapter writes a brief design proposal. The builder receives the original
request, prior conversation, proposal, the entire downloadable AI skill, and the
compact stage contract in `backend/boxology_stage_plan.py`. The original request
is authoritative: the builder must correct advisor omissions and mistakes.
The builder chooses artifacts and stages with explicit input/output artifact IDs.
The compiler derives namespaced IDs, groups, memberships and edges from those
declarations; it does not invent or remove stages or connections. No warehouse
fixture or example architecture is loaded at runtime. The renderer supplies
styles/layout. Both Gemini and llama.cpp enforce the same stage JSON Schema.
Gemini uses a per-request REST client, avoiding the retired SDK and shared keys.

The validator checks exact elementary process signatures, types, keys, cluster
membership, sharing, and connectivity. Up to three attempts repair the builder's
plan. Only a valid plan is rendered; failure is reported as a builder failure.
Diagram metadata records the advisor, builder, proposal, attempt count, and skill
hash. Baseline/CoT2/CoT3 select real adapter weights, but **the instruction model
is the diagram generator**. This workflow does not retrain the existing adapters.
Structural validation is not proof of full semantic correctness.

### Configuration and startup

Copy `.env.example` to `.env` only when no `.env` exists, then set:

```dotenv
T4B_GENERATION_WORKFLOW=agents
T4B_BUILDER_PROVIDER=gemini
T4B_BUILDER_MODEL=gemini-3.5-flash-lite
T4B_BUILDER_API_KEY=your-server-side-gemini-key
MODAL_T4B_API_KEY=your-existing-modal-token
T4B_LOCAL_N_CTX=16384
T4B_PLAN_MAX_TOKENS=6144
```

The backend loads `.env` for native Python too; existing environment variables
win. Keep keys server-side. Recreate the backend after changing Compose settings:

```powershell
cd Boxology-Interface
docker compose up -d --no-deps backend
npm run dev -- --host 0.0.0.0
```

Offline first use downloads the instruction GGUF (~4.7 GB), adapter base and
caches the adapters. After setup, local inference requires no hosted API. To use
an existing instruction GGUF set `T4B_LOCAL_BUILDER_PATH` to its absolute path
(container-visible when running Docker). Models are cached in
`%LOCALAPPDATA%/T4B-LocalLLM` for native Windows and the `t4b_local_models` Docker
volume for Compose. These are separate caches. HTTP downloads are used by default
because Xet stalled on the tested Windows machine. A 7B CPU model is substantially
slower and needs more memory than the old 1B model. Only one model is resident;
inference is serialized. Restart after changing a loaded model or adapter.

`T4B_GENERATION_WORKFLOW=direct` retains the earlier single-model research path.
The training/export instructions below apply to that optional experiment. The
old entailment adapters failed direct diagram generation in the historical
`evaluation/RESULTS.md`; prompt changes alone do not train this capability.

## Build and inspect the dataset

From the repository root:

```powershell
python Boxology-Interface/training/architecture_plans/build_dataset.py
python -m pytest Boxology-Interface/backend/test_generation.py Boxology-Interface/training/architecture_plans/test_build_dataset.py -q
```

The builder pairs human diagrams in `NeSy-Example/BoxologyFiles` with the
reverse-authored descriptions in `descriptions.json`. It preserves source
topology and reports invalid sources rather than silently repairing training
targets. The stricter audit currently accepts **26 of 61** diagrams: **23 train,
3 validation**, with 35 exclusions explained in `generated/report.json`.
The previous weaker check accepted 56. Rebuild after changing the skill.

Assistant targets match the runtime schema exactly. IDs are split deterministically
with seed 42. The warehouse reference is a held-out regression fixture, never
included in this training dataset or copied as a runtime fallback.

This is a small pilot corpus. Add independently authored, diverse descriptions
and valid diagrams before claiming generalization. Rephrasing one template is
not a substitute for varied architectures. Keep evaluation cases out of training.

## Train each adapter for the actual task

Use a CUDA machine with enough VRAM for the 1B model and approximately 5000-token
records. The local MX550's 2 GB is not an appropriate training target. Install the
training requirements in a separate environment:

```powershell
python -m pip install -r Boxology-Interface/training/architecture_plans/requirements.txt
python Boxology-Interface/training/architecture_plans/train_adapter.py --variant baseline --check-only
python Boxology-Interface/training/architecture_plans/train_adapter.py --variant cot2 --check-only
python Boxology-Interface/training/architecture_plans/train_adapter.py --variant cot3 --check-only
```

Then run without `--check-only` on the training GPU:

```powershell
python Boxology-Interface/training/architecture_plans/train_adapter.py --variant baseline
python Boxology-Interface/training/architecture_plans/train_adapter.py --variant cot2
python Boxology-Interface/training/architecture_plans/train_adapter.py --variant cot3
```

The trainer continues the corresponding original adapter with response-only
loss. It verifies the chat-template prefix, masks the system/user tokens, checks
schema and topology, checks split IDs and rejects oversized records instead of
truncating them. The default limit is 8192, not the old classification limit of
512. New weights and training manifests go to `trained_adapters/`, using the same
three directory names as the original checkpoints. Existing adapters are never
overwritten. Low validation loss alone is not a release criterion: generate and
review held-out diagrams before switching deployed weights. Training has not
been run merely by adding this code.

## Use the new weights on GPU

From `Boxology-Interface`, after training and evaluation:

```powershell
$env:T4B_ADAPTERS_DIR = (Resolve-Path training/architecture_plans/trained_adapters).Path
modal run modal_app/serve.py --variant modal-cot2
modal deploy modal_app/serve.py
```

`modal run` evaluates the new source on a temporary GPU app without replacing
production. `modal deploy` updates production. Configure the resulting
`MODAL_T4B_CHAT_URL` and `MODAL_T4B_HEALTH_URL` in the backend environment; keep
the bearer token server-side. Restart the backend to load environment changes.
The deploy must include all three adapter directories. Omit `T4B_ADAPTERS_DIR`
to test the original checkpoints. A code deploy by itself does not retrain them.

## Use the same new adapters offline

With a local llama.cpp checkout and its converter dependencies installed:

```powershell
python Boxology-Interface/training/architecture_plans/export_adapters.py --llama-cpp C:/path/to/llama.cpp
```

The exporter invokes the official `convert_lora_to_gguf.py` converter and writes
`baseline.gguf`, `cot2.gguf`, `cot3.gguf` and provenance manifests to
`training/architecture_plans/gguf_adapters/`. It refuses to overwrite files or
export checkpoints without an architecture-training manifest. Conversion needs
the base config/tokenizer, not the full base weights; use `--base-config` for an
already-downloaded config directory. See the [upstream converter](https://github.com/ggml-org/llama.cpp/blob/master/convert_lora_to_gguf.py).

Set `T4B_LOCAL_ADAPTERS_DIR` to that directory and restart the backend. In Docker,
use `/app/training/architecture_plans/gguf_adapters`, not the Windows host path.
The existing local GGUF base model is reused. First-use base setup requires a
download; subsequent inference is offline. Quantized CPU and FP16 GPU outputs
can differ even with the same LoRA weights, so evaluate both.

## Live evaluation

```powershell
python Boxology-Interface/training/architecture_plans/evaluate_generation.py --provider local --variants baseline cot2 cot3
```

The evaluator saves every returned attempt and its failure status. It writes a
`.boxology` only after structural validation succeeds, and separately checks
minimum warehouse-stage coverage. It exits nonzero on failure. That coverage check is an evaluation assertion,
not part of the generator. Use `--prompt` for other domains. Run the GPU agents path with:

```powershell
python Boxology-Interface/training/architecture_plans/evaluate_generation.py --provider modal --variants baseline cot2 cot3
```

The following Modal CLI smoke tests exercise adapter-only generation for the
optional direct research mode, not the deployed two-role agents workflow:

```powershell
cd Boxology-Interface
modal run modal_app/serve.py --variant modal-baseline
modal run modal_app/serve.py --variant modal-cot2
modal run modal_app/serve.py --variant modal-cot3
```

Schema enforcement follows the [llama-cpp-python API](https://llama-cpp-python.readthedocs.io/en/latest/api-reference/)
and [LM Format Enforcer integration](https://github.com/noamgat/lm-format-enforcer).
The GPU tokenizer follows [Hugging Face chat-template guidance](https://huggingface.co/docs/transformers/v4.57.1/chat_templating).
