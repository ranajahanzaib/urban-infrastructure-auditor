# Python Vision Service (SigLIP 2 & DINOv2)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU and vision dependencies
RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install application dependencies
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    python-multipart \
    pydantic \
    transformers \
    pillow \
    numpy \
    psycopg[binary] \
    sentencepiece \
    protobuf \
    imagehash \
    python-dateutil

COPY services/vision /app/services/vision

ENV PYTHONPATH=/app
ENV PORT=8001
ENV DEVICE=cpu

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["uvicorn", "services.vision.api.main:app", "--host", "0.0.0.0", "--port", "8001"]
