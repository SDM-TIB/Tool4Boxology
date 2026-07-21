FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /app

# Install backend and hosted LLM provider dependencies.
# Local model packages such as torch/transformers are intentionally excluded
# from this dev image because they pull large CUDA stacks and are not needed
# for the proxied OpenAI/Anthropic/Gemini/Hugging Face chat endpoints.
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
    "google-generativeai>=0.3.0" \
    "requests>=2.31.0" \
    "python-dotenv>=1.0.0"

# Copy entire project so src/ is available
COPY . .

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
