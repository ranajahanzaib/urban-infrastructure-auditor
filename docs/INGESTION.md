# Dataset Ingestion & Normalization

## 1. Supported Data Sources

The ingestion pipeline handles real-world datasets published by EDK-Earth on Hugging Face:

1. **Construction & Infrastructure Change**
   - **Repository**: `https://huggingface.co/datasets/EDK-Earth/construction-infrastructure-change`
   - **Records**: 55,801 metadata rows.
   - **License**: CC BY 4.0.
   - **Categories**: Construction Site, Roadwork, Crane, Excavator, Scaffolding, Pothole.

2. **Urban Climate & Green Infrastructure**
   - **Repository**: `https://huggingface.co/datasets/EDK-Earth/urban-climate-green-infrastructure`
   - **Records**: 18,107 metadata rows.
   - **License**: CC BY 4.0.
   - **Categories**: Street Tree, Bike Lane, Solar Panel, EV Charger, Rain Garden, Green Roof.

---

## 2. Ingestion Validation Rules

### A. Coordinate Validation

- **Range Constraints**: Latitude must fall strictly in `[-90.0, +90.0]`; Longitude in `[-180.0, +180.0]`.
- **Null Island Rejection**: Coordinates exactly at `(0.0, 0.0)` are rejected as GPS default errors.
- **NaN / Inf Filtering**: Any non-numeric or IEEE float `NaN`/`Inf` is rejected.
- **Quarantine**: Invalid records are flagged with `is_quarantined = TRUE` and a descriptive `quarantine_reason` rather than silently dropped.

### B. Date & Temporal Normalization

- Supports ISO 8601 strings (`2024-06-13T00:55:20.517000+00:00`), RFC 3339, Unix epoch timestamps, and YYYY-MM-DD date strings.
- Timestamps are normalized to UTC `TIMESTAMPTZ`.
- Records lacking timestamps have `has_timestamp = FALSE` and `observed_at = NULL`.

### C. Image Resolution Strategy

- The importer does not assume every metadata row has an image.
- When an image ZIP archive or folder is provided (`--images-dir` or `--images-zip`), the file resolver matches records by `filename`.
- Matched images are stored in `data/storage/images/<batch>/` with `image_availability = 'available'`.
- Missing images are stored with `image_availability = 'missing'`. These records remain fully searchable and visible in geospatial maps and analytics.

---

## 3. Ingestion CLI Commands

```bash
# Ingest 5,000 records from Construction dataset
.venv/bin/python -m ingestion import-dataset \
  --source data/raw/construction.csv \
  --dataset-id construction-infrastructure-change \
  --limit 5000

# Ingest 5,000 records from Green Infrastructure dataset with image matching
.venv/bin/python -m ingestion import-dataset \
  --source data/raw/green_infrastructure.csv \
  --dataset-id urban-climate-green-infrastructure \
  --images-dir data/storage/images/batch-0001 \
  --limit 5000
```
