"""
SigLIP Cross-Modal Embedding Model for Natural-Language Image Search.
Uses 'google/siglip-base-patch16-224' (768 dimensions).
"""

import os
import logging
from typing import List, Union
import numpy as np
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModel

logger = logging.getLogger("siglip")

class SigLIP2Model:
    MODEL_ID = os.getenv("SIGLIP_MODEL_ID", "google/siglip-base-patch16-224")
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

        logger.info(f"Initializing SigLIP on device: {self.device} with model: {self.MODEL_ID}")
        try:
            self.processor = AutoProcessor.from_pretrained(self.MODEL_ID)
            self.model = AutoModel.from_pretrained(self.MODEL_ID).to(self.device)
        except Exception as e:
            logger.warning(f"Could not load {self.MODEL_ID} ({e}), falling back to google/siglip-base-patch16-224")
            self.MODEL_ID = "google/siglip-base-patch16-224"
            self.processor = AutoProcessor.from_pretrained(self.MODEL_ID)
            self.model = AutoModel.from_pretrained(self.MODEL_ID).to(self.device)

        self.model.eval()

    def _extract_tensor(self, out: any) -> torch.Tensor:
        if hasattr(out, "pooler_output") and out.pooler_output is not None:
            return out.pooler_output
        if hasattr(out, "last_hidden_state") and out.last_hidden_state is not None:
            return out.last_hidden_state[:, 0, :]
        return out

    def encode_text(self, text: str) -> np.ndarray:
        """
        Encodes a natural-language search query into a normalized 768-d vector.
        """
        inputs = self.processor(text=[text], padding="max_length", return_tensors="pt").to(self.device)
        with torch.no_grad():
            out = self.model.get_text_features(**inputs)
            tensor = self._extract_tensor(out)
            embedding = tensor.squeeze(0).cpu().numpy()

        norm = np.linalg.norm(embedding)
        if norm > 1e-12:
            embedding = embedding / norm

        return embedding.astype(np.float32)

    def encode_image(self, image: Union[Image.Image, str]) -> np.ndarray:
        """
        Encodes a single PIL Image or image file path.
        Returns a normalized 768-d vector.
        """
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")
        elif image.mode != "RGB":
            image = image.convert("RGB")

        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        with torch.no_grad():
            out = self.model.get_image_features(**inputs)
            tensor = self._extract_tensor(out)
            embedding = tensor.squeeze(0).cpu().numpy()

        norm = np.linalg.norm(embedding)
        if norm > 1e-12:
            embedding = embedding / norm

        return embedding.astype(np.float32)

    def encode_batch_images(self, images: List[Union[Image.Image, str]]) -> np.ndarray:
        """
        Encodes a list of images in a single batch.
        Returns (N, 768) normalized array.
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
            out = self.model.get_image_features(**inputs)
            tensor = self._extract_tensor(out)
            embeddings = tensor.cpu().numpy()

        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms = np.maximum(norms, 1e-12)
        return (embeddings / norms).astype(np.float32)
