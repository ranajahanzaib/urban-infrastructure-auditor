# Database & Spatial Schema: Urban Infrastructure Auditor

The database is built on PostgreSQL 16 with PostGIS 3.4 and pgvector 0.8.

## 1. Schema Overview

```
                                    +-----------------------+
                                    |       datasets        |
                                    +-----------------------+
                                                | 1
                                                |
                                                | N
+-----------------------------+     +-----------------------+     +-----------------------+
|  infrastructure_categories  |-----|      observations     |-----|     image_assets      |
+-----------------------------+ 1  N+-----------------------+ 1  1+-----------------------+
                                                | 1                           | 1
                                                |                             |
                                                | N                           | N
                                    +-----------------------+     +-----------------------+
                                    |     review_events     |     |   image_embeddings    |
                                    +-----------------------+     +-----------------------+
                                                |
                                                +------------------+
                                                | 1                | 1
                                                v N                v N
                                    +-----------------------------------+
                                    |       observation_relations       |
                                    +-----------------------------------+
```

---

## 2. Table Specifications

### A. `observations`

The primary historical observation ledger.

| Column                   | Type                                               | Description                                                                                    |
| ------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `id`                     | `VARCHAR(64) PRIMARY KEY`                          | Canonical unique observation ID (`obs-...` or UUID).                                           |
| `dataset_id`             | `VARCHAR(64) REFERENCES datasets`                  | Dataset origin (`construction-infrastructure-change` or `urban-climate-green-infrastructure`). |
| `geom`                   | `geometry(Point, 4326)`                            | PostGIS spatial point (Longitude, Latitude). Indexed via `GIST`.                               |
| `latitude`               | `DOUBLE PRECISION`                                 | Validated WGS-84 latitude (-90 to +90).                                                        |
| `longitude`              | `DOUBLE PRECISION`                                 | Validated WGS-84 longitude (-180 to +180).                                                     |
| `observed_at`            | `TIMESTAMPTZ`                                      | Timestamp when the photo was recorded.                                                         |
| `has_timestamp`          | `BOOLEAN`                                          | Explicit flag indicating whether timestamp was present.                                        |
| `category_id`            | `VARCHAR(64) REFERENCES infrastructure_categories` | Normalized category ID.                                                                        |
| `original_feature_label` | `VARCHAR(128)`                                     | Original weak label from dataset (immutable).                                                  |
| `image_availability`     | `VARCHAR(32)`                                      | `'available'`, `'missing'`, `'corrupt'`, `'quarantined'`.                                      |
| `verification_status`    | `VARCHAR(32)`                                      | `'unverified'`, `'verified_accurate'`, `'rejected'`, `'uncertain'`.                            |
| `staleness_state`        | `VARCHAR(32)`                                      | Computed: `'recent'` (<1 yr), `'aging'` (1-3 yrs), `'stale'` (>3 yrs).                         |
| `phash`                  | `VARCHAR(64)`                                      | 64-bit perceptual hash (DHash / AHash) for near-duplicate identification.                      |

### B. `image_embeddings`

Stores high-dimensional ML vectors extracted by computer vision models.

| Column           | Type                                  | Description                                                 |
| ---------------- | ------------------------------------- | ----------------------------------------------------------- |
| `id`             | `UUID PRIMARY KEY`                    | Vector record UUID.                                         |
| `observation_id` | `VARCHAR(64) REFERENCES observations` | Associated observation.                                     |
| `model_name`     | `VARCHAR(64)`                         | `'siglip'` or `'dinov2'`.                                   |
| `model_version`  | `VARCHAR(64)`                         | e.g. `'google/siglip-base-patch16-224'`.                    |
| `dimensions`     | `INT`                                 | 768 dimensions.                                             |
| `embedding`      | `vector(768)`                         | L2-normalized vector. Indexed via HNSW `vector_cosine_ops`. |

### C. `observation_relations`

Graph edges linking observations discovered to be spatially or visually related.

| Column             | Type                                  | Description                                                                        |
| ------------------ | ------------------------------------- | ---------------------------------------------------------------------------------- |
| `id`               | `UUID PRIMARY KEY`                    | Relation UUID.                                                                     |
| `observation_id_a` | `VARCHAR(64) REFERENCES observations` | First observation.                                                                 |
| `observation_id_b` | `VARCHAR(64) REFERENCES observations` | Second observation.                                                                |
| `relation_type`    | `VARCHAR(32)`                         | `'near_duplicate'`, `'spatial_neighbor'`, `'visual_similar'`, `'temporal_repeat'`. |
| `similarity_score` | `FLOAT`                               | Cosine similarity between image embeddings (0.0 to 1.0).                           |
| `distance_meters`  | `FLOAT`                               | Spatial geodesic distance in meters computed via PostGIS `ST_Distance`.            |
| `time_delta_days`  | `FLOAT`                               | Temporal difference in days between photos.                                        |

---

## 3. Spatial & Vector Indexes

1. **GIST Spatial Index on Coordinates**:

   ```sql
   CREATE INDEX idx_observations_geom ON observations USING GIST (geom);
   ```

   Enables sub-millisecond bounding box lookups (`ST_MakeEnvelope`) and fast spatial neighbor searches (`ST_DWithin`).

2. **HNSW Cosine Vector Indexes**:

   ```sql
   CREATE INDEX idx_image_embeddings_siglip_hnsw
   ON image_embeddings USING hnsw (embedding vector_cosine_ops)
   WHERE model_name = 'siglip';

   CREATE INDEX idx_image_embeddings_dinov2_hnsw
   ON image_embeddings USING hnsw (embedding vector_cosine_ops)
   WHERE model_name = 'dinov2';
   ```

   Provides high-recall (>99%) nearest neighbor searches with index parameter `m=16`, `ef_construction=64`.

3. **Composite Filtering Indexes**:
   ```sql
   CREATE INDEX idx_observations_cat_status ON observations (category_id, verification_status);
   CREATE INDEX idx_observations_observed_at ON observations (observed_at DESC NULLS LAST);
   CREATE INDEX idx_observations_city ON observations (city);
   ```
