import re
import os
from typing import Any

import httpx

from app.config import settings

_pipeline = None
_model_name = settings.sentiment_model

# HF Inference API (free, no token required for public models)
_HF_API_URL = f"https://api-inference.huggingface.co/models/{_model_name}"
_HF_TOKEN = os.getenv("HF_TOKEN", "")


def _load_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    if not settings.use_ml_model:
        return None
    try:
        from transformers import pipeline

        _pipeline = pipeline(
            "sentiment-analysis",
            model=_model_name,
            top_k=None,
        )
        return _pipeline
    except Exception:
        return None


_circuit_breaker_fails = 0
_circuit_breaker_max = 3

def _hf_api_analyze(text: str) -> dict[str, Any]:
    """Call HF Inference API remotely — same RoBERTa model, zero local RAM."""
    global _circuit_breaker_fails
    if _circuit_breaker_fails >= _circuit_breaker_max:
        return None

    headers = {}
    if _HF_TOKEN:
        headers["Authorization"] = f"Bearer {_HF_TOKEN}"
    try:
        resp = httpx.post(
            _HF_API_URL,
            json={"inputs": text[:512]},
            headers=headers,
            timeout=1.5,
        )
        if resp.status_code != 200:
            if resp.status_code in (429, 503, 504):
                _circuit_breaker_fails += 1
            return None
        
        _circuit_breaker_fails = 0
        results = resp.json()
        if isinstance(results, list) and len(results) > 0:
            scores = results[0] if isinstance(results[0], list) else results
            best = max(scores, key=lambda x: x["score"])
            sentiment, confidence = _map_label(best["label"], best["score"])
            return {
                "sentiment": sentiment,
                "confidence": round(float(confidence), 4),
                "model_name": f"{_model_name} (api)",
            }
        return None
    except Exception:
        _circuit_breaker_fails += 1
        return None


def _fallback_analyze(text: str) -> dict[str, Any]:
    """Keyword-based fallback when HF model unavailable. Still analyzes actual text."""
    lower = text.lower()
    negative_words = [
        "too", "excessive", "burden", "harsh", "difficult", "complicated",
        "unclear", "ambiguous", "concern", "oppose", "against", "problem",
        "unfair", "costly", "impossible", "unworkable", "penalty", "fine",
    ]
    positive_words = [
        "support", "welcome", "improve", "better", "clear", "helpful",
        "reasonable", "fair", "good", "benefit", "easier", "transparent",
        "commend", "approve", "positive", "effective",
    ]
    neg = sum(1 for w in negative_words if w in lower)
    pos = sum(1 for w in positive_words if w in lower)
    if neg > pos and neg > 0:
        sentiment, confidence = "Negative", min(0.95, 0.55 + neg * 0.08)
    elif pos > neg and pos > 0:
        sentiment, confidence = "Positive", min(0.95, 0.55 + pos * 0.08)
    else:
        sentiment, confidence = "Neutral", 0.6
    return {
        "sentiment": sentiment,
        "confidence": round(confidence, 4),
        "model_name": "keyword-fallback-v1",
    }


def _map_label(label: str, score: float) -> tuple[str, float]:
    label_lower = label.lower()
    if "positive" in label_lower or label_lower == "label_2":
        return "Positive", score
    if "negative" in label_lower or label_lower == "label_0":
        return "Negative", score
    if "neutral" in label_lower or label_lower == "label_1":
        return "Neutral", score
    return "Neutral", score


def analyze_sentiment(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"\s+", " ", text.strip())
    if not cleaned:
        return {"sentiment": "Neutral", "confidence": 0.0, "model_name": "empty-text"}

    # 1. Try local ML model (when USE_ML_MODEL=true and enough RAM)
    pipe = _load_pipeline()
    if pipe is not None:
        try:
            results = pipe(cleaned[:512])[0]
            if isinstance(results, list):
                best = max(results, key=lambda x: x["score"])
                sentiment, confidence = _map_label(best["label"], best["score"])
            else:
                sentiment, confidence = _map_label(results["label"], results["score"])
            return {
                "sentiment": sentiment,
                "confidence": round(float(confidence), 4),
                "model_name": _model_name,
            }
        except Exception:
            pass

    # 2. Try HF Inference API (same model, runs on HF servers, free)
    api_result = _hf_api_analyze(cleaned)
    if api_result is not None:
        return api_result

    # 3. Keyword fallback (always works)
    return _fallback_analyze(cleaned)
