"""
Unit tests for computer vision models, normalization, and similarity computations.
"""

import unittest
import numpy as np
from PIL import Image

class TestVisionPipeline(unittest.TestCase):
    def test_l2_normalization(self):
        # Test that arbitrary vectors normalized with L2 have unit norm
        vec = np.array([3.0, 4.0, 0.0], dtype=np.float32)
        norm = np.linalg.norm(vec)
        normalized = vec / norm
        self.assertAlmostEqual(float(np.linalg.norm(normalized)), 1.0, places=5)

    def test_cosine_similarity(self):
        # Identical vectors should have similarity 1.0
        v1 = np.array([0.6, 0.8, 0.0], dtype=np.float32)
        v2 = np.array([0.6, 0.8, 0.0], dtype=np.float32)
        sim = float(np.dot(v1, v2))
        self.assertAlmostEqual(sim, 1.0, places=5)

        # Orthogonal vectors should have similarity 0.0
        v3 = np.array([0.0, 0.0, 1.0], dtype=np.float32)
        sim_ortho = float(np.dot(v1, v3))
        self.assertAlmostEqual(sim_ortho, 0.0, places=5)

    def test_siglip_text_embedding(self):
        from services.vision.models.siglip import SigLIP2Model
        service = SigLIP2Model(device="cpu")
        query = "construction excavator on street"
        emb = service.encode_text(query)
        self.assertEqual(len(emb), 768)
        norm = np.linalg.norm(emb)
        self.assertAlmostEqual(float(norm), 1.0, places=4)

    def test_dinov2_synthetic_image_embedding(self):
        from services.vision.models.dinov2 import DINOv2Extractor
        service = DINOv2Extractor(device="cpu")
        # Create a 224x224 RGB image in memory
        img = Image.new("RGB", (224, 224), color=(128, 200, 100))
        emb = service.encode_image(img)
        self.assertEqual(len(emb), 768)
        norm = np.linalg.norm(emb)
        self.assertAlmostEqual(float(norm), 1.0, places=4)

if __name__ == "__main__":
    unittest.main()
