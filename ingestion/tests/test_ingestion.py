"""
Unit and integration tests for dataset ingestion and normalization pipeline.
"""

import unittest
from datetime import datetime
from ingestion.normalization.coordinates import validate_coordinates
from ingestion.normalization.dates import parse_observation_date
from ingestion.normalization.taxonomy import normalize_category
from ingestion.images.resolver import ImageResolver

class TestIngestionNormalization(unittest.TestCase):
    def test_coordinate_validation_valid(self):
        valid, lat, lon, reason = validate_coordinates(37.7749, -122.4194)
        self.assertTrue(valid)
        self.assertAlmostEqual(lat, 37.7749)
        self.assertAlmostEqual(lon, -122.4194)
        self.assertIsNone(reason)

    def test_coordinate_validation_out_of_bounds(self):
        valid, lat, lon, reason = validate_coordinates(95.0, 10.0)
        self.assertFalse(valid)
        self.assertIn("out of bounds", reason)

        valid, lat, lon, reason = validate_coordinates(10.0, -190.0)
        self.assertFalse(valid)
        self.assertIn("out of bounds", reason)

    def test_coordinate_validation_null_island(self):
        valid, lat, lon, reason = validate_coordinates(0.0, 0.0)
        self.assertFalse(valid)
        self.assertIn("Null Island", reason)

    def test_coordinate_validation_nan(self):
        valid, lat, lon, reason = validate_coordinates("NaN", 10.0)
        self.assertFalse(valid)
        self.assertIn("NaN", reason)

        valid, lat, lon, reason = validate_coordinates("invalid_str", 10.0)
        self.assertFalse(valid)
        self.assertIn("Invalid", reason)

    def test_date_parsing_iso(self):
        dt, has_ts = parse_observation_date("2024-06-13T00:55:20.517000+00:00")
        self.assertTrue(has_ts)
        self.assertIsNotNone(dt)
        self.assertEqual(dt.year, 2024)
        self.assertEqual(dt.month, 6)

    def test_date_parsing_empty(self):
        dt, has_ts = parse_observation_date("")
        self.assertFalse(has_ts)
        self.assertIsNone(dt)

        dt, has_ts = parse_observation_date(None)
        self.assertFalse(has_ts)
        self.assertIsNone(dt)

    def test_taxonomy_normalization(self):
        self.assertEqual(normalize_category("Street Tree"), "street_trees")
        self.assertEqual(normalize_category("bike lane"), "bike_lanes")
        self.assertEqual(normalize_category("Construction Site"), "construction_sites")
        self.assertEqual(normalize_category("Roadwork"), "roadwork")
        self.assertEqual(normalize_category("Crane"), "cranes")
        self.assertEqual(normalize_category("EV Charger"), "ev_chargers")
        self.assertIsNone(normalize_category("unknown_alien_feature"))

    def test_image_resolver_missing(self):
        resolver = ImageResolver(base_storage_dir="data/storage")
        meta = resolver.resolve("images/batch-0001", "non_existent_file_xyz.jpg")
        self.assertEqual(meta["availability"], "missing")
        self.assertIsNone(meta["checksum"])

if __name__ == "__main__":
    unittest.main()
