"""
DINOv2 Base feature extractor for image-to-image similarity and duplicate discovery.
Uses 'facebook/dinov2-base' (768 dimensions).
"""

import logging
from typing import List, Union
import numpy as np
import torch
from PIL import Image
from transformers import AutoImageProcessor, AutoModel

logger = logging.getLogger("dinov2")

class DINOv2Extractor:
    MODEL_ID = "facebook/dinov2-base"
    DIMENSION = 768

    def __init__(self, device: str = None):
        if device is None:
            if torch.cuda.is_available():
                self.device = "cuda"
            elif torch.backends.mps.is_available():
                self.device = "mps"
            else:
                self.device = "cpu"
        else:
            self.device = device

        logger.info(f"Initializing DINOv2 on device: {self.device}")
        self.processor = AutoImageProcessor.from_pretrained(self.MODEL_ID)
        self.model = AutoModel.from_pretrained(self.MODEL_ID).to(self.device)
        self.model.eval()

    def encode_image(self, image: Union[Image.Image, str]) -> np.ndarray:
        """
        Encodes a single PIL Image or image file path.
        Returns a normalized 768-d numpy array.
        """
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")
        elif image.mode != "RGB":
            image = image.convert("RGB")

        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)
            # Pool representation: last_hidden_state [CLS] token (index 0)
            embedding = outputs.last_hidden_state[:, 0, :].squeeze(0).cpu().numpy()

        # L2 Normalize
        norm = np.linalg.norm(embedding)
        if norm > 1e-12:
            embedding = embedding / norm

        return embedding.astype(np.float32)

    def encode_batch(self, images: List[Union[Image.Image, str]]) -> np.ndarray:
        """
        Encodes a list of PIL Images or file paths in a single batch.
        Returns (N, 768) normalized numpy array.
        """
        pil_images = []
        for img in images:
            if isinstance(img, str):
                pil_images.append(Image.open(img).convert("RGB"))
            elif img.mode != "RGB":
                pil_images.append(img.convert("RGB"))
            else:
                pil_images.append(img)

        inputs = self.processor(images=pil_images, return_tensors="pt").to(self.device)
        with torch.no_grad():
            outputs = self.model(**inputs)
            embeddings = outputs.last_hidden_state[:, 0, :].cpu().numpy()

        # Row-wise L2 normalization
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms = np.maximum(norms, 1e-12)
        normalized = embeddings / norms
        return normalized.astype(np.float32)
