# Computer Vision & ML Pipeline

## 1. Dual-Model Architecture

The platform separates **semantic cross-modal search** from **visual neighborhood discovery**:

```
+---------------------------------------------------------------------------------+
|                                 Input Query                                     |
+---------------------------------------+-----------------------------------------+
                                        |
                    +-------------------+-------------------+
                    |                                       |
                    v (Natural Language Text)               v (Reference Image)
         +--------------------+                  +--------------------+
         |      SigLIP 2      |                  |      DINOv2        |
         | (google/siglip-    |                  |  (facebook/        |
         |  base-patch16-224) |                  |   dinov2-base)     |
         +---------+----------+                  +---------+----------+
                   |                                       |
                   v (768-d text vector)                   v (768-d vision vector)
         +--------------------+                  +--------------------+
         |   L2 Normalization |                  |   L2 Normalization |
         +---------+----------+                  +---------+----------+
                   |                                       |
                   v                                       v
         +------------------------------------------------------------+
         |               pgvector (HNSW Cosine Operator)              |
         |              Cosine Similarity: 1 - (vec1 <=> vec2)        |
         +------------------------------------------------------------+
```

---

## 2. Model Specialization

### A. SigLIP 2 (`google/siglip-base-patch16-224`)

- **Type**: Multimodal Vision-Language Transformer (Dual-Encoder).
- **Dimension**: 768 float32 values.
- **Normalization**: Mandatory L2-normalization before storage and similarity computation.
- **Usage**:
  - Open-vocabulary natural language visual search.
  - Zero-shot infrastructure feature identification.
  - Ranking images by descriptive textual prompts (e.g., _"rooftop solar panels on an apartment building"_ or _"overhead construction crane above street level"_).
- **Metric**: Cosine similarity (`1 - (emb <=> query_emb)`). Similarity values typically range from `0.10` to `0.35` for relevant natural language matches; they are labeled as **visual similarity scores**, never calibrated probabilities.

### B. DINOv2 Base (`facebook/dinov2-base`)

- **Type**: Self-Supervised Vision Transformer without language supervision.
- **Dimension**: 768 float32 values (extracted from `[CLS]` token output).
- **Usage**:
  - Image-to-image similarity matching.
  - Finding visual neighborhoods across distinct dataset sources.
  - Detecting near-duplicates and camera bursts taken seconds apart.
- **Duplicate Detection Heuristic**:
  - Pairwise DINOv2 cosine similarity > `0.95`: Flagged as `near_duplicate`.
  - Pairwise DINOv2 cosine similarity between `0.85` and `0.95`: Flagged as `visual_similar`.
  - Physical distance < 50m with different timestamps: Flagged as `temporal_repeat` candidates.

---

## 3. Batch Processing & Discovery Pipeline

The batch embedding pipeline (`services/vision/processing/batch_embedder.py`):

1. **Discovers Unprocessed Images**: Queries `observations` where `siglip_status = 'pending'` or `dinov2_status = 'pending'`.
2. **Generates Embeddings**: Processes images in batches of 32 on the configured device (`cuda`, `mps`, or `cpu`).
3. **Stores Embeddings**: Upserts 768-d vectors into `image_embeddings`.
4. **Calculates Perceptual Hash**: Computes difference hash (`dhash`) and average hash (`ahash`) using Pillow & imagehash.
5. **Generates Graph Relations**: Computes pairwise cosine similarity across all embedded assets. Identified candidate pairs are inserted into `observation_relations`.

---

## 4. Hardware Fallbacks & Performance

- **Apple Silicon (MPS)**: Supported automatically when `torch.backends.mps.is_available()`.
- **NVIDIA GPU (CUDA)**: Supported automatically when `torch.cuda.is_available()`.
- **CPU Fallback**: High performance via PyTorch MKL/OpenMP on standard development machines.
- **Resilience**: If the vision microservice goes down, all GIS, spatial, attribute, and review features remain fully operational. Visual search endpoints return a graceful `503 Service Unavailable` explaining that the vision engine is offline.
