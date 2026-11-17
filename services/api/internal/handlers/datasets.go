package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/models"
)

type DatasetHandler struct {
	pool *pgxpool.Pool
}

func NewDatasetHandler(pool *pgxpool.Pool) *DatasetHandler {
	return &DatasetHandler{pool: pool}
}

func (h *DatasetHandler) ListDatasets(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.pool.Query(ctx, `
		SELECT id, name, display_name, repository_url, license, attribution, description,
		       total_records, imported_records, image_records, created_at, updated_at
		FROM datasets
		ORDER BY display_name;
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var datasets []models.Dataset
	for rows.Next() {
		var d models.Dataset
		if err := rows.Scan(
			&d.ID, &d.Name, &d.DisplayName, &d.RepositoryURL, &d.License, &d.Attribution, &d.Description,
			&d.TotalRecords, &d.ImportedRecords, &d.ImageRecords, &d.CreatedAt, &d.UpdatedAt,
		); err == nil {
			datasets = append(datasets, d)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(datasets)
}

func (h *DatasetHandler) GetDataset(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	var d models.Dataset
	err := h.pool.QueryRow(ctx, `
		SELECT id, name, display_name, repository_url, license, attribution, description,
		       total_records, imported_records, image_records, created_at, updated_at
		FROM datasets
		WHERE id = $1;
	`, id).Scan(
		&d.ID, &d.Name, &d.DisplayName, &d.RepositoryURL, &d.License, &d.Attribution, &d.Description,
		&d.TotalRecords, &d.ImportedRecords, &d.ImageRecords, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		http.Error(w, "Dataset not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(d)
}

func (h *DatasetHandler) ListImportJobs(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.pool.Query(ctx, `
		SELECT id, dataset_id, status, total_rows, processed_rows, imported_rows, failed_rows, images_resolved, error_message, started_at, completed_at, created_at
		FROM dataset_import_jobs
		ORDER BY started_at DESC
		LIMIT 20;
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var jobs []models.DatasetImportJob
	for rows.Next() {
		var j models.DatasetImportJob
		if err := rows.Scan(
			&j.ID, &j.DatasetID, &j.Status, &j.TotalRows, &j.ProcessedRows, &j.ImportedRows,
			&j.FailedRows, &j.ImagesResolved, &j.ErrorMessage, &j.StartedAt, &j.CompletedAt, &j.CreatedAt,
		); err == nil {
			jobs = append(jobs, j)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(jobs)
}
