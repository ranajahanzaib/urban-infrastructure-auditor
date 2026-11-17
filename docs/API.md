# REST API Specification: Urban Infrastructure Auditor

Base URL: `http://localhost:8080/api/v1`

---

## 1. System & Health

### `GET /health`

Returns system status.

- **Response**: `200 OK`
  ```json
  { "status": "healthy", "service": "urban-infrastructure-auditor-api" }
  ```

### `GET /system/models`

Returns currently active computer vision model configurations and dimensions.

- **Response**: `200 OK`
  ```json
  {
    "siglip": {
      "model_id": "google/siglip-base-patch16-224",
      "dimension": 768
    },
    "dinov2": { "model_id": "facebook/dinov2-base", "dimension": 768 }
  }
  ```

---

## 2. Dashboard Analytics

### `GET /api/v1/dashboard/summary`

Returns aggregate statistics, staleness distribution, category counts, and dataset records.

- **Response**: `200 OK`
  ```json
  {
    "total_observations": 10000,
    "categories_count": 12,
    "cities_count": 185,
    "states_count": 70,
    "review_queue_count": 9999,
    "with_images_count": 200,
    "missing_images_count": 9800,
    "stale_count": 7677,
    "staleness_breakdown": {
      "recent": 161,
      "aging": 2162,
      "stale": 7677
    },
    "category_counts": [...],
    "datasets_status": [...]
  }
  ```

---

## 3. Observations

### `GET /api/v1/observations`

Lists observations with flexible filtering, sorting, and pagination.

- **Query Parameters**:
  - `page` (int, default: 1)
  - `limit` (int, default: 25, max: 100)
  - `category_id` (string, comma-separated e.g. `ev_chargers,street_trees`)
  - `category_group` (string, e.g. `green_infrastructure`)
  - `verification_status` (string, e.g. `unverified`, `verified_accurate`)
  - `has_image` (boolean)
  - `sort_by` (`date`, `city`, `created_at`)
- **Response**: `200 OK`
  ```json
  {
    "observations": [...],
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 10000,
      "total_pages": 400
    }
  }
  ```

### `GET /api/v1/observations/{id}`

Returns full details for a single observation, including provenance, coordinates, and category metadata.

### `GET /api/v1/observations/{id}/neighbors`

Finds geographically proximate observations within a specified radius (default: 500m).

- **Query Parameters**: `radius_meters` (float, default: 500)

### `GET /api/v1/observations/{id}/similar`

Finds visually similar observations ranked by DINOv2 vector cosine similarity.

- **Query Parameters**: `limit` (int, default: 10)

---

## 4. Geospatial Operations

### `GET /api/v1/geo/observations`

Returns GeoJSON FeatureCollection of observations filtered by bounding box.

- **Query Parameters**: `bbox` (minLon,minLat,maxLon,maxLat), `limit` (max: 2000)

### `GET /api/v1/geo/clusters`

Returns PostGIS grid-based spatial clusters with counts and category dominant classes.

- **Query Parameters**: `grid_size` (float, degrees, default: 0.1)

### `POST /api/v1/geo/compare`

Compares infrastructure statistics and category representations across two geographic bounding boxes.

---

## 5. Visual Search

### `POST /api/v1/search/visual`

Performs multimodal cross-modal search using natural language via SigLIP 2.

- **Request Body**:
  ```json
  {
    "query": "electric vehicle charging equipment",
    "limit": 10,
    "category_id": "ev_chargers"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "query": "electric vehicle charging equipment",
    "results": [
      {
        "id": "obs-...",
        "filename": "ev-charger-....jpg",
        "visual_similarity": 0.281,
        "category_name": "EV Chargers"
      }
    ]
  }
  ```

---

## 6. Review Workflow

### `POST /api/v1/reviews/{id}`

Submits an analyst human verification decision.

- **Request Body**:
  ```json
  {
    "action": "confirm_label",
    "analyst_category_id": "ev_chargers",
    "notes": "Verified dual-port Level 2 charger visible on street curb.",
    "reviewer_id": "analyst-01"
  }
  ```
- **Supported Actions**: `confirm_label`, `reject_label`, `mark_uncertain`, `reassign_category`, `confirm_duplicate`, `reject_duplicate`.
