"""Centralized Application Configuration & Threshold Registry.

Architectural Decisions & Rationale:
1. Multilingual Sentiment Model (cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual):
   - Chosen for robust zero-shot cross-lingual classification across 11 Indian languages
     (Hindi, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi) and Hinglish.
   - Dynamic id2label mapping ensures model label IDs are dynamically mapped to Positive/Neutral/Negative.

2. Multilingual Sentence Embedding Model (sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2):
   - Generates 384-dimensional dense normalized embeddings for cross-lingual semantic matching.
   - Stored in CommentAnalysis as JSON text for lightweight SQLite prototype portability while
     remaining fully forward-compatible with PostgreSQL pgvector.

3. Local-Only Offline AI Pipeline:
   - Evaluates all citizen e-consultation feedback directly on local CPU hardware via PyTorch.
   - Preserves citizen data privacy and eliminates external third-party API dependencies or rate limits.

4. Semantic Similarity & Duplicate Thresholds:
   - SIMILARITY_THRESHOLD (0.75): Cosine similarity cutoff for related comment retrieval.
   - DUPLICATE_THRESHOLD (0.95): High-confidence near-duplicate campaign clustering cutoff.
   - ISSUE_SIMILARITY_THRESHOLD (0.45): Semantic anchor matching cutoff for policy issue categorization.
     Comments below this threshold fall back to "General Feedback".
   - ASPECT_SIMILARITY_THRESHOLD (0.40): Policy aspect anchor cutoff.
"""

import logging
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """Application settings with fail-fast validation for ML models and thresholds."""

    database_url: str = "sqlite:///./policylens.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,https://drishtikon-indol.vercel.app"

    # --- AI & NLP Model Configuration ---
    sentiment_model: str = "cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual"
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    use_ml_model: bool = True
    language_detection: bool = True

    # --- Semantic Similarity Thresholds (0.0 to 1.0) ---
    similarity_threshold: float = 0.75
    duplicate_threshold: float = 0.95
    issue_similarity_threshold: float = 0.45
    aspect_similarity_threshold: float = 0.40

    # --- Policy Evolution Trajectory Thresholds (%) ---
    evolution_improved_drop_pct: float = 40.0
    evolution_emerging_min_growth_pct: float = 100.0
    evolution_persistent_max_change_pct: float = 25.0
    evolution_worsened_min_growth_pct: float = 50.0

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def validate_config(self) -> list[str]:
        """
        Validate all settings at startup.
        Returns a list of validation error messages. An empty list means valid.
        """
        errors = []

        # Database URL check
        if not self.database_url or not self.database_url.strip():
            errors.append("DATABASE_URL must not be empty.")

        # ML Model configuration checks
        if not self.sentiment_model or not self.sentiment_model.strip():
            errors.append("sentiment_model configuration cannot be empty.")
        if not self.embedding_model or not self.embedding_model.strip():
            errors.append("embedding_model configuration cannot be empty.")

        # Threshold range checks (0.0 to 1.0)
        for name, val in [
            ("similarity_threshold", self.similarity_threshold),
            ("duplicate_threshold", self.duplicate_threshold),
            ("issue_similarity_threshold", self.issue_similarity_threshold),
            ("aspect_similarity_threshold", self.aspect_similarity_threshold),
        ]:
            if not isinstance(val, (int, float)) or val < 0.0 or val > 1.0:
                errors.append(f"{name} must be a float between 0.0 and 1.0 (got {val}).")

        # Evolution percentage checks (> 0)
        for name, val in [
            ("evolution_improved_drop_pct", self.evolution_improved_drop_pct),
            ("evolution_emerging_min_growth_pct", self.evolution_emerging_min_growth_pct),
            ("evolution_persistent_max_change_pct", self.evolution_persistent_max_change_pct),
            ("evolution_worsened_min_growth_pct", self.evolution_worsened_min_growth_pct),
        ]:
            if not isinstance(val, (int, float)) or val <= 0.0:
                errors.append(f"{name} must be a positive number (got {val}).")

        return errors


settings = Settings()
