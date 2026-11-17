package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/models"
)

type ExportHandler struct {
	pool *pgxpool.Pool
}

func NewExportHandler(pool *pgxpool.Pool) *ExportHandler {
	return &ExportHandler{pool: pool}
}

func (h *ExportHandler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	whereClauses := []string{"1=1"}
	var args []interface{}
	argIdx := 1

	if cat := q.Get("category_id"); cat != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("o.category_id = $%d", argIdx))
		args = append(args, cat)
		argIdx++
	}

	if ds := q.Get("dataset_id"); ds != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("o.dataset_id = $%d", argIdx))
		args = append(args, ds)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	query := fmt.Sprintf(`
		SELECT 
			o.id, o.dataset_id, d.display_name, o.filename, o.original_feature_label,
			o.category_id, c.display_name, o.latitude, o.longitude,
			o.observed_at, o.city, o.state, o.country, o.source_attribution,
			o.dataset_license, o.verification_status, o.image_availability
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		JOIN datasets d ON o.dataset_id = d.id
		WHERE %s
		ORDER BY o.created_at DESC
		LIMIT 10000;
	`, whereSQL)

	rows, err := h.pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment;filename=observations.csv")

	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write header
	_ = writer.Write([]string{
		"observation_id", "dataset_id", "dataset_name", "filename", "original_feature_label",
		"category_id", "category_name", "latitude", "longitude", "observed_at",
		"city", "state", "country", "source_attribution", "license",
		"verification_status", "image_availability",
	})

	for rows.Next() {
		var id, dsID, dsName, filename, featureLabel, catID, catName, verStatus, imgAvail string
		var lat, lon float64
		var observedAt *string
		var city, state, country, source, license *string

		if err := rows.Scan(
			&id, &dsID, &dsName, &filename, &featureLabel, &catID, &catName,
			&lat, &lon, &observedAt, &city, &state, &country, &source, &license,
			&verStatus, &imgAvail,
		); err == nil {
			var obsDate, cityVal, stateVal, countryVal, sourceVal, licVal string
			if observedAt != nil {
				obsDate = *observedAt
			}
			if city != nil {
				cityVal = *city
			}
			if state != nil {
				stateVal = *state
			}
			if country != nil {
				countryVal = *country
			}
			if source != nil {
				sourceVal = *source
			}
			if license != nil {
				licVal = *license
			}

			_ = writer.Write([]string{
				id, dsID, dsName, filename, featureLabel, catID, catName,
				strconv.FormatFloat(lat, 'f', 6, 64), strconv.FormatFloat(lon, 'f', 6, 64),
				obsDate, cityVal, stateVal, countryVal, sourceVal, licVal,
				verStatus, imgAvail,
			})
		}
	}
}

func (h *ExportHandler) ExportGeoJSON(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	whereClauses := []string{"1=1"}
	var args []interface{}
	argIdx := 1

	if cat := q.Get("category_id"); cat != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("o.category_id = $%d", argIdx))
		args = append(args, cat)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	query := fmt.Sprintf(`
		SELECT 
			o.id, o.dataset_id, d.display_name, o.filename, o.original_feature_label,
			o.category_id, c.display_name, c.color_hex, o.latitude, o.longitude,
			o.observed_at, o.city, o.state, o.verification_status, o.image_availability,
			ST_X(o.location) as lon, ST_Y(o.location) as lat
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		JOIN datasets d ON o.dataset_id = d.id
		WHERE %s
		ORDER BY o.created_at DESC
		LIMIT 10000;
	`, whereSQL)

	rows, err := h.pool.Query(ctx, query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var features []models.GeoFeature
	for rows.Next() {
		var id, dsID, dsName, filename, featureLabel, catID, catName, catColor, verStatus, imgAvail string
		var lat, lon, geomLon, geomLat float64
		var observedAt, city, state *string

		if err := rows.Scan(
			&id, &dsID, &dsName, &filename, &featureLabel, &catID, &catName, &catColor,
			&lat, &lon, &observedAt, &city, &state, &verStatus, &imgAvail,
			&geomLon, &geomLat,
		); err == nil {
			feat := models.GeoFeature{
				Type: "Feature",
				Geometry: map[string]interface{}{
					"type":        "Point",
					"coordinates": []float64{geomLon, geomLat},
				},
				Properties: map[string]interface{}{
					"id":                     id,
					"dataset_id":             dsID,
					"dataset_name":           dsName,
					"filename":               filename,
					"original_feature_label": featureLabel,
					"category_id":            catID,
					"category_name":          catName,
					"color_hex":              catColor,
					"observed_at":            observedAt,
					"city":                   city,
					"state":                  state,
					"verification_status":    verStatus,
					"image_availability":     imgAvail,
				},
			}
			features = append(features, feat)
		}
	}

	w.Header().Set("Content-Type", "application/geo+json")
	w.Header().Set("Content-Disposition", "attachment;filename=observations.geojson")
	_ = json.NewEncoder(w).Encode(models.GeoFeatureCollection{
		Type:     "FeatureCollection",
		Features: features,
	})
}
