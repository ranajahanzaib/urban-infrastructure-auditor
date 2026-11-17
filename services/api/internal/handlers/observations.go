package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/models"
)

type ObservationHandler struct {
	pool *pgxpool.Pool
}

func NewObservationHandler(pool *pgxpool.Pool) *ObservationHandler {
	return &ObservationHandler{pool: pool}
}

func (h *ObservationHandler) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 25
	}
	offset := (page - 1) * limit

	var whereClauses []string
	var args []interface{}
	argIdx := 1

	if cat := q.Get("category_id"); cat != "" {
		cats := strings.Split(cat, ",")
		whereClauses = append(whereClauses, fmt.Sprintf("o.category_id = ANY($%d)", argIdx))
		args = append(args, cats)
		argIdx++
	}

	if group := q.Get("category_group"); group != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("c.category_group = $%d", argIdx))
		args = append(args, group)
		argIdx++
	}

	if ds := q.Get("dataset_id"); ds != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("o.dataset_id = $%d", argIdx))
		args = append(args, ds)
		argIdx++
	}

	if city := q.Get("city"); city != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("LOWER(o.city) = LOWER($%d)", argIdx))
		args = append(args, city)
		argIdx++
	}

	if state := q.Get("state"); state != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("LOWER(o.state) = LOWER($%d)", argIdx))
		args = append(args, state)
		argIdx++
	}

	if status := q.Get("verification_status"); status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("o.verification_status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	if avail := q.Get("image_availability"); avail != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("o.image_availability = $%d", argIdx))
		args = append(args, avail)
		argIdx++
	}

	if search := q.Get("search"); search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(o.filename ILIKE $%d OR o.original_feature_label ILIKE $%d OR o.city ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	if bbox := q.Get("bbox"); bbox != "" {
		parts := strings.Split(bbox, ",")
		if len(parts) == 4 {
			minLon, _ := strconv.ParseFloat(parts[0], 64)
			minLat, _ := strconv.ParseFloat(parts[1], 64)
			maxLon, _ := strconv.ParseFloat(parts[2], 64)
			maxLat, _ := strconv.ParseFloat(parts[3], 64)
			whereClauses = append(whereClauses, fmt.Sprintf("o.location && ST_MakeEnvelope($%d, $%d, $%d, $%d, 4326)", argIdx, argIdx+1, argIdx+2, argIdx+3))
			args = append(args, minLon, minLat, maxLon, maxLat)
			argIdx += 4
		}
	}

	if staleness := q.Get("staleness"); staleness != "" {
		switch staleness {
		case "recent":
			whereClauses = append(whereClauses, "o.observed_at >= NOW() - INTERVAL '1 year'")
		case "aging":
			whereClauses = append(whereClauses, "o.observed_at < NOW() - INTERVAL '1 year' AND o.observed_at >= NOW() - INTERVAL '3 years'")
		case "stale":
			whereClauses = append(whereClauses, "o.observed_at < NOW() - INTERVAL '3 years'")
		case "undated":
			whereClauses = append(whereClauses, "o.observed_at IS NULL")
		}
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM observations o JOIN infrastructure_categories c ON o.category_id = c.id %s", whereSQL)
	var total int64
	if err := h.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Fetch page
	sortBy := "o.created_at"
	switch q.Get("sort_by") {
	case "date", "observed_at":
		sortBy = "o.observed_at DESC NULLS LAST"
	case "city":
		sortBy = "o.city ASC NULLS LAST"
	}

	dataQuery := fmt.Sprintf(`
		SELECT 
			o.id, o.dataset_id, d.display_name, o.original_row_id, o.filename, o.image_folder,
			o.image_path, o.image_availability, o.image_checksum, o.original_feature_label,
			o.category_id, c.display_name, c.category_group, c.color_hex,
			o.observed_at, o.has_timestamp, o.latitude, o.longitude,
			o.country, o.state, o.city, o.source_attribution, o.dataset_license,
			o.verification_status, o.analyst_category_id, o.reviewer_notes,
			o.reviewed_at, o.reviewed_by, o.is_quarantined, o.quarantine_reason,
			o.siglip_status, o.dinov2_status, o.phash, o.created_at, o.updated_at
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		JOIN datasets d ON o.dataset_id = d.id
		%s
		ORDER BY %s
		LIMIT $%d OFFSET $%d;
	`, whereSQL, sortBy, argIdx, argIdx+1)

	args = append(args, limit, offset)
	rows, err := h.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var observations []models.Observation
	for rows.Next() {
		var obs models.Observation
		if err := rows.Scan(
			&obs.ID, &obs.DatasetID, &obs.DatasetName, &obs.OriginalRowID, &obs.Filename, &obs.ImageFolder,
			&obs.ImagePath, &obs.ImageAvailability, &obs.ImageChecksum, &obs.OriginalFeatureLabel,
			&obs.CategoryID, &obs.CategoryName, &obs.CategoryGroup, &obs.CategoryColor,
			&obs.ObservedAt, &obs.HasTimestamp, &obs.Latitude, &obs.Longitude,
			&obs.Country, &obs.State, &obs.City, &obs.SourceAttribution, &obs.DatasetLicense,
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

	totalPages := (total + int64(limit) - 1) / int64(limit)
	resp := map[string]interface{}{
		"observations": observations,
		"pagination": map[string]interface{}{
			"page":        page,
			"limit":       limit,
			"total":       total,
			"total_pages": totalPages,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *ObservationHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	query := `
		SELECT 
			o.id, o.dataset_id, d.display_name, o.original_row_id, o.filename, o.image_folder,
			o.image_path, o.image_availability, o.image_checksum, o.original_feature_label,
			o.category_id, c.display_name, c.category_group, c.color_hex,
			o.observed_at, o.has_timestamp, o.latitude, o.longitude,
			o.country, o.state, o.city, o.source_attribution, o.dataset_license,
			o.verification_status, o.analyst_category_id, o.reviewer_notes,
			o.reviewed_at, o.reviewed_by, o.is_quarantined, o.quarantine_reason,
			o.siglip_status, o.dinov2_status, o.phash, o.raw_metadata, o.created_at, o.updated_at
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		JOIN datasets d ON o.dataset_id = d.id
		WHERE o.id = $1;
	`

	var obs models.Observation
	var rawMetaBytes []byte
	err := h.pool.QueryRow(ctx, query, id).Scan(
		&obs.ID, &obs.DatasetID, &obs.DatasetName, &obs.OriginalRowID, &obs.Filename, &obs.ImageFolder,
		&obs.ImagePath, &obs.ImageAvailability, &obs.ImageChecksum, &obs.OriginalFeatureLabel,
		&obs.CategoryID, &obs.CategoryName, &obs.CategoryGroup, &obs.CategoryColor,
		&obs.ObservedAt, &obs.HasTimestamp, &obs.Latitude, &obs.Longitude,
		&obs.Country, &obs.State, &obs.City, &obs.SourceAttribution, &obs.DatasetLicense,
		&obs.VerificationStatus, &obs.AnalystCategoryID, &obs.ReviewerNotes,
		&obs.ReviewedAt, &obs.ReviewedBy, &obs.IsQuarantined, &obs.QuarantineReason,
		&obs.SiglipStatus, &obs.Dinov2Status, &obs.PHash, &rawMetaBytes, &obs.CreatedAt, &obs.UpdatedAt,
	)
	if err != nil {
		http.Error(w, "Observation not found", http.StatusNotFound)
		return
	}

	if len(rawMetaBytes) > 0 {
		_ = json.Unmarshal(rawMetaBytes, &obs.RawMetadata)
	}
	obs.StalenessState = calculateStaleness(obs.ObservedAt)
	if obs.ImagePath != nil && *obs.ImagePath != "" {
		url := "/api/v1/images/" + *obs.ImagePath
		obs.ImageURL = &url
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(obs)
}

func (h *ObservationHandler) GetNeighbors(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")
	radiusMeters := 2000.0 // 2km default
	if rStr := r.URL.Query().Get("radius"); rStr != "" {
		if val, err := strconv.ParseFloat(rStr, 64); err == nil && val > 0 {
			radiusMeters = val
		}
	}

	query := `
		SELECT 
			o.id, o.dataset_id, d.display_name, o.filename, o.image_path, o.image_availability,
			o.original_feature_label, o.category_id, c.display_name, c.category_group, c.color_hex,
			o.observed_at, o.has_timestamp, o.latitude, o.longitude, o.city, o.state, o.country,
			o.verification_status, o.created_at, o.updated_at,
			ST_Distance(o.location::geography, target.location::geography) as distance_meters
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		JOIN datasets d ON o.dataset_id = d.id,
		(SELECT location FROM observations WHERE id = $1) target
		WHERE o.id != $1
		  AND ST_DWithin(o.location::geography, target.location::geography, $2)
		ORDER BY distance_meters ASC
		LIMIT 15;
	`

	rows, err := h.pool.Query(ctx, query, id, radiusMeters)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var neighbors []models.Observation
	for rows.Next() {
		var obs models.Observation
		if err := rows.Scan(
			&obs.ID, &obs.DatasetID, &obs.DatasetName, &obs.Filename, &obs.ImagePath, &obs.ImageAvailability,
			&obs.OriginalFeatureLabel, &obs.CategoryID, &obs.CategoryName, &obs.CategoryGroup, &obs.CategoryColor,
			&obs.ObservedAt, &obs.HasTimestamp, &obs.Latitude, &obs.Longitude, &obs.City, &obs.State, &obs.Country,
			&obs.VerificationStatus, &obs.CreatedAt, &obs.UpdatedAt, &obs.DistanceMeters,
		); err == nil {
			obs.StalenessState = calculateStaleness(obs.ObservedAt)
			if obs.ImagePath != nil && *obs.ImagePath != "" {
				url := "/api/v1/images/" + *obs.ImagePath
				obs.ImageURL = &url
			}
			neighbors = append(neighbors, obs)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(neighbors)
}

func (h *ObservationHandler) GetSimilar(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	query := `
		SELECT 
			o.id, o.dataset_id, d.display_name, o.filename, o.image_path, o.image_availability,
			o.original_feature_label, o.category_id, c.display_name, c.category_group, c.color_hex,
			o.observed_at, o.has_timestamp, o.latitude, o.longitude, o.city, o.state, o.country,
			o.verification_status, o.created_at, o.updated_at,
			(1 - (e.embedding <=> target.embedding)) as visual_similarity
		FROM image_embeddings e
		JOIN observations o ON e.observation_id = o.id
		JOIN infrastructure_categories c ON o.category_id = c.id
		JOIN datasets d ON o.dataset_id = d.id,
		(SELECT embedding FROM image_embeddings WHERE observation_id = $1 AND embedding_type = 'dinov2' LIMIT 1) target
		WHERE e.embedding_type = 'dinov2'
		  AND e.observation_id != $1
		ORDER BY e.embedding <=> target.embedding ASC
		LIMIT 12;
	`

	rows, err := h.pool.Query(ctx, query, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var similar []models.Observation
	for rows.Next() {
		var obs models.Observation
		if err := rows.Scan(
			&obs.ID, &obs.DatasetID, &obs.DatasetName, &obs.Filename, &obs.ImagePath, &obs.ImageAvailability,
			&obs.OriginalFeatureLabel, &obs.CategoryID, &obs.CategoryName, &obs.CategoryGroup, &obs.CategoryColor,
			&obs.ObservedAt, &obs.HasTimestamp, &obs.Latitude, &obs.Longitude, &obs.City, &obs.State, &obs.Country,
			&obs.VerificationStatus, &obs.CreatedAt, &obs.UpdatedAt, &obs.VisualSimilarity,
		); err == nil {
			obs.StalenessState = calculateStaleness(obs.ObservedAt)
			if obs.ImagePath != nil && *obs.ImagePath != "" {
				url := "/api/v1/images/" + *obs.ImagePath
				obs.ImageURL = &url
			}
			similar = append(similar, obs)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(similar)
}

func (h *ObservationHandler) GetHistory(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id := chi.URLParam(r, "id")

	query := `
		SELECT 
			o.id, o.dataset_id, d.display_name, o.filename, o.image_path, o.image_availability,
			o.original_feature_label, o.category_id, c.display_name, c.category_group, c.color_hex,
			o.observed_at, o.has_timestamp, o.latitude, o.longitude, o.city, o.state, o.country,
			o.verification_status, o.created_at, o.updated_at,
			ST_Distance(o.location::geography, target.location::geography) as distance_meters
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		JOIN datasets d ON o.dataset_id = d.id,
		(SELECT location FROM observations WHERE id = $1) target
		WHERE ST_DWithin(o.location::geography, target.location::geography, 300)
		ORDER BY o.observed_at ASC NULLS LAST
		LIMIT 20;
	`

	rows, err := h.pool.Query(ctx, query, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var history []models.Observation
	for rows.Next() {
		var obs models.Observation
		if err := rows.Scan(
			&obs.ID, &obs.DatasetID, &obs.DatasetName, &obs.Filename, &obs.ImagePath, &obs.ImageAvailability,
			&obs.OriginalFeatureLabel, &obs.CategoryID, &obs.CategoryName, &obs.CategoryGroup, &obs.CategoryColor,
			&obs.ObservedAt, &obs.HasTimestamp, &obs.Latitude, &obs.Longitude, &obs.City, &obs.State, &obs.Country,
			&obs.VerificationStatus, &obs.CreatedAt, &obs.UpdatedAt, &obs.DistanceMeters,
		); err == nil {
			obs.StalenessState = calculateStaleness(obs.ObservedAt)
			if obs.ImagePath != nil && *obs.ImagePath != "" {
				url := "/api/v1/images/" + *obs.ImagePath
				obs.ImageURL = &url
			}
			history = append(history, obs)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(history)
}
