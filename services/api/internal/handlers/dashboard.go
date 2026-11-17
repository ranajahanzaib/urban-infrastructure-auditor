package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ranajahanzaib/urban-infrastructure-auditor/services/api/internal/models"
)

type DashboardHandler struct {
	pool *pgxpool.Pool
}

func NewDashboardHandler(pool *pgxpool.Pool) *DashboardHandler {
	return &DashboardHandler{pool: pool}
}

func (h *DashboardHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	var summary models.DashboardSummary
	summary.StalenessBreakdown = make(map[string]int64)
	summary.GroupDistribution = make(map[string]int64)

	// 1. High-level metric counts
	err := h.pool.QueryRow(ctx, `
		SELECT 
			COUNT(*),
			COUNT(DISTINCT category_id),
			COUNT(DISTINCT city) FILTER (WHERE city IS NOT NULL AND city != ''),
			COUNT(DISTINCT state) FILTER (WHERE state IS NOT NULL AND state != ''),
			COUNT(*) FILTER (WHERE verification_status = 'unverified' OR is_quarantined),
			COUNT(*) FILTER (WHERE image_availability = 'available'),
			COUNT(*) FILTER (WHERE image_availability != 'available'),
			COUNT(*) FILTER (WHERE observed_at IS NOT NULL AND observed_at < NOW() - INTERVAL '3 years'),
			COUNT(*) FILTER (WHERE observed_at IS NOT NULL AND observed_at >= NOW() - INTERVAL '1 year'),
			COUNT(*) FILTER (WHERE observed_at IS NOT NULL AND observed_at < NOW() - INTERVAL '1 year' AND observed_at >= NOW() - INTERVAL '3 years'),
			COUNT(*) FILTER (WHERE observed_at IS NULL)
		FROM observations;
	`).Scan(
		&summary.TotalObservations,
		&summary.CategoriesCount,
		&summary.CitiesCount,
		&summary.StatesCount,
		&summary.ReviewQueueCount,
		&summary.WithImagesCount,
		&summary.MissingImagesCount,
		&summary.StaleCount,
		new(int64), // placeholder for recent
		new(int64), // placeholder for aging
		new(int64), // placeholder for undated
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Calculate precise staleness breakdown
	var recent, aging, stale, undated int64
	_ = h.pool.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE observed_at >= NOW() - INTERVAL '1 year'),
			COUNT(*) FILTER (WHERE observed_at < NOW() - INTERVAL '1 year' AND observed_at >= NOW() - INTERVAL '3 years'),
			COUNT(*) FILTER (WHERE observed_at < NOW() - INTERVAL '3 years'),
			COUNT(*) FILTER (WHERE observed_at IS NULL)
		FROM observations;
	`).Scan(&recent, &aging, &stale, &undated)

	summary.StalenessBreakdown["recent"] = recent
	summary.StalenessBreakdown["aging"] = aging
	summary.StalenessBreakdown["stale"] = stale
	summary.StalenessBreakdown["undated"] = undated

	// 2. Group distribution
	groupRows, err := h.pool.Query(ctx, `
		SELECT c.category_group, COUNT(o.id)
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		GROUP BY c.category_group;
	`)
	if err == nil {
		defer groupRows.Close()
		for groupRows.Next() {
			var group string
			var count int64
			if err := groupRows.Scan(&group, &count); err == nil {
				summary.GroupDistribution[group] = count
			}
		}
	}

	// 3. Category Breakdown
	catRows, err := h.pool.Query(ctx, `
		SELECT 
			c.id, c.display_name, c.category_group, c.color_hex,
			COUNT(o.id) as total_count,
			COUNT(o.id) FILTER (WHERE o.image_availability = 'available') as image_count
		FROM infrastructure_categories c
		LEFT JOIN observations o ON c.id = o.category_id
		GROUP BY c.id, c.display_name, c.category_group, c.color_hex
		ORDER BY total_count DESC;
	`)
	if err == nil {
		defer catRows.Close()
		for catRows.Next() {
			var cc models.CategoryCount
			if err := catRows.Scan(&cc.CategoryID, &cc.DisplayName, &cc.CategoryGroup, &cc.ColorHex, &cc.Count, &cc.ImageCount); err == nil {
				summary.CategoryCounts = append(summary.CategoryCounts, cc)
			}
		}
	}

	// 4. Datasets Status
	dsRows, err := h.pool.Query(ctx, `
		SELECT id, name, display_name, repository_url, license, attribution, description,
		       total_records, imported_records, image_records, created_at, updated_at
		FROM datasets
		ORDER BY display_name;
	`)
	if err == nil {
		defer dsRows.Close()
		for dsRows.Next() {
			var d models.Dataset
			if err := dsRows.Scan(&d.ID, &d.Name, &d.DisplayName, &d.RepositoryURL, &d.License, &d.Attribution, &d.Description,
				&d.TotalRecords, &d.ImportedRecords, &d.ImageRecords, &d.CreatedAt, &d.UpdatedAt); err == nil {
				summary.DatasetsStatus = append(summary.DatasetsStatus, d)
			}
		}
	}

	// 5. Recent Observations preview
	recentRows, err := h.pool.Query(ctx, `
		SELECT 
			o.id, o.dataset_id, o.filename, o.image_path, o.image_availability,
			o.original_feature_label, o.category_id, c.display_name, c.category_group, c.color_hex,
			o.observed_at, o.has_timestamp, o.latitude, o.longitude, o.city, o.state, o.country,
			o.verification_status, o.created_at, o.updated_at
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		ORDER BY o.created_at DESC
		LIMIT 8;
	`)
	if err == nil {
		defer recentRows.Close()
		for recentRows.Next() {
			var obs models.Observation
			if err := recentRows.Scan(
				&obs.ID, &obs.DatasetID, &obs.Filename, &obs.ImagePath, &obs.ImageAvailability,
				&obs.OriginalFeatureLabel, &obs.CategoryID, &obs.CategoryName, &obs.CategoryGroup, &obs.CategoryColor,
				&obs.ObservedAt, &obs.HasTimestamp, &obs.Latitude, &obs.Longitude, &obs.City, &obs.State, &obs.Country,
				&obs.VerificationStatus, &obs.CreatedAt, &obs.UpdatedAt,
			); err == nil {
				obs.StalenessState = calculateStaleness(obs.ObservedAt)
				if obs.ImagePath != nil && *obs.ImagePath != "" {
					url := "/api/v1/images/" + *obs.ImagePath
					obs.ImageURL = &url
				}
				summary.RecentObservations = append(summary.RecentObservations, obs)
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(summary)
}

func (h *DashboardHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.pool.Query(ctx, `
		SELECT 
			c.id, c.display_name, c.description, c.category_group, c.color_hex,
			c.source_labels, c.created_at, c.updated_at,
			COUNT(o.id) as total_count,
			COUNT(o.id) FILTER (WHERE o.image_availability = 'available') as image_count
		FROM infrastructure_categories c
		LEFT JOIN observations o ON c.id = o.category_id
		GROUP BY c.id, c.display_name, c.description, c.category_group, c.color_hex, c.source_labels, c.created_at, c.updated_at
		ORDER BY c.category_group, c.display_name;
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var cat models.Category
		var rawLabels []byte
		if err := rows.Scan(
			&cat.ID, &cat.DisplayName, &cat.Description, &cat.CategoryGroup, &cat.ColorHex,
			&rawLabels, &cat.CreatedAt, &cat.UpdatedAt, &cat.TotalCount, &cat.ImageCount,
		); err == nil {
			_ = json.Unmarshal(rawLabels, &cat.SourceLabels)
			categories = append(categories, cat)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(categories)
}

func (h *DashboardHandler) GetTimeline(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.pool.Query(ctx, `
		SELECT 
			TO_CHAR(DATE_TRUNC('month', observed_at), 'YYYY-MM') as month_period,
			c.category_group,
			COUNT(*) as count
		FROM observations o
		JOIN infrastructure_categories c ON o.category_id = c.id
		WHERE observed_at IS NOT NULL
		GROUP BY month_period, c.category_group
		ORDER BY month_period ASC;
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type TimelineEntry struct {
		Period                  string `json:"period"`
		GreenInfrastructure     int64  `json:"green_infrastructure"`
		ConstructionPublicWorks int64  `json:"construction_public_works"`
		Total                   int64  `json:"total"`
	}

	periodMap := make(map[string]*TimelineEntry)
	var orderedPeriods []string

	for rows.Next() {
		var period, group string
		var count int64
		if err := rows.Scan(&period, &group, &count); err == nil {
			if _, exists := periodMap[period]; !exists {
				periodMap[period] = &TimelineEntry{Period: period}
				orderedPeriods = append(orderedPeriods, period)
			}
			entry := periodMap[period]
			entry.Total += count
			if group == "green_infrastructure" {
				entry.GreenInfrastructure += count
			} else {
				entry.ConstructionPublicWorks += count
			}
		}
	}

	var results []TimelineEntry
	for _, p := range orderedPeriods {
		results = append(results, *periodMap[p])
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(results)
}

func (h *DashboardHandler) GetCoverage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	rows, err := h.pool.Query(ctx, `
		SELECT 
			COALESCE(state, 'Unknown') as region_name,
			COUNT(*) as total_obs,
			COUNT(*) FILTER (WHERE image_availability = 'available') as with_images,
			COUNT(DISTINCT category_id) as category_diversity,
			COUNT(DISTINCT city) as city_count
		FROM observations
		GROUP BY region_name
		ORDER BY total_obs DESC
		LIMIT 20;
	`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type CoverageRegion struct {
		RegionName        string  `json:"region_name"`
		TotalObservations int64   `json:"total_observations"`
		WithImages        int64   `json:"with_images"`
		ImageRate         float64 `json:"image_rate"`
		CategoryDiversity int     `json:"category_diversity"`
		CityCount         int     `json:"city_count"`
	}

	var coverage []CoverageRegion
	for rows.Next() {
		var reg CoverageRegion
		if err := rows.Scan(&reg.RegionName, &reg.TotalObservations, &reg.WithImages, &reg.CategoryDiversity, &reg.CityCount); err == nil {
			if reg.TotalObservations > 0 {
				reg.ImageRate = float64(reg.WithImages) / float64(reg.TotalObservations) * 100.0
			}
			coverage = append(coverage, reg)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(coverage)
}

func calculateStaleness(t *time.Time) string {
	if t == nil {
		return "undated"
	}
	age := time.Since(*t)
	if age < 365*24*time.Hour {
		return "recent"
	} else if age < 3*365*24*time.Hour {
		return "aging"
	}
	return "stale"
}
