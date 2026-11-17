package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/models"
)

type VisualSearchHandler struct {
	pool             *pgxpool.Pool
	visionServiceURL string
	httpClient       *http.Client
}

func NewVisualSearchHandler(pool *pgxpool.Pool, visionServiceURL string) *VisualSearchHandler {
	return &VisualSearchHandler{
		pool:             pool,
		visionServiceURL: visionServiceURL,
		httpClient:       &http.Client{Timeout: 30 * time.Second},
	}
}

type VisualSearchRequest struct {
	Query      string    `json:"query"`
	Limit      int       `json:"limit"`
	CategoryID string    `json:"category_id"`
	BBox       []float64 `json:"bbox"`
}

type TextEmbedResponse struct {
	Model     string    `json:"model"`
	Dimension int       `json:"dimension"`
	Embedding []float32 `json:"embedding"`
}

func (h *VisualSearchHandler) SearchVisual(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req VisualSearchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid search request body", http.StatusBadRequest)
		return
	}

	if req.Query == "" {
		http.Error(w, "Query text is required", http.StatusBadRequest)
		return
	}
	if req.Limit <= 0 || req.Limit > 50 {
		req.Limit = 20
	}

	// 1. Call Python Vision service to encode query text
	embedReqBody, _ := json.Marshal(map[string]string{"text": req.Query})
	embedURL := h.visionServiceURL + "/embed/text"

	resp, err := h.httpClient.Post(embedURL, "application/json", bytes.NewBuffer(embedReqBody))
	if err != nil {
		http.Error(w, fmt.Sprintf("Vision service unreachable at %s: %v", h.visionServiceURL, err), http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		http.Error(w, fmt.Sprintf("Vision service embedding failed: %s", string(body)), http.StatusInternalServerError)
		return
	}

	var embedResp TextEmbedResponse
	if err := json.NewDecoder(resp.Body).Decode(&embedResp); err != nil {
		http.Error(w, "Failed to decode vision embedding response", http.StatusInternalServerError)
		return
	}

	// Format vector as string for pgvector '[0.1, 0.2, ...]'
	vecBuf := bytes.NewBufferString("[")
	for i, val := range embedResp.Embedding {
		if i > 0 {
			vecBuf.WriteString(",")
		}
		vecBuf.WriteString(fmt.Sprintf("%.6f", val))
	}
	vecBuf.WriteString("]")
	vecStr := vecBuf.String()

	// 2. Query pgvector for most similar SigLIP image embeddings
	whereClause := "WHERE e.embedding_type = 'siglip2_image'"
	args := []interface{}{vecStr, req.Limit}
	argIdx := 3

	if req.CategoryID != "" {
		whereClause += fmt.Sprintf(" AND o.category_id = $%d", argIdx)
		args = append(args, req.CategoryID)
		argIdx++
	}

	if len(req.BBox) == 4 {
		whereClause += fmt.Sprintf(" AND o.location && ST_MakeEnvelope($%d, $%d, $%d, $%d, 4326)", argIdx, argIdx+1, argIdx+2, argIdx+3)
		args = append(args, req.BBox[0], req.BBox[1], req.BBox[2], req.BBox[3])
		argIdx += 4
	}

	query := fmt.Sprintf(`
		SELECT 
			o.id, o.dataset_id, d.display_name, o.filename, o.image_path, o.image_availability,
			o.original_feature_label, o.category_id, c.display_name, c.category_group, c.color_hex,
			o.observed_at, o.has_timestamp, o.latitude, o.longitude, o.city, o.state, o.country,
			o.verification_status, o.created_at, o.updated_at,
			(1 - (e.embedding <=> $1::vector)) as visual_similarity
		FROM image_embeddings e
		JOIN observations o ON e.observation_id = o.id
		JOIN infrastructure_categories c ON o.category_id = c.id
		JOIN datasets d ON o.dataset_id = d.id
		%s
		ORDER BY e.embedding <=> $1::vector ASC
		LIMIT $2;
	`, whereClause)

	rows, err := h.pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, fmt.Sprintf("Vector search query failed: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var matches []models.Observation
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
			matches = append(matches, obs)
		}
	}

	result := map[string]interface{}{
		"query":         req.Query,
		"model":         embedResp.Model,
		"results_count": len(matches),
		"results":       matches,
		"scoring_note":  "Scores represent normalized visual similarity between text and image embeddings. They are ranking metrics, not calibrated probability values.",
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

func (h *VisualSearchHandler) GetSimilarGroups(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	relType := q.Get("relation_type")
	verState := q.Get("verification_state")

	whereClauses := []string{"1=1"}
	var args []interface{}
	argIdx := 1

	if relType != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("r.relation_type = $%d", argIdx))
		args = append(args, relType)
		argIdx++
	}

	if verState != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("r.verification_state = $%d", argIdx))
		args = append(args, verState)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	query := fmt.Sprintf(`
		SELECT 
			r.id, r.source_observation_id, r.target_observation_id,
			r.relation_type, r.confidence_score, r.distance_meters, r.days_apart,
			r.verification_state, r.analyst_notes, r.created_at, r.updated_at,
			s.filename, s.image_path, s.original_feature_label, s.category_id, sc.display_name, sc.color_hex, s.city, s.observed_at,
			t.filename, t.image_path, t.original_feature_label, t.category_id, tc.display_name, tc.color_hex, t.city, t.observed_at
		FROM observation_relations r
		JOIN observations s ON r.source_observation_id = s.id
		JOIN infrastructure_categories sc ON s.category_id = sc.id
		JOIN observations t ON r.target_observation_id = t.id
		JOIN infrastructure_categories tc ON t.category_id = tc.id
		WHERE %s
		ORDER BY r.confidence_score DESC
		LIMIT 100;
	`, whereSQL)

	rows, err := h.pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type GroupItem struct {
		Relation models.ObservationRelation `json:"relation"`
	}

	var relations []models.ObservationRelation
	for rows.Next() {
		var rel models.ObservationRelation
		var s models.Observation
		var t models.Observation

		if err := rows.Scan(
			&rel.ID, &rel.SourceObservationID, &rel.TargetObservationID,
			&rel.RelationType, &rel.ConfidenceScore, &rel.DistanceMeters, &rel.DaysApart,
			&rel.VerificationState, &rel.AnalystNotes, &rel.CreatedAt, &rel.UpdatedAt,
			&s.Filename, &s.ImagePath, &s.OriginalFeatureLabel, &s.CategoryID, &s.CategoryName, &s.CategoryColor, &s.City, &s.ObservedAt,
			&t.Filename, &t.ImagePath, &t.OriginalFeatureLabel, &t.CategoryID, &t.CategoryName, &t.CategoryColor, &t.City, &t.ObservedAt,
		); err == nil {
			s.ID = rel.SourceObservationID
			t.ID = rel.TargetObservationID
			if s.ImagePath != nil && *s.ImagePath != "" {
				sURL := "/api/v1/images/" + *s.ImagePath
				s.ImageURL = &sURL
			}
			if t.ImagePath != nil && *t.ImagePath != "" {
				tURL := "/api/v1/images/" + *t.ImagePath
				t.ImageURL = &tURL
			}
			rel.SourceObservation = &s
			rel.TargetObservation = &t
			relations = append(relations, rel)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"count":     len(relations),
		"relations": relations,
	})
}
