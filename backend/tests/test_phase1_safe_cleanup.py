"""Comprehensive Automated Test Suite for Phase 1: Safe Cleanup.

Tests:
1. Startup Config Validation (valid vs invalid cases)
2. Health Endpoint with Database & Model Probes
3. Route 4xx Error Handling (missing entities, malformed uploads)
4. Multilingual Sentiment & Language Detection
5. Multilingual Sentence Embeddings & Cosine Similarity
6. Lifecycle Trajectory Classification
"""

import io
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.config import Settings
from app.services.sentiment_service import analyze_sentiment, detect_language
from app.services.embedding_service import (
    generate_embedding,
    cosine_similarity,
    serialize_embedding,
    deserialize_embedding,
)
from app.services.evolution_service import classify_lifecycle


@pytest.fixture
def client():
    """Create a FastAPI test client."""
    with TestClient(app) as c:
        yield c


# ==============================================================================
# 1. Config Validation Tests
# ==============================================================================

def test_valid_config():
    """Verify that default settings produce zero validation errors."""
    s = Settings()
    errors = s.validate_config()
    assert len(errors) == 0, f"Expected 0 errors, got: {errors}"


def test_invalid_database_url():
    """Verify that empty database_url triggers a validation error."""
    s = Settings(database_url="")
    errors = s.validate_config()
    assert any("DATABASE_URL" in e for e in errors)


def test_invalid_model_names():
    """Verify that empty model names trigger validation errors."""
    s = Settings(sentiment_model="", embedding_model="")
    errors = s.validate_config()
    assert any("sentiment_model" in e for e in errors)
    assert any("embedding_model" in e for e in errors)


def test_invalid_threshold_ranges():
    """Verify that out-of-bound threshold numbers trigger validation errors."""
    s = Settings(
        similarity_threshold=1.5,
        duplicate_threshold=-0.1,
        issue_similarity_threshold=2.0,
    )
    errors = s.validate_config()
    assert any("similarity_threshold" in e for e in errors)
    assert any("duplicate_threshold" in e for e in errors)
    assert any("issue_similarity_threshold" in e for e in errors)


def test_invalid_evolution_percentages():
    """Verify that non-positive evolution thresholds trigger errors."""
    s = Settings(evolution_improved_drop_pct=-10.0)
    errors = s.validate_config()
    assert any("evolution_improved_drop_pct" in e for e in errors)


# ==============================================================================
# 2. Health Check Endpoint Tests
# ==============================================================================

def test_health_endpoint_structure(client):
    """Verify that /health returns 200 with rich status, database and model fields."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "ok", "degraded")
    assert data["database"] == "connected"
    assert "sentiment_model" in data
    assert "embedding_model" in data
    assert data["ready"] is True


def test_root_endpoint(client):
    """Verify that / returns service metadata."""
    response = client.get("/")
    assert response.status_code == 200
    assert "Drishtikon" in response.json()["service"]


# ==============================================================================
# 3. Route 4xx Error Handling Tests
# ==============================================================================

def test_get_nonexistent_comment_returns_404(client):
    """Verify that requesting a missing comment ID returns clean HTTP 404."""
    response = client.get("/comments/9999999")
    assert response.status_code == 404
    assert "Comment not found" in response.json()["detail"]


def test_get_nonexistent_consultation_returns_404(client):
    """Verify that requesting a missing consultation ID returns clean HTTP 404."""
    response = client.get("/consultations/9999999")
    assert response.status_code == 404
    assert "Consultation not found" in response.json()["detail"]


def test_get_similar_comments_nonexistent_returns_404(client):
    """Verify that requesting similar comments for missing ID returns clean HTTP 404."""
    response = client.get("/comments/9999999/similar")
    assert response.status_code == 404
    assert "Comment not found" in response.json()["detail"]


def test_upload_non_csv_file_returns_400(client):
    """Verify that uploading a non-CSV file returns clean HTTP 400."""
    fake_file = io.BytesIO(b"Hello world")
    response = client.post(
        "/comments/upload",
        files={"file": ("test.txt", fake_file, "text/plain")},
    )
    assert response.status_code == 400
    assert "valid CSV" in response.json()["detail"]


def test_upload_empty_csv_returns_safe_response(client):
    """Verify that uploading an empty CSV returns safe validation failure response without 500."""
    empty_csv = io.BytesIO(b"")
    response = client.post(
        "/comments/upload",
        files={"file": ("empty.csv", empty_csv, "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["rows_total"] == 0


# ==============================================================================
# 4. Multilingual Sentiment & Language Detection Tests
# ==============================================================================

def test_language_detection_dravidian_devanagari():
    """Verify language detection across Hindi, Tamil, and English."""
    hindi_text = "मासिक रिपोर्टिंग की अनिवार्यता बहुत अधिक कागजी काम बढ़ाती है।"
    lang_hi, conf_hi = detect_language(hindi_text)
    assert lang_hi == "hi"
    assert conf_hi >= 0.8

    tamil_text = "சிறு நிறுவனங்களுக்கு மாதாந்திர அறிக்கை சமர்ப்பிப்பது அதிக நிர்வாக சுமையை ஏற்படுத்துகிறது."
    lang_ta, conf_ta = detect_language(tamil_text)
    assert lang_ta == "ta"
    assert conf_ta >= 0.8

    english_text = "The compliance requirements are excessively burdensome for startups."
    lang_en, conf_en = detect_language(english_text)
    assert lang_en == "en"
    assert conf_en >= 0.8


def test_sentiment_analysis_multilingual():
    """Verify that sentiment analysis returns valid sentiment, confidence, and model name."""
    res = analyze_sentiment("The compliance burden is excessive and impossible to follow.")
    assert res["sentiment"] in ("Positive", "Neutral", "Negative")
    assert 0.0 <= res["confidence"] <= 1.0
    assert res["model_name"] != ""


# ==============================================================================
# 5. Multilingual Embeddings & Cosine Similarity Tests
# ==============================================================================

def test_embedding_generation_and_dimension():
    """Verify 384-dimensional normalized dense embedding vector generation."""
    emb = generate_embedding("Corporate governance standards must be transparent.")
    assert emb is not None
    assert len(emb) == 384
    assert isinstance(emb[0], float)


def test_cosine_similarity_properties():
    """Verify mathematical properties of cosine similarity."""
    vec_a = [1.0, 0.0, 0.0]
    vec_b = [1.0, 0.0, 0.0]
    vec_c = [0.0, 1.0, 0.0]

    # Identical vectors -> 1.0
    assert round(cosine_similarity(vec_a, vec_b), 4) == 1.0
    # Orthogonal vectors -> 0.0
    assert round(cosine_similarity(vec_a, vec_c), 4) == 0.0
    # None handling -> 0.0
    assert cosine_similarity(None, vec_a) == 0.0


def test_embedding_serialization_roundtrip():
    """Verify that embedding serialization to JSON and deserialization are lossless."""
    original = [0.123456, -0.654321, 0.987654]
    serialized = serialize_embedding(original)
    deserialized = deserialize_embedding(serialized)
    assert deserialized == original


# ==============================================================================
# 6. Lifecycle Trajectory Classification Tests
# ==============================================================================

def test_lifecycle_classification_improved():
    """Verify IMPROVED lifecycle trajectory when complaints drop significantly."""
    # v1=100 -> v2=50 -> v3=20 (80% drop)
    status = classify_lifecycle(100, 50, 20)
    assert status == "IMPROVED"


def test_lifecycle_classification_emerging():
    """Verify EMERGING lifecycle trajectory when complaints grow or newly appear."""
    # v1=0 -> v2=10 -> v3=30
    status = classify_lifecycle(0, 10, 30)
    assert status == "EMERGING"


def test_lifecycle_classification_persistent():
    """Verify PERSISTENT lifecycle trajectory when complaints stay flat."""
    # v1=40 -> v2=42 -> v3=39
    status = classify_lifecycle(40, 42, 39)
    assert status == "PERSISTENT"
