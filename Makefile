# Makefile for Urban Infrastructure Auditor

.PHONY: all setup db-up db-down migrate import embed test test-ingestion test-vision test-api test-e2e run-vision run-api run-web docker-up docker-down clean

PYTHON ?= .venv/bin/python
UVICORN ?= .venv/bin/uvicorn

all: setup test

setup:
	@echo "Setting up Python virtual environment..."
	python3 -m venv .venv
	.venv/bin/pip install --upgrade pip
	.venv/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
	.venv/bin/pip install -r requirements.txt
	@echo "Installing web frontend dependencies with pnpm..."
	pnpm install
	@echo "Verifying Go backend..."
	cd services/api && go mod tidy

db-up:
	docker compose up -d db

db-down:
	docker compose stop db

migrate:
	@echo "Applying database schema..."
	psql -h localhost -U postgres -d urban_infrastructure -f services/api/migrations/001_init.sql

import:
	@echo "Ingesting Hugging Face datasets..."
	$(PYTHON) -m ingestion import construction --limit 5000
	$(PYTHON) -m ingestion import green-infrastructure --limit 5000

embed:
	@echo "Extracting SigLIP and DINOv2 embeddings & discovering relations..."
	$(PYTHON) -m services.vision.processing.batch_embedder

run-vision:
	$(UVICORN) services.vision.api.main:app --host 0.0.0.0 --port 8001 --reload

run-api:
	cd services/api && PORT=8080 VISION_SERVICE_URL=http://localhost:8001 STORAGE_DIR=../../data/storage go run cmd/server/main.go

run-web:
	pnpm --filter web dev

test: test-ingestion test-vision test-api test-e2e

test-ingestion:
	$(PYTHON) -m unittest ingestion/tests/test_ingestion.py

test-vision:
	TRANSFORMERS_OFFLINE=1 HF_HUB_OFFLINE=1 $(PYTHON) -m unittest services/vision/tests/test_vision.py

test-api:
	cd services/api && go test -v ./tests/...

test-e2e:
	$(PYTHON) -m unittest tests/e2e/test_system.py

docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

clean:
	rm -rf services/api/bin apps/web/.next .pytest_cache __pycache__
