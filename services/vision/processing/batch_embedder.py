"""
Batch Embedding and Candidate Relationship Generation Engine.
Processes images through SigLIP 2 and DINOv2, persists embeddings into PostgreSQL/pgvector,
and discovers near-duplicate and historical repeat candidates.
"""

import os
import uuid
import logging
from typing import Optional, List, Dict, Any
import numpy as np
import psycopg
from psycopg.rows import dict_row

from services.vision.models.dinov2 import DINOv2Extractor
from services.vision.models.siglip import SigLIP2Model

logger = logging.getLogger("batch_embedder")
DEFAULT_DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/urban_infrastructure")

class BatchEmbedder:
    def __init__(
        self,
        db_url: str = DEFAULT_DB_URL,
        storage_dir: str = "data/storage",
        device: Optional[str] = None,
        lazy_load: bool = True
    ):
        self.db_url = db_url
        self.storage_dir = storage_dir
        self.device = device
        self._dinov2: Optional[DINOv2Extractor] = None
        self._siglip: Optional[SigLIP2Model] = None

        if not lazy_load:
            self.load_models()

    @property
    def dinov2(self) -> DINOv2Extractor:
        if self._dinov2 is None:
            self._dinov2 = DINOv2Extractor(device=self.device)
        return self._dinov2

    @property
    def siglip(self) -> SigLIP2Model:
        if self._siglip is None:
            self._siglip = SigLIP2Model(device=self.device)
        return self._siglip

    def load_models(self):
        _ = self.dinov2
        _ = self.siglip

    def process_pending(self, batch_size: int = 50, max_items: Optional[int] = None) -> Dict[str, Any]:
        """
        Embeds observations where image_availability = 'available' and embedding status is pending.
        """
        logger.info("Scanning for pending image embeddings...")
        with psycopg.connect(self.db_url, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                limit_clause = f"LIMIT {max_items}" if max_items else ""
                cur.execute(
                    f"""
                    SELECT id, image_path, filename, dataset_id, latitude, longitude, observed_at
                    FROM observations
                    WHERE image_availability = 'available'
                      AND (siglip_status = 'pending' OR dinov2_status = 'pending')
                    ORDER BY created_at ASC
                    {limit_clause};
                    """
                )
                pending_rows = cur.fetchall()

        if not pending_rows:
            logger.info("No pending observations found for embedding.")
            return {"processed": 0, "embedded": 0, "failed": 0}

        logger.info(f"Found {len(pending_rows)} observations to embed.")
        embedded_count = 0
        failed_count = 0

        # Process in batches
        for i in range(0, len(pending_rows), batch_size):
            chunk = pending_rows[i:i + batch_size]
            obs_ids = []
            valid_image_paths = []
            valid_rows = []

            for row in chunk:
                # Find image file on disk
                candidate_paths = [
                    os.path.join(self.storage_dir, row["image_path"]) if row["image_path"] else "",
                    os.path.join(self.storage_dir, "images", "batch-0001", row["filename"]),
                    os.path.join(self.storage_dir, row["filename"])
                ]
                found_path = None
                for p in candidate_paths:
                    if p and os.path.isfile(p):
                        found_path = p
                        break

                if found_path:
                    obs_ids.append(row["id"])
                    valid_image_paths.append(found_path)
                    valid_rows.append(row)
                else:
                    failed_count += 1
                    # Mark missing image on disk
                    with psycopg.connect(self.db_url) as conn:
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE observations SET siglip_status = 'failed', dinov2_status = 'failed' WHERE id = %s",
                                (row["id"],)
                            )
                            conn.commit()

            if not valid_image_paths:
                continue

            try:
                # 1. Generate SigLIP 2 Embeddings
                siglip_vectors = self.siglip.encode_batch_images(valid_image_paths)

                # 2. Generate DINOv2 Embeddings
                dinov2_vectors = self.dinov2.encode_batch(valid_image_paths)

                # 3. Store embeddings into image_embeddings table
                with psycopg.connect(self.db_url) as conn:
                    with conn.cursor() as cur:
                        for idx, obs_id in enumerate(obs_ids):
                            sig_vec_str = "[" + ",".join(f"{val:.6f}" for val in siglip_vectors[idx]) + "]"
                            dino_vec_str = "[" + ",".join(f"{val:.6f}" for val in dinov2_vectors[idx]) + "]"

                            # Insert SigLIP embedding
                            cur.execute(
                                """
                                INSERT INTO image_embeddings (
                                    id, observation_id, model_name, model_version,
                                    embedding_type, dimension, embedding
                                )
                                VALUES (%s, %s, %s, 'v2', 'siglip2_image', 768, %s::vector)
                                ON CONFLICT (observation_id, embedding_type, model_name)
                                DO UPDATE SET embedding = EXCLUDED.embedding;
                                """,
                                (uuid.uuid4(), obs_id, self.siglip.MODEL_ID, sig_vec_str)
                            )

                            # Insert DINOv2 embedding
                            cur.execute(
                                """
                                INSERT INTO image_embeddings (
                                    id, observation_id, model_name, model_version,
                                    embedding_type, dimension, embedding
                                )
                                VALUES (%s, %s, %s, 'base', 'dinov2', 768, %s::vector)
                                ON CONFLICT (observation_id, embedding_type, model_name)
                                DO UPDATE SET embedding = EXCLUDED.embedding;
                                """,
                                (uuid.uuid4(), obs_id, self.dinov2.MODEL_ID, dino_vec_str)
                            )

                            # Update observation status
                            cur.execute(
                                """
                                UPDATE observations
                                SET siglip_status = 'completed',
                                    dinov2_status = 'completed',
                                    updated_at = NOW()
                                WHERE id = %s;
                                """,
                                (obs_id,)
                            )

                        conn.commit()

                embedded_count += len(valid_image_paths)
                logger.info(f"Embedded batch of {len(valid_image_paths)} observations (Total so far: {embedded_count})")

            except Exception as e:
                logger.error(f"Error embedding batch: {e}", exc_info=True)
                failed_count += len(valid_image_paths)

        # After embedding, discover candidate relationships
        logger.info("Running candidate relationship discovery...")
        self.discover_relations()

        return {
            "processed": len(pending_rows),
            "embedded": embedded_count,
            "failed": failed_count,
        }

    def discover_relations(self, similarity_threshold: float = 0.80):
        """
        Discovers near-duplicates and possible repeat observations using DINOv2 vector distance and PostGIS spatial distance.
        """
        with psycopg.connect(self.db_url, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                # Find pairs of observations with high visual similarity
                cur.execute(
                    """
                    SELECT 
                        e1.observation_id as source_id,
                        e2.observation_id as target_id,
                        (1 - (e1.embedding <=> e2.embedding)) as visual_similarity,
                        ST_Distance(o1.location::geography, o2.location::geography) as distance_meters,
                        ABS(EXTRACT(EPOCH FROM (o1.observed_at - o2.observed_at)) / 86400.0) as days_apart
                    FROM image_embeddings e1
                    JOIN image_embeddings e2 
                      ON e1.embedding_type = 'dinov2' 
                     AND e2.embedding_type = 'dinov2'
                     AND e1.observation_id < e2.observation_id
                    JOIN observations o1 ON e1.observation_id = o1.id
                    JOIN observations o2 ON e2.observation_id = o2.id
                    WHERE (1 - (e1.embedding <=> e2.embedding)) >= %s
                    ORDER BY visual_similarity DESC
                    LIMIT 200;
                    """,
                    (similarity_threshold,)
                )
                pairs = cur.fetchall()

                logger.info(f"Discovered {len(pairs)} candidate visual relation pairs.")
                for p in pairs:
                    vis_sim = float(p["visual_similarity"])
                    dist_m = float(p["distance_meters"] or 0.0)
                    days = float(p["days_apart"] or 0.0)

                    # Determine relation type
                    if vis_sim > 0.90:
                        rel_type = "near_duplicate"
                        state = "needs_review"
                    elif dist_m < 100.0 and days > 14.0:
                        rel_type = "possible_repeat"
                        state = "needs_review"
                    else:
                        rel_type = "visually_similar"
                        state = "proposed"

                    cur.execute(
                        """
                        INSERT INTO observation_relations (
                            id, source_observation_id, target_observation_id,
                            relation_type, confidence_score, distance_meters,
                            days_apart, verification_state, created_at, updated_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                        ON CONFLICT (source_observation_id, target_observation_id, relation_type)
                        DO UPDATE SET
                            confidence_score = EXCLUDED.confidence_score,
                            distance_meters = EXCLUDED.distance_meters,
                            days_apart = EXCLUDED.days_apart,
                            updated_at = NOW();
                        """,
                        (uuid.uuid4(), p["source_id"], p["target_id"], rel_type, vis_sim, dist_m, days, state)
                    )
                conn.commit()
                logger.info("Candidate relations recorded successfully.")


if __name__ == "__main__":
    import argparse
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    parser = argparse.ArgumentParser(description="Batch embedder for observations using SigLIP 2 and DINOv2")
    parser.add_argument("--batch-size", type=int, default=50, help="Batch size for embedding inference")
    parser.add_argument("--max-items", type=int, default=None, help="Maximum number of items to embed")
    parser.add_argument("--storage-dir", default="data/storage", help="Storage directory for images")
    parser.add_argument("--db-url", default=DEFAULT_DB_URL, help="Database connection URL")
    args = parser.parse_args()

    embedder = BatchEmbedder(db_url=args.db_url, storage_dir=args.storage_dir)
    res = embedder.process_pending(batch_size=args.batch_size, max_items=args.max_items)
    print("Embedding job completed:", res)

