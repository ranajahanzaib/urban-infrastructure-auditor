"""
FastAPI Microservice for Computer Vision & Multimodal Embeddings.
Provides endpoints for text encoding, image encoding, batch inference, and model health.
"""

import os
import logging
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import io

from services.vision.models.dinov2 import DINOv2Extractor
from services.vision.models.siglip import SigLIP2Model
from services.vision.processing.batch_embedder import BatchEmbedder, DEFAULT_DB_URL

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("vision_api")

app = FastAPI(
    title="Urban Infrastructure Auditor - Vision Service",
    version="1.0.0",
    description="Inference and multimodal embedding service using SigLIP 2 and DINOv2"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model references (loaded lazily on startup/first call)
siglip_model: Optional[SigLIP2Model] = None
dinov2_model: Optional[DINOv2Extractor] = None
embedder: Optional[BatchEmbedder] = None

def get_siglip() -> SigLIP2Model:
    global siglip_model
    if siglip_model is None:
        siglip_model = SigLIP2Model()
    return siglip_model

def get_dinov2() -> DINOv2Extractor:
    global dinov2_model
    if dinov2_model is None:
        dinov2_model = DINOv2Extractor()
    return dinov2_model

def get_embedder() -> BatchEmbedder:
    global embedder
    if embedder is None:
        embedder = BatchEmbedder(lazy_load=True)
    return embedder

class TextEmbedRequest(BaseModel):
    text: str

class TextEmbedResponse(BaseModel):
    model: str
    dimension: int
    embedding: List[float]

class ImageEmbedResponse(BaseModel):
    siglip_model: str
    dinov2_model: str
    dimension: int
    siglip_embedding: List[float]
    dinov2_embedding: List[float]

class BatchProcessRequest(BaseModel):
    batch_size: int = 50
    max_items: Optional[int] = None

@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": "urban-infrastructure-auditor-vision",
        "models": {
            "siglip": SigLIP2Model.MODEL_ID,
            "dinov2": DINOv2Extractor.MODEL_ID,
        }
    }

@app.get("/ready")
def ready() -> Dict[str, Any]:
    return {"ready": True}

@app.post("/embed/text", response_model=TextEmbedResponse)
def embed_text(req: TextEmbedRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text query cannot be empty")
    try:
        model = get_siglip()
        vector = model.encode_text(req.text.strip())
        return TextEmbedResponse(
            model=model.MODEL_ID,
            dimension=len(vector),
            embedding=vector.tolist()
        )
    except Exception as e:
        logger.error(f"Text encoding error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embed/image", response_model=ImageEmbedResponse)
async def embed_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")

        sig = get_siglip()
        dino = get_dinov2()

        sig_vec = sig.encode_image(pil_img)
        dino_vec = dino.encode_image(pil_img)

        return ImageEmbedResponse(
            siglip_model=sig.MODEL_ID,
            dinov2_model=dino.MODEL_ID,
            dimension=768,
            siglip_embedding=sig_vec.tolist(),
            dinov2_embedding=dino_vec.tolist()
        )
    except Exception as e:
        logger.error(f"Image encoding error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process/batch")
def trigger_batch_process(req: BatchProcessRequest, background_tasks: BackgroundTasks):
    """
    Triggers batch embedding of pending observations in background.
    """
    def run_job():
        try:
            b_embedder = get_embedder()
            b_embedder.process_pending(batch_size=req.batch_size, max_items=req.max_items)
        except Exception as err:
            logger.error(f"Background embedding job failed: {err}", exc_info=True)

    background_tasks.add_task(run_job)
    return {"status": "accepted", "message": "Batch embedding job queued in background"}

@app.get("/process/status")
def process_status():
    import psycopg
    from psycopg.rows import dict_row
    with psycopg.connect(DEFAULT_DB_URL, row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 
                    COUNT(*) FILTER (WHERE image_availability = 'available') as available_images,
                    COUNT(*) FILTER (WHERE siglip_status = 'completed') as siglip_completed,
                    COUNT(*) FILTER (WHERE dinov2_status = 'completed') as dinov2_completed,
                    COUNT(*) FILTER (WHERE siglip_status = 'pending' AND image_availability = 'available') as pending
                FROM observations;
                """
            )
            counts = cur.fetchone()

            cur.execute("SELECT COUNT(*) as relations_count FROM observation_relations;")
            rel_count = cur.fetchone()["relations_count"]

            return {
                "counts": counts,
                "candidate_relations_discovered": rel_count,
            }
