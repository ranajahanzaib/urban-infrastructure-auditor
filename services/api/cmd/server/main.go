package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/config"
	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/db"
	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/handlers"
)

func main() {
	cfg := config.Load()
	log.Printf("Starting Urban Infrastructure Auditor API on port %s (env: %s)...", cfg.Port, cfg.Environment)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Fatal: Database initialization error: %v", err)
	}
	defer pool.Close()

	r := chi.NewRouter()

	// Standard middleware
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(60 * time.Second))

	// CORS configuration
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Handlers
	dashH := handlers.NewDashboardHandler(pool)
	obsH := handlers.NewObservationHandler(pool)
	geoH := handlers.NewGeoHandler(pool)
	searchH := handlers.NewVisualSearchHandler(pool, cfg.VisionServiceURL)
	revH := handlers.NewReviewHandler(pool)
	dsH := handlers.NewDatasetHandler(pool)
	expH := handlers.NewExportHandler(pool)
	sysH := handlers.NewSystemHandler(pool, cfg.VisionServiceURL)
	imgH := handlers.NewImageHandler(cfg.StorageDir)

	// Top-level Health checks
	r.Get("/health", sysH.Health)
	r.Get("/ready", sysH.Ready)

	// API v1 Router
	r.Route("/api/v1", func(v1 chi.Router) {
		// Health & System
		v1.Get("/health", sysH.Health)
		v1.Get("/ready", sysH.Ready)
		v1.Get("/system/models", sysH.Models)
		v1.Get("/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/yaml")
			// Try both locations (from services/api or from project root)
			if _, err := os.Stat("services/api/docs/openapi.yaml"); err == nil {
				http.ServeFile(w, r, "services/api/docs/openapi.yaml")
				return
			}
			http.ServeFile(w, r, "docs/openapi.yaml")
		})

		// Dashboard
		v1.Get("/dashboard/summary", dashH.GetSummary)
		v1.Get("/dashboard/categories", dashH.GetCategories)
		v1.Get("/dashboard/timeline", dashH.GetTimeline)
		v1.Get("/dashboard/coverage", dashH.GetCoverage)

		// Observations
		v1.Get("/observations", obsH.List)
		v1.Get("/observations/{id}", obsH.GetByID)
		v1.Get("/observations/{id}/neighbors", obsH.GetNeighbors)
		v1.Get("/observations/{id}/similar", obsH.GetSimilar)
		v1.Get("/observations/{id}/history", obsH.GetHistory)

		// Geospatial
		v1.Get("/geo/observations", geoH.GetGeoObservations)
		v1.Get("/geo/clusters", geoH.GetClusters)
		v1.Get("/geo/density", geoH.GetDensity)
		v1.Post("/geo/compare", geoH.CompareAreas)

		// Visual Search
		v1.Post("/search/visual", searchH.SearchVisual)
		v1.Get("/search/similar-groups", searchH.GetSimilarGroups)

		// Reviews
		v1.Get("/reviews", revH.ListReviews)
		v1.Post("/reviews/{id}", revH.SubmitReview)
		v1.Post("/reviews/bulk", revH.BulkReview)
		v1.Get("/reviews/{id}/history", revH.GetReviewHistory)

		// Datasets
		v1.Get("/datasets", dsH.ListDatasets)
		v1.Get("/datasets/{id}", dsH.GetDataset)
		v1.Get("/import-jobs", dsH.ListImportJobs)

		// Exports
		v1.Get("/export/observations.csv", expH.ExportCSV)
		v1.Get("/export/observations.geojson", expH.ExportGeoJSON)

		// Static Images
		v1.Get("/images/*", imgH.ServeImage)
	})

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Server listening on port %s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-sigChan
	log.Println("Shutting down API server gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Forced shutdown error: %v", err)
	}
	log.Println("API server stopped.")
}
