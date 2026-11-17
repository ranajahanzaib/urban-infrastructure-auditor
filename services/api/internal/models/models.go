package models

import (
	"time"
)

type Category struct {
	ID            string    `json:"id"`
	DisplayName   string    `json:"display_name"`
	Description   string    `json:"description"`
	CategoryGroup string    `json:"category_group"`
	ColorHex      string    `json:"color_hex"`
	SourceLabels  []string  `json:"source_labels"`
	TotalCount    int64     `json:"total_count,omitempty"`
	ImageCount    int64     `json:"image_count,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Dataset struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	DisplayName     string    `json:"display_name"`
	RepositoryURL   string    `json:"repository_url"`
	License         string    `json:"license"`
	Attribution     string    `json:"attribution"`
	Description     string    `json:"description"`
	TotalRecords    int64     `json:"total_records"`
	ImportedRecords int64     `json:"imported_records"`
	ImageRecords    int64     `json:"image_records"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

type Observation struct {
	ID                   string                 `json:"id"`
	DatasetID            string                 `json:"dataset_id"`
	DatasetName          string                 `json:"dataset_name,omitempty"`
	OriginalRowID        *string                `json:"original_row_id"`
	Filename             string                 `json:"filename"`
	ImageFolder          *string                `json:"image_folder"`
	ImagePath            *string                `json:"image_path"`
	ImageURL             *string                `json:"image_url"`
	ImageAvailability    string                 `json:"image_availability"`
	ImageChecksum        *string                `json:"image_checksum"`
	OriginalFeatureLabel string                 `json:"original_feature_label"`
	CategoryID           string                 `json:"category_id"`
	CategoryName         string                 `json:"category_name,omitempty"`
	CategoryGroup        string                 `json:"category_group,omitempty"`
	CategoryColor        string                 `json:"category_color,omitempty"`
	ObservedAt           *time.Time             `json:"observed_at"`
	HasTimestamp         bool                   `json:"has_timestamp"`
	Latitude             float64                `json:"latitude"`
	Longitude            float64                `json:"longitude"`
	Country              *string                `json:"country"`
	State                *string                `json:"state"`
	City                 *string                `json:"city"`
	SourceAttribution    *string                `json:"source_attribution"`
	DatasetLicense       *string                `json:"dataset_license"`
	VerificationStatus   string                 `json:"verification_status"`
	AnalystCategoryID    *string                `json:"analyst_category_id"`
	ReviewerNotes        *string                `json:"reviewer_notes"`
	ReviewedAt           *time.Time             `json:"reviewed_at"`
	ReviewedBy           *string                `json:"reviewed_by"`
	IsQuarantined        bool                   `json:"is_quarantined"`
	QuarantineReason     *string                `json:"quarantine_reason"`
	SiglipStatus         string                 `json:"siglip_status"`
	Dinov2Status         string                 `json:"dinov2_status"`
	PHash                *string                `json:"phash"`
	RawMetadata          map[string]interface{} `json:"raw_metadata,omitempty"`
	VisualSimilarity     *float64               `json:"visual_similarity,omitempty"`
	DistanceMeters       *float64               `json:"distance_meters,omitempty"`
	StalenessState       string                 `json:"staleness_state"` // recent, aging, stale, undated
	CreatedAt            time.Time              `json:"created_at"`
	UpdatedAt            time.Time              `json:"updated_at"`
}

type ObservationRelation struct {
	ID                  string       `json:"id"`
	SourceObservationID string       `json:"source_observation_id"`
	TargetObservationID string       `json:"target_observation_id"`
	RelationType        string       `json:"relation_type"` // near_duplicate, possible_repeat, visually_similar
	ConfidenceScore     float64      `json:"confidence_score"`
	DistanceMeters      float64      `json:"distance_meters"`
	DaysApart           float64      `json:"days_apart"`
	VerificationState   string       `json:"verification_state"` // proposed, confirmed_duplicate, related_observation, not_related, needs_review
	AnalystNotes        *string      `json:"analyst_notes"`
	SourceObservation   *Observation `json:"source_observation,omitempty"`
	TargetObservation   *Observation `json:"target_observation,omitempty"`
	CreatedAt           time.Time    `json:"created_at"`
	UpdatedAt           time.Time    `json:"updated_at"`
}

type ReviewEvent struct {
	ID            string                 `json:"id"`
	ObservationID string                 `json:"observation_id"`
	Action        string                 `json:"action"`
	PreviousState map[string]interface{} `json:"previous_state"`
	NewState      map[string]interface{} `json:"new_state"`
	ReviewerID    string                 `json:"reviewer_id"`
	Notes         *string                `json:"notes"`
	CreatedAt     time.Time              `json:"created_at"`
}

type DatasetImportJob struct {
	ID             string     `json:"id"`
	DatasetID      string     `json:"dataset_id"`
	Status         string     `json:"status"`
	TotalRows      int        `json:"total_rows"`
	ProcessedRows  int        `json:"processed_rows"`
	ImportedRows   int        `json:"imported_rows"`
	FailedRows     int        `json:"failed_rows"`
	ImagesResolved int        `json:"images_resolved"`
	ErrorMessage   *string    `json:"error_message"`
	StartedAt      *time.Time `json:"started_at"`
	CompletedAt    *time.Time `json:"completed_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

type DashboardSummary struct {
	TotalObservations  int64            `json:"total_observations"`
	CategoriesCount    int64            `json:"categories_count"`
	CitiesCount        int64            `json:"cities_count"`
	StatesCount        int64            `json:"states_count"`
	ReviewQueueCount   int64            `json:"review_queue_count"`
	WithImagesCount    int64            `json:"with_images_count"`
	MissingImagesCount int64            `json:"missing_images_count"`
	StaleCount         int64            `json:"stale_count"`
	StalenessBreakdown map[string]int64 `json:"staleness_breakdown"`
	GroupDistribution  map[string]int64 `json:"group_distribution"`
	CategoryCounts     []CategoryCount  `json:"category_counts"`
	DatasetsStatus     []Dataset        `json:"datasets_status"`
	RecentObservations []Observation    `json:"recent_observations"`
}

type CategoryCount struct {
	CategoryID    string `json:"category_id"`
	DisplayName   string `json:"display_name"`
	CategoryGroup string `json:"category_group"`
	ColorHex      string `json:"color_hex"`
	Count         int64  `json:"count"`
	ImageCount    int64  `json:"image_count"`
}

type GeoFeature struct {
	Type       string                 `json:"type"` // "Feature"
	Geometry   map[string]interface{} `json:"geometry"`
	Properties map[string]interface{} `json:"properties"`
}

type GeoFeatureCollection struct {
	Type     string       `json:"type"` // "FeatureCollection"
	Features []GeoFeature `json:"features"`
}

type GeoCluster struct {
	ID            string   `json:"id"`
	Count         int64    `json:"count"`
	Latitude      float64  `json:"latitude"`
	Longitude     float64  `json:"longitude"`
	TopCategoryID string   `json:"top_category_id"`
	ColorHex      string   `json:"color_hex"`
	Categories    []string `json:"categories"`
}

type GeoDensityCell struct {
	CellID         string           `json:"cell_id"`
	Latitude       float64          `json:"latitude"`
	Longitude      float64          `json:"longitude"`
	Count          int64            `json:"count"`
	Diversity      int              `json:"diversity"`
	Categories     map[string]int64 `json:"categories"`
	TopCategory    string           `json:"top_category"`
	AverageAgeDays float64          `json:"average_age_days"`
	HasImagesRate  float64          `json:"has_images_rate"`
}

type AreaComparisonRequest struct {
	AreaAName string    `json:"area_a_name"`
	AreaABbox []float64 `json:"area_a_bbox"` // [min_lon, min_lat, max_lon, max_lat]
	AreaBName string    `json:"area_b_name"`
	AreaBBbox []float64 `json:"area_b_bbox"`
}

type AreaMetrics struct {
	Name                 string           `json:"name"`
	BBox                 []float64        `json:"bbox"`
	TotalObservations    int64            `json:"total_observations"`
	AreaSquareKm         float64          `json:"area_square_km"`
	DensityPerSqKm       float64          `json:"density_per_sq_km"`
	ImageAvailabilityPct float64          `json:"image_availability_pct"`
	CategoryDiversity    int              `json:"category_diversity"`
	CategoryCounts       map[string]int64 `json:"category_counts"`
	StalenessBreakdown   map[string]int64 `json:"staleness_breakdown"`
	VerificationCounts   map[string]int64 `json:"verification_counts"`
}

type AreaComparisonResponse struct {
	AreaA AreaMetrics `json:"area_a"`
	AreaB AreaMetrics `json:"area_b"`
	Notes string      `json:"methodological_notes"`
}
