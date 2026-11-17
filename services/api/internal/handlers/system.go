package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SystemHandler struct {
	pool             *pgxpool.Pool
	visionServiceURL string
}

func NewSystemHandler(pool *pgxpool.Pool, visionServiceURL string) *SystemHandler {
	return &SystemHandler{pool: pool, visionServiceURL: visionServiceURL}
}

func (h *SystemHandler) Health(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	dbStatus := "healthy"
	if err := h.pool.Ping(ctx); err != nil {
		dbStatus = "unreachable"
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "healthy",
		"service":     "urban-infrastructure-auditor-api",
		"database":    dbStatus,
		"vision_url":  h.visionServiceURL,
		"environment": "production",
	})
}

func (h *SystemHandler) Ready(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if err := h.pool.Ping(ctx); err != nil {
		http.Error(w, "Database not ready", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"ready": true})
}

func (h *SystemHandler) Models(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"multimodal_retrieval_model": map[string]interface{}{
			"name":      "SigLIP",
			"model_id":  "google/siglip-base-patch16-224",
			"dimension": 768,
			"purpose":   "Cross-modal text-to-image and natural-language visual search",
			"status":    "active",
		},
		"visual_similarity_model": map[string]interface{}{
			"name":      "DINOv2",
			"model_id":  "facebook/dinov2-base",
			"dimension": 768,
			"purpose":   "Image-to-image similarity, visual clustering, and near-duplicate discovery",
			"status":    "active",
		},
	})
}
