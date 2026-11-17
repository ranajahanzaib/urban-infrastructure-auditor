FROM pgvector/pgvector:pg16

LABEL maintainer="urban-infrastructure-auditor"
LABEL description="PostgreSQL 16 with PostGIS 3 and pgvector"

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        postgresql-16-postgis-3 \
        postgresql-16-postgis-3-scripts && \
    rm -rf /var/lib/apt/lists/*
