# Dataset & Model Attribution

## 1. Datasets

### A. Construction & Infrastructure Change

- **Repository**: [https://huggingface.co/datasets/EDK-Earth/construction-infrastructure-change](https://huggingface.co/datasets/EDK-Earth/construction-infrastructure-change)
- **Creator**: EDK-Earth
- **License**: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Original Imagery Sources**: Mapillary and contributing civic photographers.
- **Attribution Notice**: "Data provided by EDK-Earth under CC BY 4.0. Contains imagery and spatial metadata compiled from Mapillary and open geospatial contributors."

### B. Urban Climate & Green Infrastructure

- **Repository**: [https://huggingface.co/datasets/EDK-Earth/urban-climate-green-infrastructure](https://huggingface.co/datasets/EDK-Earth/urban-climate-green-infrastructure)
- **Creator**: EDK-Earth
- **License**: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)
- **Original Imagery Sources**: Mapillary, open street surveys, and contributing civic photographers.
- **Attribution Notice**: "Data provided by EDK-Earth under CC BY 4.0. Contains imagery and spatial metadata compiled from Mapillary and open geospatial contributors."

---

## 2. Computer Vision Models

### A. SigLIP 2

- **Model Identifier**: `google/siglip-base-patch16-224`
- **Authors**: Google DeepMind
- **License**: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- **Primary Use**: Multimodal text-to-image semantic indexing and natural-language search.

### B. DINOv2 Base

- **Model Identifier**: `facebook/dinov2-base`
- **Authors**: Meta AI Research (FAIR)
- **License**: [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- **Primary Use**: Unsupervised visual feature representation, image-to-image similarity, and near-duplicate candidate discovery.

---

## 3. Cartography & Map Tiles

- **Basemap Tiles**: OpenStreetMap contributors, CartoDB Positron / Dark Matter.
- **Tile Attribution**: `© OpenStreetMap contributors © CARTO`.
- **Licensing**: Open Database License (ODbL).

---

## 4. Ethical & Analytical Guardrails

1. **No Individual Surveillance or Facial Recognition**: The models and processing pipelines in this platform do not detect, classify, track, or identify human beings, personal vehicles, or private residences.
2. **Weak Labels vs. Ground Truth**: Machine-generated labels are treated strictly as historical observation evidence, never as unassailable ground truth.
3. **No Automatic Record Deletion**: High visual similarity creates candidate relation edges in the ledger for analyst review; it never deletes or merges historical observation records automatically.
4. **No Image Scraping or Fabrication**: Missing images are transparently acknowledged and maintained as metadata-only observations. No synthetic or scraped images are fabricated.
