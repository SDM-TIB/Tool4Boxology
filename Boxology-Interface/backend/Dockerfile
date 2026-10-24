FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Install backend and hosted LLM provider dependencies.
# torch/transformers/peft are intentionally excluded from this dev image because
# they pull large CUDA stacks and are not needed for the proxied OpenAI/Anthropic/
# Gemini/Hugging Face chat endpoints. The local T4B models run instead via
# llama-cpp-python (CPU-friendly, no CUDA stack) against pre-converted GGUF weights.
RUN pip install --no-cache-dir \
    "fastapi>=0.104.0" \
    "uvicorn[standard]>=0.24.0" \
    "python-multipart>=0.0.6" \
    "SPARQLWrapper>=2.0.0" \
    "pydantic>=2.4.0" \
    pandas \
    rdflib \
    "openai>=1.0.0" \
    "anthropic>=0.7.0" \
    "requests>=2.31.0" \
    "python-dotenv>=1.0.0" \
    "huggingface_hub>=0.20.0"

# llama-cpp-python needs a C++ toolchain to build from source; python:3.11-slim has
# none, so install the project's prebuilt CPU wheel instead of compiling.
RUN pip install --no-cache-dir "llama-cpp-python>=0.3.0" \
    --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu

# Copy entire project so src/ is available
COPY . .

EXPOSE 8000
# No --reload: its file-watcher adds memory pressure and can abort an in-flight
# long-running request (e.g. local-model generation) on an unrelated file change.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
