package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/models"
)

type ReviewHandler struct {
	pool *pgxpool.Pool
}

func NewReviewHandler(pool *pgxpool.Pool) *ReviewHandler {
	return &ReviewHandler{pool: pool}
}

type ReviewActionRequest struct {
	Action            string  `json:"action"` // confirm_label, reject_label, mark_uncertain, reassign_category, confirm_duplicate, reject_duplicate
	AnalystCategoryID *string `json:"analyst_category_id,omitempty"`
	Notes             *string `json:"notes,omitempty"`
	ReviewerID        string  `json:"reviewer_id,omitempty"`
	RelationID        *string `json:"relation_id,omitempty"`
}

type BulkReviewRequest struct {
	ObservationIDs []string            `json:"observation_ids"`
	Action         ReviewActionRequest `json:"action"`
}

func (h *ReviewHandler) ListReviews(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	queueType := q.Get("queue") // unverified, duplicates, uncertain, quarantined
	if queueType == "" {
		queueType = "unverified"
	}

	whereClause := "WHERE o.verification_status = 'unverified'"
	switch queueType {
	case "unverified":
		whereClause = "WHERE o.verification_status = 'unverified' AND o.image_availability = 'available'"
	case "uncertain":
		whereClause = "WHERE o.verification_status = 'uncertain'"
	case "quarantined":
		whereClause = "WHERE o.is_quarantined = TRUE"
	case "all":
		whereClause = "WHERE 1=1"
	}

	query := fmt.Sprintf(`
		SELECT 
			o.id, o.dataset_id, d.display_name, o.filename, o.image_path, o.image_availability,
			o.original_feature_label, o.category_id, c.display_name, c.category_group, c.color_hex,
			o.observed_at, o.has_timestamp, o.latitude, o.longitude, o.city, o.state, o.country,
			o.verification_status, o.analyst_category_id, o.reviewer_notes,
			o.reviewed_at, o.reviewed_by, o.is_quarantined, o.quarantine_reason,
			o.siglip_status, o.dinov2_status, o.phash, o.created_at, o.updated_at
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		JOIN datasets d ON o.dataset_id = d.id
		%s
		ORDER BY o.created_at DESC
		LIMIT 50;
	`, whereClause)

	rows, err := h.pool.Query(ctx, query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var observations []models.Observation
	for rows.Next() {
		var obs models.Observation
		if err := rows.Scan(
			&obs.ID, &obs.DatasetID, &obs.DatasetName, &obs.Filename, &obs.ImagePath, &obs.ImageAvailability,
			&obs.OriginalFeatureLabel, &obs.CategoryID, &obs.CategoryName, &obs.CategoryGroup, &obs.CategoryColor,
			&obs.ObservedAt, &obs.HasTimestamp, &obs.Latitude, &obs.Longitude, &obs.City, &obs.State, &obs.Country,
			&obs.VerificationStatus, &obs.AnalystCategoryID, &obs.ReviewerNotes,
			&obs.ReviewedAt, &obs.ReviewedBy, &obs.IsQuarantined, &obs.QuarantineReason,
			&obs.SiglipStatus, &obs.Dinov2Status, &obs.PHash, &obs.CreatedAt, &obs.UpdatedAt,
		); err == nil {
			obs.StalenessState = calculateStaleness(obs.ObservedAt)
			if obs.ImagePath != nil && *obs.ImagePath != "" {
				url := "/api/v1/images/" + *obs.ImagePath
				obs.ImageURL = &url
			}
			observations = append(observations, obs)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"queue":        queueType,
		"count":        len(observations),
		"observations": observations,
	})
}

func (h *ReviewHandler) SubmitReview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	obsID := chi.URLParam(r, "id")

	var req ReviewActionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid review request payload", http.StatusBadRequest)
		return
	}

	if req.ReviewerID == "" {
		req.ReviewerID = "analyst"
	}

	// Fetch previous state
	var prevStatus string
	var prevCategoryID string
	err := h.pool.QueryRow(ctx, "SELECT verification_status, category_id FROM observations WHERE id = $1", obsID).Scan(&prevStatus, &prevCategoryID)
	if err != nil {
		http.Error(w, "Observation not found", http.StatusNotFound)
		return
	}

	newStatus := prevStatus
	newCategoryID := prevCategoryID

	switch req.Action {
	case "confirm_label":
		newStatus = "verified_accurate"
	case "reject_label":
		newStatus = "rejected"
	case "mark_uncertain":
		newStatus = "uncertain"
	case "reassign_category":
		if req.AnalystCategoryID != nil && *req.AnalystCategoryID != "" {
			newCategoryID = *req.AnalystCategoryID
			newStatus = "verified_accurate"
		}
	}

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		http.Error(w, "Transaction start failed", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// Update observation
	now := time.Now()
	_, err = tx.Exec(ctx, `
		UPDATE observations
		SET verification_status = $1,
			analyst_category_id = $2,
			reviewer_notes = $3,
			reviewed_at = $4,
			reviewed_by = $5,
			updated_at = NOW()
		WHERE id = $6;
	`, newStatus, req.AnalystCategoryID, req.Notes, now, req.ReviewerID, obsID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to update observation: %v", err), http.StatusInternalServerError)
		return
	}

	// Update relation if relation_id was provided
	if req.RelationID != nil && *req.RelationID != "" {
		relState := "needs_review"
		if req.Action == "confirm_duplicate" {
			relState = "confirmed_duplicate"
		} else if req.Action == "reject_duplicate" {
			relState = "not_related"
		}
		_, _ = tx.Exec(ctx, `
			UPDATE observation_relations
			SET verification_state = $1, analyst_notes = $2, updated_at = NOW()
			WHERE id = $3;
		`, relState, req.Notes, *req.RelationID)
	}

	// Record audit event
	prevStateMap := map[string]interface{}{"status": prevStatus, "category_id": prevCategoryID}
	newStateMap := map[string]interface{}{"status": newStatus, "category_id": newCategoryID}
	prevJSON, _ := json.Marshal(prevStateMap)
	newJSON, _ := json.Marshal(newStateMap)

	eventID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO review_events (id, observation_id, action, previous_state, new_state, reviewer_id, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
	`, eventID, obsID, req.Action, prevJSON, newJSON, req.ReviewerID, req.Notes, now)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to record review event: %v", err), http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, "Transaction commit failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":      "success",
		"event_id":    eventID.String(),
		"new_status":  newStatus,
		"reviewed_at": now,
	})
}

func (h *ReviewHandler) BulkReview(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var req BulkReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid bulk review payload", http.StatusBadRequest)
		return
	}

	if len(req.ObservationIDs) == 0 {
		http.Error(w, "No observation IDs provided", http.StatusBadRequest)
		return
	}

	count := 0
	for _, id := range req.ObservationIDs {
		// Apply individually in transaction
		tx, err := h.pool.Begin(ctx)
		if err != nil {
			continue
		}
		newStatus := "verified_accurate"
		if req.Action.Action == "reject_label" {
			newStatus = "rejected"
		} else if req.Action.Action == "mark_uncertain" {
			newStatus = "uncertain"
		}

		now := time.Now()
		_, _ = tx.Exec(ctx, `
			UPDATE observations
			SET verification_status = $1, reviewed_at = $2, reviewed_by = $3, updated_at = NOW()
			WHERE id = $4;
		`, newStatus, now, req.Action.ReviewerID, id)

		eventID := uuid.New()
		_, _ = tx.Exec(ctx, `
			INSERT INTO review_events (id, observation_id, action, previous_state, new_state, reviewer_id, notes, created_at)
			VALUES ($1, $2, $3, '{}'::jsonb, '{}'::jsonb, $4, $5, $6);
		`, eventID, id, req.Action.Action, req.Action.ReviewerID, req.Action.Notes, now)

		if err := tx.Commit(ctx); err == nil {
			count++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":          "success",
		"reviewed_count":  count,
		"requested_count": len(req.ObservationIDs),
	})
}

func (h *ReviewHandler) GetReviewHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	obsID := chi.URLParam(r, "id")

	query := `
		SELECT id, observation_id, action, previous_state, new_state, reviewer_id, notes, created_at
		FROM review_events
		WHERE observation_id = $1
		ORDER BY created_at DESC;
	`
	rows, err := h.pool.Query(ctx, query, obsID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var events []models.ReviewEvent
	for rows.Next() {
		var ev models.ReviewEvent
		var prevBytes, newBytes []byte
		if err := rows.Scan(&ev.ID, &ev.ObservationID, &ev.Action, &prevBytes, &newBytes, &ev.ReviewerID, &ev.Notes, &ev.CreatedAt); err == nil {
			_ = json.Unmarshal(prevBytes, &ev.PreviousState)
			_ = json.Unmarshal(newBytes, &ev.NewState)
			events = append(events, ev)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(events)
}
