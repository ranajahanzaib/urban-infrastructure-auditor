"""
End-to-End System Integration Tests for urban-infrastructure-auditor.
Validates the full stack:
- PostgreSQL + PostGIS + pgvector
- Python Vision FastAPI Service (8001)
- Go Chi Backend API Server (8080)
- Next.js 15 Web Application (3000)
"""

import unittest
import urllib.request
import json

API_BASE = "http://localhost:8080/api/v1"
VISION_BASE = "http://localhost:8001"
WEB_BASE = "http://localhost:3000"

def fetch_json(url: str, method: str = "GET", data: dict = None):
    req = urllib.request.Request(url, method=method)
    req.add_header("Content-Type", "application/json")
    body = json.dumps(data).encode("utf-8") if data else None
    with urllib.request.urlopen(req, data=body, timeout=10) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def fetch_status(url: str) -> int:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status

class TestEndToEndSystem(unittest.TestCase):
    def test_01_vision_service_health(self):
        status, data = fetch_json(f"{VISION_BASE}/health")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("status"), "healthy")

    def test_02_backend_api_health(self):
        status, data = fetch_json(f"{API_BASE}/health")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("status"), "healthy")

        # Test OpenAPI spec retrieval
        req = urllib.request.Request(f"{API_BASE}/openapi.yaml")
        with urllib.request.urlopen(req, timeout=10) as resp:
            self.assertEqual(resp.status, 200)
            self.assertIn("openapi: 3.0.3", resp.read().decode("utf-8"))

    def test_03_dashboard_summary(self):
        status, data = fetch_json(f"{API_BASE}/dashboard/summary")
        self.assertEqual(status, 200)
        self.assertGreater(data.get("total_observations", 0), 0)
        self.assertGreater(data.get("with_images_count", 0), 0)
        self.assertIn("category_counts", data)
        self.assertIn("datasets_status", data)

    def test_04_observations_query_and_pagination(self):
        status, data = fetch_json(f"{API_BASE}/observations?limit=10&page=1")
        self.assertEqual(status, 200)
        self.assertIn("observations", data)
        self.assertLessEqual(len(data["observations"]), 10)
        self.assertGreater(data.get("pagination", {}).get("total", 0), 0)

        # Category filter test
        status, cat_data = fetch_json(f"{API_BASE}/observations?category_id=ev_chargers&limit=5")
        self.assertEqual(status, 200)
        for obs in cat_data.get("observations", []):
            self.assertEqual(obs["category_id"], "ev_chargers")

    def test_05_visual_search_multimodal(self):
        query = "electric vehicle charging equipment"
        status, data = fetch_json(f"{API_BASE}/search/visual", method="POST", data={"query": query, "limit": 5})
        self.assertEqual(status, 200)
        results = data.get("results", [])
        self.assertGreater(len(results), 0)
        for res in results:
            self.assertIn("visual_similarity", res)
            self.assertIn("id", res)
            self.assertGreater(res["visual_similarity"], 0.0)

    def test_06_geo_clusters(self):
        status, data = fetch_json(f"{API_BASE}/geo/clusters?grid_size=0.5")
        self.assertEqual(status, 200)
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)

    def test_07_export_geojson(self):
        status, data = fetch_json(f"{API_BASE}/export/observations.geojson?category_id=street_trees&limit=10")
        self.assertEqual(status, 200)
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertIn("features", data)

    def test_08_review_workflow(self):
        # Fetch an unverified observation
        status, obs_data = fetch_json(f"{API_BASE}/observations?limit=1")
        self.assertEqual(status, 200)
        obs_id = obs_data["observations"][0]["id"]

        # Post a review action
        review_payload = {
            "action": "mark_uncertain",
            "notes": "Automated E2E test verification note",
            "reviewer_id": "e2e_analyst"
        }
        status, review_resp = fetch_json(f"{API_BASE}/reviews/{obs_id}", method="POST", data=review_payload)
        self.assertEqual(status, 200)
        self.assertEqual(review_resp.get("status"), "success")

    def test_09_frontend_pages_http_200(self):
        routes = [
            "/",
            "/map",
            "/observations",
            "/visual-search",
            "/similarity",
            "/timeline",
            "/review",
            "/compare",
            "/data-sources"
        ]
        for route in routes:
            code = fetch_status(f"{WEB_BASE}{route}")
            self.assertEqual(code, 200, f"Route {route} returned status {code}")

if __name__ == "__main__":
    unittest.main()
