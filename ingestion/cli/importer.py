"""
Main dataset ingestion engine for Urban Infrastructure Auditor.
Imports real-world metadata and image archives from Hugging Face into PostgreSQL/PostGIS.
"""

import os
import uuid
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import psycopg
from psycopg.rows import dict_row

from ingestion.normalization.taxonomy import normalize_category
from ingestion.normalization.coordinates import validate_coordinates
from ingestion.normalization.dates import parse_observation_date
from ingestion.images.resolver import ImageResolver
from ingestion.parsers.csv_parser import parse_csv_stream

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("importer")

DEFAULT_DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/urban_infrastructure")

DATASETS_CONFIG = {
    "construction-infrastructure-change": {
        "id": "construction-infrastructure-change",
        "name": "construction-infrastructure-change",
        "csv_path": "data/raw/construction.csv",
        "default_category": "construction_sites",
        "archive_zip": "data/raw/construction_images.zip",
        "license": "CC BY 4.0",
        "attribution": "EDK-Earth (Mapillary, outerview, and source contributors)",
    },
    "urban-climate-green-infrastructure": {
        "id": "urban-climate-green-infrastructure",
        "name": "urban-climate-green-infrastructure",
        "csv_path": "data/raw/green_infrastructure.csv",
        "default_category": "street_trees",
        "archive_zip": "data/raw/green_images.zip",
        "license": "CC BY 4.0",
        "attribution": "EDK-Earth (Mapillary, outerview, and source contributors)",
    }
}

class DatasetImporter:
    def __init__(self, db_url: str = DEFAULT_DB_URL, storage_dir: str = "data/storage"):
        self.db_url = db_url
        self.resolver = ImageResolver(base_storage_dir=storage_dir)

    def run_import(
        self,
        dataset_key: str,
        limit: Optional[int] = None,
        batch_size: int = 1000,
        feature_filter: Optional[List[str]] = None,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        Executes idempotent dataset import.
        """
        # Alias normalization
        if dataset_key in ("construction", "construction-infrastructure-change"):
            config = DATASETS_CONFIG["construction-infrastructure-change"]
        elif dataset_key in ("green-infrastructure", "urban-climate-green-infrastructure", "green"):
            config = DATASETS_CONFIG["urban-climate-green-infrastructure"]
        else:
            raise ValueError(f"Unknown dataset: {dataset_key}")

        dataset_id = config["id"]
        csv_path = config["csv_path"]

        if not os.path.isfile(csv_path):
            raise FileNotFoundError(f"Metadata file not found: {csv_path}. Run download step first.")

        job_id = uuid.uuid4()
        started_at = datetime.now(timezone.utc)
        logger.info(f"Starting import job {job_id} for dataset {dataset_id} from {csv_path}")

        total_processed = 0
        total_imported = 0
        total_failed = 0
        total_images_resolved = 0

        with psycopg.connect(self.db_url) as conn:
            with conn.cursor() as cur:
                # Record job in database
                cur.execute(
                    """
                    INSERT INTO dataset_import_jobs (id, dataset_id, status, started_at)
                    VALUES (%s, %s, 'running', %s)
                    """,
                    (job_id, dataset_id, started_at)
                )
                conn.commit()

            # Process stream in batches
            batch_observations = []
            batch_assets = []

            for row_idx, raw_row in enumerate(parse_csv_stream(csv_path, limit=limit)):
                total_processed += 1
                try:
                    filename = raw_row.get("filename", "")
                    if not filename:
                        total_failed += 1
                        continue

                    raw_feature = raw_row.get("feature", "")
                    if feature_filter and raw_feature not in feature_filter:
                        continue

                    category_id = normalize_category(raw_feature) or config["default_category"]
                    image_folder = raw_row.get("image_folder", "images/batch-0001")
                    date_str = raw_row.get("date")
                    observed_at, has_timestamp = parse_observation_date(date_str)

                    # Validate coordinates
                    is_valid_coord, lat, lon, quarantine_reason = validate_coordinates(
                        raw_row.get("latitude"), raw_row.get("longitude")
                    )

                    if not is_valid_coord:
                        is_quarantined = True
                        coord_lat = lat if lat is not None else 0.0
                        coord_lon = lon if lon is not None else 0.0
                    else:
                        is_quarantined = False
                        coord_lat = lat
                        coord_lon = lon
                        quarantine_reason = None

                    # Check image availability
                    img_meta = self.resolver.resolve(image_folder, filename)
                    image_avail = img_meta["availability"]
                    storage_path = img_meta["storage_path"]
                    checksum = img_meta["checksum"]
                    phash = img_meta["phash"]

                    if image_avail == "available":
                        total_images_resolved += 1
                        siglip_status = "pending"
                        dinov2_status = "pending"
                    else:
                        siglip_status = "not_applicable"
                        dinov2_status = "not_applicable"

                    # Deterministic UUID for idempotency
                    obs_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"{dataset_id}:{filename}:{row_idx}")

                    country = raw_row.get("country")
                    state = raw_row.get("state")
                    city = raw_row.get("city")
                    source = raw_row.get("source", config["attribution"])

                    obs_record = (
                        obs_id,
                        dataset_id,
                        str(row_idx),
                        filename,
                        image_folder,
                        storage_path,
                        image_avail,
                        checksum,
                        raw_feature,
                        category_id,
                        observed_at,
                        has_timestamp,
                        coord_lat,
                        coord_lon,
                        f"SRID=4326;POINT({coord_lon} {coord_lat})",
                        country,
                        state,
                        city,
                        source,
                        config["license"],
                        "unverified",
                        is_quarantined,
                        quarantine_reason,
                        siglip_status,
                        dinov2_status,
                        phash,
                        json.dumps(raw_row)
                    )
                    batch_observations.append(obs_record)

                    if image_avail == "available":
                        asset_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"asset:{obs_id}")
                        asset_record = (
                            asset_id,
                            obs_id,
                            storage_path,
                            img_meta["mime_type"],
                            img_meta["byte_size"],
                            img_meta["width"],
                            img_meta["height"],
                            checksum,
                            phash
                        )
                        batch_assets.append(asset_record)

                    if len(batch_observations) >= batch_size:
                        self._flush_batch(conn, batch_observations, batch_assets)
                        total_imported += len(batch_observations)
                        batch_observations.clear()
                        batch_assets.clear()
                        if total_processed % 5000 == 0:
                            logger.info(f"Progress: {total_processed} processed, {total_imported} imported, {total_images_resolved} images found")

                except Exception as e:
                    total_failed += 1
                    logger.debug(f"Row {row_idx} failed: {e}")

            if batch_observations:
                self._flush_batch(conn, batch_observations, batch_assets)
                total_imported += len(batch_observations)
                batch_observations.clear()
                batch_assets.clear()

            completed_at = datetime.now(timezone.utc)
            with conn.cursor() as cur:
                # Update dataset totals
                cur.execute(
                    """
                    UPDATE datasets
                    SET imported_records = (SELECT COUNT(*) FROM observations WHERE dataset_id = %s),
                        image_records = (SELECT COUNT(*) FROM observations WHERE dataset_id = %s AND image_availability = 'available'),
                        total_records = (SELECT COUNT(*) FROM observations WHERE dataset_id = %s),
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (dataset_id, dataset_id, dataset_id, dataset_id)
                )
                # Update job record
                cur.execute(
                    """
                    UPDATE dataset_import_jobs
                    SET status = 'completed',
                        total_rows = %s,
                        processed_rows = %s,
                        imported_rows = %s,
                        failed_rows = %s,
                        images_resolved = %s,
                        completed_at = %s
                    WHERE id = %s
                    """,
                    (total_processed, total_processed, total_imported, total_failed, total_images_resolved, completed_at, job_id)
                )
                conn.commit()

        logger.info(
            f"Import finished for {dataset_id}: "
            f"processed={total_processed}, imported={total_imported}, "
            f"images={total_images_resolved}, failed={total_failed}"
        )

        return {
            "job_id": str(job_id),
            "dataset_id": dataset_id,
            "total_processed": total_processed,
            "total_imported": total_imported,
            "total_images_resolved": total_images_resolved,
            "total_failed": total_failed,
        }

    def _flush_batch(self, conn, observations: List[tuple], assets: List[tuple]):
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO observations (
                    id, dataset_id, original_row_id, filename, image_folder, image_path,
                    image_availability, image_checksum, original_feature_label, category_id,
                    observed_at, has_timestamp, latitude, longitude, location,
                    country, state, city, source_attribution, dataset_license,
                    verification_status, is_quarantined, quarantine_reason,
                    siglip_status, dinov2_status, phash, raw_metadata
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    ST_GeomFromEWKT(%s),
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                ON CONFLICT (id) DO UPDATE SET
                    image_path = EXCLUDED.image_path,
                    image_availability = EXCLUDED.image_availability,
                    image_checksum = EXCLUDED.image_checksum,
                    phash = EXCLUDED.phash,
                    siglip_status = CASE 
                        WHEN observations.siglip_status = 'completed' THEN 'completed' 
                        ELSE EXCLUDED.siglip_status 
                    END,
                    dinov2_status = CASE 
                        WHEN observations.dinov2_status = 'completed' THEN 'completed' 
                        ELSE EXCLUDED.dinov2_status 
                    END,
                    updated_at = NOW();
                """,
                observations
            )

            if assets:
                cur.executemany(
                    """
                    INSERT INTO image_assets (
                        id, observation_id, storage_path, mime_type, byte_size,
                        width, height, checksum_sha256, phash
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        width = EXCLUDED.width,
                        height = EXCLUDED.height,
                        byte_size = EXCLUDED.byte_size,
                        checksum_sha256 = EXCLUDED.checksum_sha256,
                        phash = EXCLUDED.phash;
                    """,
                    assets
                )
            conn.commit()

    def get_status(self) -> Dict[str, Any]:
        """
        Retrieves global import status and counts.
        """
        with psycopg.connect(self.db_url, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT d.id, d.display_name, d.total_records, d.imported_records, d.image_records,
                           COUNT(o.id) FILTER (WHERE o.is_quarantined) as quarantined_count,
                           COUNT(o.id) FILTER (WHERE o.verification_status != 'unverified') as reviewed_count,
                           COUNT(o.id) FILTER (WHERE o.siglip_status = 'completed') as siglip_embedded_count,
                           COUNT(o.id) FILTER (WHERE o.dinov2_status = 'completed') as dinov2_embedded_count
                    FROM datasets d
                    LEFT JOIN observations o ON d.id = o.dataset_id
                    GROUP BY d.id, d.display_name, d.total_records, d.imported_records, d.image_records;
                    """
                )
                datasets = cur.fetchall()

                cur.execute("SELECT COUNT(*) as total_obs FROM observations;")
                total_obs = cur.fetchone()["total_obs"]

                cur.execute(
                    """
                    SELECT id, dataset_id, status, total_rows, imported_rows, images_resolved, started_at, completed_at
                    FROM dataset_import_jobs
                    ORDER BY started_at DESC LIMIT 5;
                    """
                )
                recent_jobs = cur.fetchall()

                return {
                    "total_observations": total_obs,
                    "datasets": datasets,
                    "recent_jobs": recent_jobs,
                }
