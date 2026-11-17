export interface Category {
  id: string;
  display_name: string;
  description: string;
  category_group: "green_infrastructure" | "construction_public_works";
  color_hex: string;
  source_labels: string[];
  total_count?: number;
  image_count?: number;
}

export interface Dataset {
  id: string;
  name: string;
  display_name: string;
  repository_url: string;
  license: string;
  attribution: string;
  description: string;
  total_records: number;
  imported_records: number;
  image_records: number;
  created_at: string;
  updated_at: string;
}

export interface Observation {
  id: string;
  dataset_id: string;
  dataset_name?: string;
  original_row_id: string | null;
  filename: string;
  image_folder: string | null;
  image_path: string | null;
  image_url: string | null;
  image_availability: "available" | "missing" | "failed" | "pending";
  image_checksum: string | null;
  original_feature_label: string;
  category_id: string;
  category_name?: string;
  category_group?: string;
  category_color?: string;
  observed_at: string | null;
  has_timestamp: boolean;
  latitude: number;
  longitude: number;
  country: string | null;
  state: string | null;
  city: string | null;
  source_attribution: string | null;
  dataset_license: string | null;
  verification_status:
    | "unverified"
    | "verified_accurate"
    | "rejected"
    | "uncertain";
  analyst_category_id: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  is_quarantined: boolean;
  quarantine_reason: string | null;
  siglip_status: string;
  dinov2_status: string;
  phash: string | null;
  raw_metadata?: Record<string, any>;
  visual_similarity?: number;
  distance_meters?: number;
  staleness_state: "recent" | "aging" | "stale" | "undated";
  created_at: string;
  updated_at: string;
}

export interface ObservationRelation {
  id: string;
  source_observation_id: string;
  target_observation_id: string;
  relation_type: "near_duplicate" | "possible_repeat" | "visually_similar";
  confidence_score: number;
  distance_meters: number;
  days_apart: number;
  verification_state:
    | "proposed"
    | "confirmed_duplicate"
    | "related_observation"
    | "not_related"
    | "needs_review";
  analyst_notes: string | null;
  source_observation?: Observation;
  target_observation?: Observation;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  total_observations: number;
  categories_count: number;
  cities_count: number;
  states_count: number;
  review_queue_count: number;
  with_images_count: number;
  missing_images_count: number;
  stale_count: number;
  staleness_breakdown: {
    recent: number;
    aging: number;
    stale: number;
    undated: number;
  };
  group_distribution: {
    green_infrastructure?: number;
    construction_public_works?: number;
  };
  category_counts: Array<{
    category_id: string;
    display_name: string;
    category_group: string;
    color_hex: string;
    count: number;
    image_count: number;
  }>;
  datasets_status: Dataset[];
  recent_observations: Observation[];
}

export interface GeoFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id: string;
    filename: string;
    image_url: string;
    image_availability: string;
    original_feature_label: string;
    category_id: string;
    category_name: string;
    category_group: string;
    color_hex: string;
    observed_at: string | null;
    city: string | null;
    state: string | null;
    verification_status: string;
  };
}

export interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export async function fetchSummary(): Promise<DashboardSummary> {
  const res = await fetch(`${BASE_URL}/api/v1/dashboard/summary`);
  if (!res.ok) throw new Error("Failed to fetch dashboard summary");
  return res.json();
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${BASE_URL}/api/v1/dashboard/categories`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  return res.json();
}

export async function fetchTimeline(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/v1/dashboard/timeline`);
  if (!res.ok) throw new Error("Failed to fetch timeline");
  return res.json();
}

export async function fetchCoverage(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/v1/dashboard/coverage`);
  if (!res.ok) throw new Error("Failed to fetch coverage");
  return res.json();
}

export async function fetchObservations(
  params: Record<string, string | number | undefined>,
): Promise<{
  observations: Observation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== "") searchParams.append(key, String(val));
  });
  const res = await fetch(
    `${BASE_URL}/api/v1/observations?${searchParams.toString()}`,
  );
  if (!res.ok) throw new Error("Failed to fetch observations");
  return res.json();
}

export async function fetchObservation(id: string): Promise<Observation> {
  const res = await fetch(`${BASE_URL}/api/v1/observations/${id}`);
  if (!res.ok) throw new Error("Failed to fetch observation details");
  return res.json();
}

export async function fetchNeighbors(
  id: string,
  radiusMeters = 2000,
): Promise<Observation[]> {
  const res = await fetch(
    `${BASE_URL}/api/v1/observations/${id}/neighbors?radius=${radiusMeters}`,
  );
  if (!res.ok) throw new Error("Failed to fetch spatial neighbors");
  return res.json();
}

export async function fetchSimilar(id: string): Promise<Observation[]> {
  const res = await fetch(`${BASE_URL}/api/v1/observations/${id}/similar`);
  if (!res.ok) throw new Error("Failed to fetch similar observations");
  return res.json();
}

export async function fetchHistory(id: string): Promise<Observation[]> {
  const res = await fetch(`${BASE_URL}/api/v1/observations/${id}/history`);
  if (!res.ok) throw new Error("Failed to fetch history candidates");
  return res.json();
}

export async function fetchGeoObservations(params: {
  bbox?: string;
  category_id?: string;
  category_group?: string;
  limit?: number;
}): Promise<GeoFeatureCollection> {
  const searchParams = new URLSearchParams();
  if (params.bbox) searchParams.append("bbox", params.bbox);
  if (params.category_id)
    searchParams.append("category_id", params.category_id);
  if (params.category_group)
    searchParams.append("category_group", params.category_group);
  if (params.limit) searchParams.append("limit", String(params.limit));

  const res = await fetch(
    `${BASE_URL}/api/v1/geo/observations?${searchParams.toString()}`,
  );
  if (!res.ok) throw new Error("Failed to fetch geo observations");
  return res.json();
}

export async function fetchGeoClusters(params: {
  bbox?: string;
  zoom?: number;
}): Promise<any[]> {
  const searchParams = new URLSearchParams();
  if (params.bbox) searchParams.append("bbox", params.bbox);
  if (params.zoom !== undefined)
    searchParams.append("zoom", String(params.zoom));

  const res = await fetch(
    `${BASE_URL}/api/v1/geo/clusters?${searchParams.toString()}`,
  );
  if (!res.ok) throw new Error("Failed to fetch geo clusters");
  return res.json();
}

export async function fetchGeoDensity(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/v1/geo/density`);
  if (!res.ok) throw new Error("Failed to fetch geo density");
  return res.json();
}

export async function compareAreas(body: {
  area_a_name: string;
  area_a_bbox: number[];
  area_b_name: string;
  area_b_bbox: number[];
}): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/v1/geo/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to compare areas");
  return res.json();
}

export async function searchVisual(
  query: string,
  options?: { limit?: number; category_id?: string },
): Promise<{
  query: string;
  model: string;
  results_count: number;
  results: Observation[];
  scoring_note: string;
}> {
  const res = await fetch(`${BASE_URL}/api/v1/search/visual`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit: options?.limit || 20,
      category_id: options?.category_id || "",
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "Visual search failed");
  }
  return res.json();
}

export async function fetchSimilarGroups(params?: {
  relation_type?: string;
  verification_state?: string;
}): Promise<{
  count: number;
  relations: ObservationRelation[];
}> {
  const searchParams = new URLSearchParams();
  if (params?.relation_type)
    searchParams.append("relation_type", params.relation_type);
  if (params?.verification_state)
    searchParams.append("verification_state", params.verification_state);

  const res = await fetch(
    `${BASE_URL}/api/v1/search/similar-groups?${searchParams.toString()}`,
  );
  if (!res.ok) throw new Error("Failed to fetch similar groups");
  return res.json();
}

export async function fetchReviews(queue = "unverified"): Promise<{
  queue: string;
  count: number;
  observations: Observation[];
}> {
  const res = await fetch(`${BASE_URL}/api/v1/reviews?queue=${queue}`);
  if (!res.ok) throw new Error("Failed to fetch review queue");
  return res.json();
}

export async function submitReview(
  id: string,
  action: {
    action: string;
    analyst_category_id?: string;
    notes?: string;
    reviewer_id?: string;
    relation_id?: string;
  },
): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/v1/reviews/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  if (!res.ok) throw new Error("Failed to submit review");
  return res.json();
}

export async function fetchReviewHistory(id: string): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/v1/reviews/${id}/history`);
  if (!res.ok) throw new Error("Failed to fetch review history");
  return res.json();
}

export async function fetchDatasets(): Promise<Dataset[]> {
  const res = await fetch(`${BASE_URL}/api/v1/datasets`);
  if (!res.ok) throw new Error("Failed to fetch datasets");
  return res.json();
}

export async function fetchImportJobs(): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/api/v1/import-jobs`);
  if (!res.ok) throw new Error("Failed to fetch import jobs");
  return res.json();
}
