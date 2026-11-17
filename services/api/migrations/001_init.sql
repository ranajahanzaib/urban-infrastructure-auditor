-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Datasets table
CREATE TABLE IF NOT EXISTS datasets (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    repository_url VARCHAR(512) NOT NULL,
    license VARCHAR(128) NOT NULL DEFAULT 'CC BY 4.0',
    attribution TEXT NOT NULL,
    description TEXT,
    total_records INT NOT NULL DEFAULT 0,
    imported_records INT NOT NULL DEFAULT 0,
    image_records INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Infrastructure categories table
CREATE TABLE IF NOT EXISTS infrastructure_categories (
    id VARCHAR(64) PRIMARY KEY,
    display_name VARCHAR(128) NOT NULL,
    description TEXT,
    category_group VARCHAR(64) NOT NULL, -- 'green_infrastructure' or 'construction_public_works'
    color_hex VARCHAR(16) NOT NULL,
    source_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Normalized observations table
CREATE TABLE IF NOT EXISTS observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id VARCHAR(64) NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    original_row_id VARCHAR(128),
    filename VARCHAR(255) NOT NULL,
    image_folder VARCHAR(255),
    image_path VARCHAR(512),
    image_availability VARCHAR(32) NOT NULL DEFAULT 'missing', -- 'available', 'missing', 'failed', 'pending'
    image_checksum VARCHAR(128),
    original_feature_label VARCHAR(128) NOT NULL,
    category_id VARCHAR(64) NOT NULL REFERENCES infrastructure_categories(id),
    observed_at TIMESTAMPTZ,
    has_timestamp BOOLEAN NOT NULL DEFAULT FALSE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    country VARCHAR(128),
    state VARCHAR(128),
    city VARCHAR(128),
    source_attribution TEXT,
    dataset_license VARCHAR(128) DEFAULT 'CC BY 4.0',
    verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified', -- 'unverified', 'verified_accurate', 'rejected', 'uncertain'
    analyst_category_id VARCHAR(64) REFERENCES infrastructure_categories(id),
    reviewer_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    reviewed_by VARCHAR(128),
    is_quarantined BOOLEAN NOT NULL DEFAULT FALSE,
    quarantine_reason VARCHAR(255),
    siglip_status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'not_applicable', 'pending', 'completed', 'failed'
    dinov2_status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'not_applicable', 'pending', 'completed', 'failed'
    phash VARCHAR(64),
    raw_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial and relational indexes
CREATE INDEX IF NOT EXISTS idx_observations_location ON observations USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_observations_category ON observations (category_id);
CREATE INDEX IF NOT EXISTS idx_observations_dataset ON observations (dataset_id);
CREATE INDEX IF NOT EXISTS idx_observations_verification ON observations (verification_status);
CREATE INDEX IF NOT EXISTS idx_observations_observed_at ON observations (observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_city_country ON observations (country, state, city);
CREATE INDEX IF NOT EXISTS idx_observations_image_avail ON observations (image_availability);
CREATE INDEX IF NOT EXISTS idx_observations_filename ON observations (filename);

-- Image assets table
CREATE TABLE IF NOT EXISTS image_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    storage_path VARCHAR(512) NOT NULL,
    mime_type VARCHAR(64) NOT NULL DEFAULT 'image/jpeg',
    byte_size BIGINT NOT NULL DEFAULT 0,
    width INT,
    height INT,
    checksum_sha256 VARCHAR(64),
    phash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_image_assets_obs ON image_assets (observation_id);

-- Image embeddings table
CREATE TABLE IF NOT EXISTS image_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    model_name VARCHAR(128) NOT NULL,
    model_version VARCHAR(64) NOT NULL DEFAULT 'main',
    embedding_type VARCHAR(32) NOT NULL, -- 'siglip2_image', 'siglip2_text', 'dinov2'
    dimension INT NOT NULL,
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_obs_model_type UNIQUE (observation_id, embedding_type, model_name)
);
CREATE INDEX IF NOT EXISTS idx_embeddings_siglip ON image_embeddings USING hnsw (embedding vector_cosine_ops) WHERE embedding_type = 'siglip2_image';
CREATE INDEX IF NOT EXISTS idx_embeddings_dinov2 ON image_embeddings USING hnsw (embedding vector_cosine_ops) WHERE embedding_type = 'dinov2';
CREATE INDEX IF NOT EXISTS idx_embeddings_obs ON image_embeddings (observation_id);

-- Observation relations (repeated sightings, near-duplicates, similarity)
CREATE TABLE IF NOT EXISTS observation_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    target_observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    relation_type VARCHAR(64) NOT NULL, -- 'possible_repeat', 'near_duplicate', 'visually_similar', 'geographic_neighbor'
    confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    distance_meters DOUBLE PRECISION NOT NULL DEFAULT 0,
    days_apart DOUBLE PRECISION NOT NULL DEFAULT 0,
    verification_state VARCHAR(32) NOT NULL DEFAULT 'proposed', -- 'proposed', 'confirmed_duplicate', 'related_observation', 'not_related', 'needs_review'
    analyst_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_source_target_rel UNIQUE (source_observation_id, target_observation_id, relation_type)
);
CREATE INDEX IF NOT EXISTS idx_relations_source ON observation_relations (source_observation_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON observation_relations (target_observation_id);
CREATE INDEX IF NOT EXISTS idx_relations_state ON observation_relations (verification_state);

-- Review audit events
CREATE TABLE IF NOT EXISTS review_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    observation_id UUID NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL,
    previous_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    new_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewer_id VARCHAR(128) NOT NULL DEFAULT 'analyst',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_events_obs ON review_events (observation_id);

-- Dataset import jobs tracking
CREATE TABLE IF NOT EXISTS dataset_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id VARCHAR(64) NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    total_rows INT NOT NULL DEFAULT 0,
    processed_rows INT NOT NULL DEFAULT 0,
    imported_rows INT NOT NULL DEFAULT 0,
    failed_rows INT NOT NULL DEFAULT 0,
    images_resolved INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial datasets
INSERT INTO datasets (id, name, display_name, repository_url, license, attribution, description)
VALUES 
    (
        'construction-infrastructure-change',
        'construction-infrastructure-change',
        'Construction & Infrastructure Change',
        'https://huggingface.co/datasets/EDK-Earth/construction-infrastructure-change',
        'CC BY 4.0',
        'EDK-Earth (Mapillary, outerview, and source contributors)',
        'Observation dataset recording construction sites, roadwork, cranes, excavators, scaffolding, and potholes in street-level imagery.'
    ),
    (
        'urban-climate-green-infrastructure',
        'urban-climate-green-infrastructure',
        'Urban Climate & Green Infrastructure',
        'https://huggingface.co/datasets/EDK-Earth/urban-climate-green-infrastructure',
        'CC BY 4.0',
        'EDK-Earth (Mapillary, outerview, and source contributors)',
        'Observation dataset recording street trees, bike lanes, solar panels, EV chargers, rain gardens, and green roofs in street-level imagery.'
    )
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    repository_url = EXCLUDED.repository_url,
    attribution = EXCLUDED.attribution,
    description = EXCLUDED.description;

-- Seed taxonomy categories
INSERT INTO infrastructure_categories (id, display_name, description, category_group, color_hex, source_labels)
VALUES
    -- Green Infrastructure
    ('street_trees', 'Street Trees', 'Mature or planted trees located along streets, curbs, or sidewalks.', 'green_infrastructure', '#10B981', '["Street Tree", "street tree", "street_tree"]'::jsonb),
    ('bike_lanes', 'Bike Lanes', 'Dedicated, painted, or protected bicycle lanes on urban streets.', 'green_infrastructure', '#06B6D4', '["Bike Lane", "bike lane", "bike_lane"]'::jsonb),
    ('solar_panels', 'Solar Panels', 'Rooftop or ground-mounted photovoltaic solar panel installations.', 'green_infrastructure', '#F59E0B', '["Solar Panel", "solar panel", "solar_panel"]'::jsonb),
    ('ev_chargers', 'EV Chargers', 'Electric vehicle charging pedestals and charging stations.', 'green_infrastructure', '#3B82F6', '["EV Charger", "ev charger", "ev_charger"]'::jsonb),
    ('rain_gardens', 'Rain Gardens', 'Engineered bioretention bioswales and roadside rain gardens for stormwater management.', 'green_infrastructure', '#8B5CF6', '["Rain Garden", "rain garden", "rain_garden"]'::jsonb),
    ('green_roofs', 'Green Roofs', 'Vegetated living roofs observed on urban buildings.', 'green_infrastructure', '#14B8A6', '["Green Roof", "green roof", "green_roof"]'::jsonb),
    
    -- Construction & Public Works
    ('construction_sites', 'Construction Sites', 'Active urban building or infrastructure construction worksites.', 'construction_public_works', '#EF4444', '["Construction Site", "construction site", "construction_site"]'::jsonb),
    ('roadwork', 'Roadwork', 'Road repaving, trenching, utility maintenance, or highway repairs.', 'construction_public_works', '#F97316', '["Roadwork", "roadwork", "road work"]'::jsonb),
    ('cranes', 'Cranes', 'Tower cranes, mobile hydraulic cranes, and heavy lifting apparatus.', 'construction_public_works', '#EC4899', '["Crane", "crane"]'::jsonb),
    ('excavators', 'Excavators', 'Heavy earthmoving excavators, backhoes, and trench diggers.', 'construction_public_works', '#D97706', '["Excavator", "excavator"]'::jsonb),
    ('scaffolding', 'Scaffolding', 'Exterior facade scaffolding, shoring, and protective pedestrian walkways.', 'construction_public_works', '#6366F1', '["Scaffolding", "scaffolding"]'::jsonb),
    ('potholes', 'Potholes', 'Damaged road surface asphalt, pavement potholes, and surface depressions.', 'construction_public_works', '#64748B', '["Pothole", "pothole"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category_group = EXCLUDED.category_group,
    color_hex = EXCLUDED.color_hex,
    source_labels = EXCLUDED.source_labels;
