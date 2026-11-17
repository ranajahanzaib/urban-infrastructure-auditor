# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-17

### Added

- **Core Platform**: Street-level infrastructure observation intelligence ledger built with Go Chi and Next.js 15 App Router.
- **Geospatial & Vector Database**: PostgreSQL 16 with PostGIS 3.4 (`geometry(Point, 4326)`) and pgvector 0.8 with HNSW cosine distance indexing (`vector(768)`).
- **Multimodal Visual Search**: SigLIP 2 (`google/siglip-base-patch16-224`) cross-modal text-to-image semantic search pipeline.
- **Visual Similarity & Deduplication**: DINOv2 Base (`facebook/dinov2-base`) feature extractor and pairwise cosine similarity matrix for near-duplicate candidate discovery.
- **Ingestion CLI**: Extensible dataset ingestion tool supporting EDK-Earth construction and green infrastructure datasets with coordinate bounds validation and image resolver.
- **10 Interactive Views**: Executive Dashboard, MapLibre GL Map Explorer, Observation Catalog, Detail Inspector with 5-section provenance, Visual Search, Near-Duplicate Similarity Review, Timeline Explorer, Analyst Verification Queue, Geographic Area Comparison, and Data Sources view.
- **Automated Test Suites**: Comprehensive unit and end-to-end integration tests covering ingestion, ML pipelines, Go API endpoints, and web pages.
