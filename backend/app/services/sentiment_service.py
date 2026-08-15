import re
from typing import Any

from app.config import settings

_pipeline = None
_model_name = settings.sentiment_model


def _load_pipeline():
    global _pipeline
    if _pipeline is not None:
        return _pipeline
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

    pipe = _load_pipeline()
    if pipe is None:
        return _fallback_analyze(cleaned)

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
        return _fallback_analyze(cleaned)
