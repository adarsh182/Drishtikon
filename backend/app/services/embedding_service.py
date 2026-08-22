"""Multilingual Sentence Embedding Service using sentence-transformers.

Architectural Decisions & Rationale:
- Model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 (384-dimensional dense vectors).
- Cross-Lingual Alignment: Trained on 50+ languages, allowing direct cosine similarity comparisons
  between English policy text and Indian language feedback (e.g. Hindi, Tamil, Gujarati).
- Storage Representation: Stored as serialized JSON text arrays in CommentAnalysis for zero-setup
  SQLite prototype portability, while preserving exact 384-dim float arrays ready for direct
  migration to PostgreSQL pgvector (VECTOR(384) + HNSW indexing).
"""

import json
import logging
from typing import Any

import numpy as np

from ..config import settings

logger = logging.getLogger(__name__)

_embedding_model = None
_model_name = settings.embedding_model


def _load_model() -> Any | None:
    """Load the multilingual sentence transformer model on demand."""
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model
    if not settings.use_ml_model:
        return None
    try:
        from sentence_transformers import SentenceTransformer

        logger.info(f"Loading local multilingual embedding model: {_model_name}")
        _embedding_model = SentenceTransformer(_model_name)
        return _embedding_model
    except Exception as e:
        logger.error(f"Failed to load sentence-transformers model: {e}")
        return None


def is_embedding_model_loaded() -> bool:
    """Check if the embedding model is loaded in memory."""
    return _embedding_model is not None


def prewarm_embedding_model() -> bool:
    """Prewarm the embedding model on server startup."""
    model = _load_model()
    if model is not None:
        try:
            model.encode("Prewarming sentence embedding model...", normalize_embeddings=True)
            return True
        except Exception as e:
            logger.warning(f"Embedding prewarm failed: {e}")
    return False


def generate_embedding(text: str) -> list[float] | None:
    """Generate a 384-dimensional normalized float embedding for input text."""
    if not text or not text.strip():
        return None

    model = _load_model()
    if model is None:
        return None

    try:
        emb = model.encode(text.strip(), normalize_embeddings=True)
        return [round(float(x), 6) for x in emb]
    except Exception as e:
        logger.warning(f"Embedding generation failed: {e}")
        return None


def generate_embeddings_batch(texts: list[str], batch_size: int = 32) -> list[list[float] | None]:
    """Generate normalized embeddings for a list of texts in batches."""
    if not texts:
        return []

    model = _load_model()
    if model is None:
        return [None] * len(texts)

    try:
        cleaned_texts = [t.strip() if t else "" for t in texts]
        embeddings = model.encode(cleaned_texts, batch_size=batch_size, normalize_embeddings=True, show_progress_bar=False)
        return [[round(float(x), 6) for x in emb] for emb in embeddings]
    except Exception as e:
        logger.warning(f"Batch embedding generation failed: {e}")
        return [None] * len(texts)


def cosine_similarity(vec_a: list[float] | np.ndarray, vec_b: list[float] | np.ndarray) -> float:
    """Calculate cosine similarity between two normalized vectors."""
    if vec_a is None or vec_b is None:
        return 0.0
    a = np.asarray(vec_a, dtype=np.float32)
    b = np.asarray(vec_b, dtype=np.float32)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(np.dot(a, b) / (norm_a * norm_b))


def find_similar(
    target_embedding: list[float],
    candidates: list[tuple[int, list[float]]],
    threshold: float | None = None,
    top_k: int = 10,
) -> list[tuple[int, float]]:
    """
    Find top-k candidates exceeding similarity threshold.
    Designed with a clean interface that can be backed by pgvector in PostgreSQL.
    """
    cutoff = threshold if threshold is not None else settings.similarity_threshold

    if not target_embedding or not candidates:
        return []

    target_vec = np.asarray(target_embedding, dtype=np.float32)
    norm_target = np.linalg.norm(target_vec)
    if norm_target == 0:
        return []
    target_vec = target_vec / norm_target

    cand_ids = [c[0] for c in candidates]
    cand_vecs = np.asarray([c[1] for c in candidates], dtype=np.float32)

    # Normalize candidate vectors
    norms = np.linalg.norm(cand_vecs, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    cand_vecs = cand_vecs / norms

    # Matrix-vector dot product for vectorized similarity
    scores = np.dot(cand_vecs, target_vec)

    results = []
    for cid, score in zip(cand_ids, scores):
        score_val = round(float(score), 4)
        if score_val >= cutoff:
            results.append((cid, score_val))

    # Sort descending by score
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_k]


def serialize_embedding(embedding: list[float] | None) -> str | None:
    """Serialize embedding to JSON string for database storage."""
    if embedding is None:
        return None
    return json.dumps(embedding)


def deserialize_embedding(embedding_str: str | None) -> list[float] | None:
    """Deserialize JSON string from database into float list."""
    if not embedding_str:
        return None
    try:
        return json.loads(embedding_str)
    except Exception:
        return None
