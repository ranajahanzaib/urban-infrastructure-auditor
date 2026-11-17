"""
Local image resolver, validator, and perceptual hasher.
"""

import os
import hashlib
from typing import Optional, Dict, Any
from PIL import Image
import imagehash

class ImageResolver:
    def __init__(self, base_storage_dir: str = "data/storage"):
        self.base_storage_dir = base_storage_dir

    def resolve(self, image_folder: Optional[str], filename: str) -> Dict[str, Any]:
        """
        Locates the image on disk, validates integrity, and computes metadata.
        Returns dict with availability, path, checksum, phash, width, height, size.
        """
        candidate_paths = []
        if image_folder:
            candidate_paths.append(os.path.join(self.base_storage_dir, image_folder, filename))
            # Also try stripped folder
            stripped = image_folder.strip("/\\")
            candidate_paths.append(os.path.join(self.base_storage_dir, stripped, filename))
        
        # Also try default fallback paths
        candidate_paths.append(os.path.join(self.base_storage_dir, "images", "batch-0001", filename))
        candidate_paths.append(os.path.join(self.base_storage_dir, "images", filename))
        candidate_paths.append(os.path.join(self.base_storage_dir, filename))

        found_path = None
        for p in candidate_paths:
            if os.path.isfile(p):
                found_path = p
                break

        if not found_path:
            return {
                "availability": "missing",
                "storage_path": None,
                "checksum": None,
                "phash": None,
                "width": None,
                "height": None,
                "byte_size": 0,
                "mime_type": "image/jpeg",
            }

        try:
            # Check file size
            byte_size = os.path.getsize(found_path)

            # Compute sha256
            sha = hashlib.sha256()
            with open(found_path, "rb") as f:
                for chunk in iter(lambda: f.read(65536), b""):
                    sha.update(chunk)
            checksum = sha.hexdigest()

            # Inspect and compute phash with PIL
            with Image.open(found_path) as img:
                width, height = img.size
                mime_type = Image.MIME.get(img.format, "image/jpeg")
                phash_val = str(imagehash.phash(img))

            return {
                "availability": "available",
                "storage_path": os.path.relpath(found_path, self.base_storage_dir),
                "checksum": checksum,
                "phash": phash_val,
                "width": width,
                "height": height,
                "byte_size": byte_size,
                "mime_type": mime_type,
            }
        except Exception as e:
            return {
                "availability": "failed",
                "storage_path": os.path.relpath(found_path, self.base_storage_dir),
                "checksum": None,
                "phash": None,
                "width": None,
                "height": None,
                "byte_size": byte_size if 'byte_size' in locals() else 0,
                "mime_type": "image/jpeg",
                "error": str(e),
            }
