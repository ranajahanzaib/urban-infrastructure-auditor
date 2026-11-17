package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/models"
)

type GeoHandler struct {
	pool *pgxpool.Pool
}

func NewGeoHandler(pool *pgxpool.Pool) *GeoHandler {
	return &GeoHandler{pool: pool}
}

func (h *GeoHandler) GetGeoObservations(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	limit := 1000
	if lStr := q.Get("limit"); lStr != "" {
		if val, err := strconv.Atoi(lStr); err == nil && val > 0 && val <= 5000 {
			limit = val
		}
	}

	var whereClauses []string
	var args []interface{}
	argIdx := 1

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

	if avail := q.Get("image_availability"); avail != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("o.image_availability = $%d", argIdx))
		args = append(args, avail)
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT 
			o.id, o.filename, o.image_path, o.image_availability,
			o.original_feature_label, o.category_id, c.display_name, c.category_group, c.color_hex,
			o.observed_at, o.latitude, o.longitude, o.city, o.state, o.verification_status,
			ST_X(o.location) as lon, ST_Y(o.location) as lat
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		%s
		LIMIT $%d;
	`, whereSQL, argIdx)

	args = append(args, limit)
	rows, err := h.pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var features []models.GeoFeature
	for rows.Next() {
		var id, filename, featureLabel, catID, catName, catGroup, catColor, verStatus string
		var imagePath, city, state *string
		var imageAvail string
		var observedAt *string
		var lat, lon float64
		var geomLon, geomLat float64

		if err := rows.Scan(
			&id, &filename, &imagePath, &imageAvail,
			&featureLabel, &catID, &catName, &catGroup, &catColor,
			&observedAt, &lat, &lon, &city, &state, &verStatus,
			&geomLon, &geomLat,
		); err == nil {
			imageURL := ""
			if imagePath != nil && *imagePath != "" {
				imageURL = "/api/v1/images/" + *imagePath
			}

			feat := models.GeoFeature{
				Type: "Feature",
				Geometry: map[string]interface{}{
					"type":        "Point",
					"coordinates": []float64{geomLon, geomLat},
				},
				Properties: map[string]interface{}{
					"id":                     id,
					"filename":               filename,
					"image_url":              imageURL,
					"image_availability":     imageAvail,
					"original_feature_label": featureLabel,
					"category_id":            catID,
					"category_name":          catName,
					"category_group":         catGroup,
					"color_hex":              catColor,
					"observed_at":            observedAt,
					"city":                   city,
					"state":                  state,
					"verification_status":    verStatus,
				},
			}
			features = append(features, feat)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(models.GeoFeatureCollection{
		Type:     "FeatureCollection",
		Features: features,
	})
}

func (h *GeoHandler) GetClusters(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	// Dynamic spatial grid clustering
	gridSize := 0.5 // default degrees
	if zStr := q.Get("zoom"); zStr != "" {
		if z, err := strconv.ParseFloat(zStr, 64); err == nil {
			if z > 12 {
				gridSize = 0.02
			} else if z > 9 {
				gridSize = 0.08
			} else if z > 6 {
				gridSize = 0.25
			} else {
				gridSize = 0.8
			}
		}
	}

	var whereClauses []string
	var args []interface{}
	argIdx := 1

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

	if cat := q.Get("category_id"); cat != "" {
		cats := strings.Split(cat, ",")
		whereClauses = append(whereClauses, fmt.Sprintf("o.category_id = ANY($%d)", argIdx))
		args = append(args, cats)
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT 
			CONCAT(FLOOR(o.longitude / $%d) * $%d, ':', FLOOR(o.latitude / $%d) * $%d) as cluster_id,
			COUNT(*) as count,
			AVG(o.latitude) as avg_lat,
			AVG(o.longitude) as avg_lon,
			MODE() WITHIN GROUP (ORDER BY c.color_hex) as color_hex,
			MODE() WITHIN GROUP (ORDER BY o.category_id) as top_cat
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		%s
		GROUP BY FLOOR(o.longitude / $%d), FLOOR(o.latitude / $%d)
		LIMIT 200;
	`, argIdx, argIdx, argIdx, argIdx, whereSQL, argIdx, argIdx)

	args = append(args, gridSize)
	rows, err := h.pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var clusters []models.GeoCluster
	for rows.Next() {
		var cl models.GeoCluster
		if err := rows.Scan(&cl.ID, &cl.Count, &cl.Latitude, &cl.Longitude, &cl.ColorHex, &cl.TopCategoryID); err == nil {
			clusters = append(clusters, cl)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(clusters)
}

func (h *GeoHandler) GetDensity(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	gridSize := 0.25
	query := `
		SELECT 
			CONCAT(ROUND(latitude::numeric / 0.25) * 0.25, ',', ROUND(longitude::numeric / 0.25) * 0.25) as cell_id,
			AVG(latitude) as lat,
			AVG(longitude) as lon,
			COUNT(*) as total_obs,
			COUNT(DISTINCT category_id) as diversity,
			MODE() WITHIN GROUP (ORDER BY category_id) as top_category,
			COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - observed_at)) / 86400.0), 0) as avg_age_days,
			COALESCE(COUNT(*) FILTER (WHERE image_availability = 'available')::float / COUNT(*)::float, 0) as image_rate
		FROM observations
		GROUP BY ROUND(latitude::numeric / 0.25), ROUND(longitude::numeric / 0.25)
		HAVING COUNT(*) >= 5
		ORDER BY total_obs DESC
		LIMIT 150;
	`
	_ = q
	_ = gridSize

	rows, err := h.pool.Query(ctx, query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var cells []models.GeoDensityCell
	for rows.Next() {
		var cell models.GeoDensityCell
		cell.Categories = make(map[string]int64)
		if err := rows.Scan(
			&cell.CellID, &cell.Latitude, &cell.Longitude,
			&cell.Count, &cell.Diversity, &cell.TopCategory,
			&cell.AverageAgeDays, &cell.HasImagesRate,
		); err == nil {
			cells = append(cells, cell)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(cells)
}

func (h *GeoHandler) CompareAreas(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var req models.AreaComparisonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid comparison request body", http.StatusBadRequest)
		return
	}

	// Default bboxes if omitted (e.g. San Francisco vs Portland)
	if len(req.AreaABbox) != 4 {
		req.AreaABbox = []float64{-122.52, 37.70, -122.35, 37.83} // San Francisco approx
		req.AreaAName = "San Francisco, CA"
	}
	if len(req.AreaBBbox) != 4 {
		req.AreaBBbox = []float64{-122.75, 45.45, -122.58, 45.60} // Portland, OR approx
		req.AreaBName = "Portland, OR"
	}

	metricsA := h.computeAreaMetrics(ctx, req.AreaAName, req.AreaABbox)
	metricsB := h.computeAreaMetrics(ctx, req.AreaBName, req.AreaBBbox)

	resp := models.AreaComparisonResponse{
		AreaA: metricsA,
		AreaB: metricsB,
		Notes: "Differences in observation counts reflect imagery ingestion coverage, route collection schedules, and sensor availability rather than physical asset completeness in the real world.",
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (h *GeoHandler) computeAreaMetrics(ctx context.Context, name string, bbox []float64) models.AreaMetrics {
	var m models.AreaMetrics
	m.Name = name
	m.BBox = bbox
	m.CategoryCounts = make(map[string]int64)
	m.StalenessBreakdown = make(map[string]int64)
	m.VerificationCounts = make(map[string]int64)

	// Approximate square km
	dLon := (bbox[2] - bbox[0]) * 111.320 * math.Cos((bbox[1]+bbox[3])/2.0*math.Pi/180.0)
	dLat := (bbox[3] - bbox[1]) * 110.574
	m.AreaSquareKm = math.Abs(dLon * dLat)
	if m.AreaSquareKm < 1.0 {
		m.AreaSquareKm = 1.0
	}

	// Aggregate metrics
	query := `
		SELECT 
			COUNT(*),
			COUNT(*) FILTER (WHERE image_availability = 'available'),
			COUNT(DISTINCT category_id),
			COUNT(*) FILTER (WHERE observed_at >= NOW() - INTERVAL '1 year'),
			COUNT(*) FILTER (WHERE observed_at < NOW() - INTERVAL '1 year' AND observed_at >= NOW() - INTERVAL '3 years'),
			COUNT(*) FILTER (WHERE observed_at < NOW() - INTERVAL '3 years'),
			COUNT(*) FILTER (WHERE observed_at IS NULL),
			COUNT(*) FILTER (WHERE verification_status = 'unverified'),
			COUNT(*) FILTER (WHERE verification_status = 'verified_accurate'),
			COUNT(*) FILTER (WHERE verification_status = 'rejected')
		FROM observations
		WHERE location && ST_MakeEnvelope($1, $2, $3, $4, 4326);
	`

	var withImages int64
	var recent, aging, stale, undated int64
	var unv, ver, rej int64

	_ = h.pool.QueryRow(ctx, query, bbox[0], bbox[1], bbox[2], bbox[3]).Scan(
		&m.TotalObservations,
		&withImages,
		&m.CategoryDiversity,
		&recent, &aging, &stale, &undated,
		&unv, &ver, &rej,
	)

	if m.TotalObservations > 0 {
		m.DensityPerSqKm = float64(m.TotalObservations) / m.AreaSquareKm
		m.ImageAvailabilityPct = float64(withImages) / float64(m.TotalObservations) * 100.0
	}

	m.StalenessBreakdown["recent"] = recent
	m.StalenessBreakdown["aging"] = aging
	m.StalenessBreakdown["stale"] = stale
	m.StalenessBreakdown["undated"] = undated

	m.VerificationCounts["unverified"] = unv
	m.VerificationCounts["verified"] = ver
	m.VerificationCounts["rejected"] = rej

	// Categories breakdown
	catRows, err := h.pool.Query(ctx, `
		SELECT c.display_name, COUNT(o.id)
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		WHERE o.location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
		GROUP BY c.display_name;
	`, bbox[0], bbox[1], bbox[2], bbox[3])
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var catName string
			var count int64
			if err := catRows.Scan(&catName, &count); err == nil {
				m.CategoryCounts[catName] = count
			}
		}
	}

	return m
}
