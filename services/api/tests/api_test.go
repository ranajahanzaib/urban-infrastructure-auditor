package tests

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/config"
	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/db"
)

func getTestPool(t *testing.T) *pgxpool.Pool {
	cfg := config.Load()
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		cfg.DatabaseURL = dbURL
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		t.Skipf("Postgres not available for integration tests: %v", err)
	}
	return pool
}

func TestDatabaseConnection(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	var count int
	err := pool.QueryRow(context.Background(), "SELECT COUNT(*) FROM infrastructure_categories;").Scan(&count)
	if err != nil {
		t.Fatalf("Query failed: %v", err)
	}
	if count < 12 {
		t.Errorf("Expected at least 12 categories, got %d", count)
	}
}

func TestObservationQueries(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()

	// Test category filter
	var catCount int
	err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM observations WHERE category_id = 'street_trees';").Scan(&catCount)
	if err != nil {
		t.Fatalf("Category count failed: %v", err)
	}

	// Test bounding box spatial query
	var bboxCount int
	err = pool.QueryRow(ctx, `
		SELECT COUNT(*) 
		FROM observations 
		WHERE location && ST_MakeEnvelope(-180, -90, 180, 90, 4326);
	`).Scan(&bboxCount)
	if err != nil {
		t.Fatalf("Spatial envelope query failed: %v", err)
	}
	if bboxCount == 0 {
		t.Log("Note: No observations found in global bbox")
	}
}

func TestEmbeddingsVectorQuery(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()

	var embedCount int
	err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM image_embeddings WHERE embedding_type = 'siglip2_image';").Scan(&embedCount)
	if err != nil {
		t.Fatalf("Image embeddings count query failed: %v", err)
	}
	t.Logf("Total SigLIP embeddings in DB: %d", embedCount)
}

func TestObservationRelations(t *testing.T) {
	pool := getTestPool(t)
	defer pool.Close()

	ctx := context.Background()

	var relCount int
	err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM observation_relations;").Scan(&relCount)
	if err != nil {
		t.Fatalf("Relations query failed: %v", err)
	}
	t.Logf("Total candidate relations discovered: %d", relCount)
}
