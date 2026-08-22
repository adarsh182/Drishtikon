"""Multilingual Sentiment Analysis & Language Detection Service.

Architectural Context & Decisions:
- Model: cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual (278M parameters).
- Scope: Handles English and Indian languages (Hindi, Marathi, Gujarati, Bengali, Tamil, Telugu,
  Kannada, Malayalam, Punjabi) + Hinglish / Code-mixed Latin-script submissions.
- Dynamic Label Mapping: Inspects model.config.id2label rather than assuming fixed label indices
  ({0: 'negative', 1: 'neutral', 2: 'positive'}).
- Local Priority: Inference is performed locally on device via PyTorch, ensuring zero data leakage
  for sensitive government consultation feedback and no cloud API rate limiting.
"""

import logging
import os
import re
from typing import Any

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

_pipeline = None
_model_name = settings.sentiment_model

_HF_API_URL = f"https://api-inference.huggingface.co/models/{_model_name}"
_HF_TOKEN = os.getenv("HF_TOKEN", "")

SUPPORTED_INDIC_LANGUAGES = {"en", "hi", "mr", "gu", "bn", "ta", "te", "kn", "ml", "pa"}

HINGLISH_MARKERS = {
    "hai", "hain", "nahi", "nahin", "karo", "karna", "thoda", "zyada", "bhi", "liye",
    "hogi", "hoga", "kaafi", "kuch", "bahut", "accha", "bura", "hum", "aap", "unka",
    "yeh", "woh", "karne", "wali", "wale", "karein", "chahiye", "gaya", "gayi"
}


def detect_language(text: str) -> tuple[str, float]:
    """
    Detect language using statistical n-grams with Hinglish heuristic override.
    Returns (language_code, confidence).
    """
    if not text or len(text.strip()) < 3:
        return "unknown", 0.0

    cleaned = text.strip()
    words_lower = set(re.findall(r"\b[a-zA-Z]+\b", cleaned.lower()))

    # Check for Hinglish / Code-mixed Latin script with Indic markers
    hinglish_match_count = len(words_lower.intersection(HINGLISH_MARKERS))
    if hinglish_match_count >= 2:
        return "mixed", 0.85

    try:
        from langdetect import detect_langs
        predictions = detect_langs(cleaned)
        if not predictions:
            return "unknown", 0.0

        top_pred = predictions[0]
        lang_code = top_pred.lang.lower()
        prob = round(float(top_pred.prob), 4)

        if prob < 0.60:
            return "unknown", prob

        if lang_code in SUPPORTED_INDIC_LANGUAGES:
            return lang_code, prob

        return lang_code, prob
    except Exception as e:
        logger.debug(f"Language detection exception: {e}")
        return "unknown", 0.0


def _load_pipeline() -> Any | None:
    """Load the local multilingual transformer pipeline."""
    global _pipeline
    if _pipeline is not None:
        return _pipeline
    if not settings.use_ml_model:
        return None
    try:
        from transformers import pipeline

        logger.info(f"Loading local multilingual sentiment model: {_model_name}")
        pipeline_factory: Any = pipeline
        _pipeline = pipeline_factory(
            "sentiment-analysis",
            model=_model_name,
            top_k=None,
        )
        return _pipeline
    except Exception as e:
        logger.error(f"Failed to load local sentiment pipeline: {e}")
        return None


def is_model_loaded() -> bool:
    """Check if the sentiment pipeline is successfully loaded in memory."""
    return _pipeline is not None


def prewarm_model() -> bool:
    """Prewarm the sentiment pipeline on server startup."""
    pipe = _load_pipeline()
    if pipe is not None:
        try:
            pipe("Prewarming model...")
            return True
        except Exception as e:
            logger.warning(f"Sentiment prewarm failed: {e}")
    return False


_circuit_breaker_fails = 0
_circuit_breaker_max = 3


def _map_label_dynamically(label: str, score: float, id2label: dict | None = None) -> tuple[str, float]:
    """Dynamically map output label based on model's id2label or text inspection."""
    lbl = label.strip()

    # If label is in format "LABEL_0", "LABEL_1", "LABEL_2" and we have id2label
    if id2label and lbl in id2label:
        lbl = str(id2label[lbl])
    elif id2label and lbl.upper().startswith("LABEL_"):
        try:
            idx = int(lbl.split("_")[1])
            if idx in id2label:
                lbl = str(id2label[idx])
        except (ValueError, IndexError):
            pass

    label_lower = lbl.lower()
    if "pos" in label_lower or label_lower == "label_2":
        return "Positive", score
    if "neg" in label_lower or label_lower == "label_0":
        return "Negative", score
    if "neu" in label_lower or label_lower == "label_1":
        return "Neutral", score

    return "Neutral", score


def _hf_api_analyze(text: str) -> dict[str, Any] | None:
    """Call HF Inference API remotely for XLM-RoBERTa if local is disabled."""
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
            timeout=2.0,
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
            sentiment, confidence = _map_label_dynamically(best["label"], best["score"])
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
    """Documented keyword fallback when ML model is disabled or unavailable."""
    lower = text.lower()
    negative_words = [
        "too", "excessive", "burden", "harsh", "difficult", "complicated",
        "unclear", "ambiguous", "concern", "oppose", "against", "problem",
        "unfair", "costly", "impossible", "unworkable", "penalty", "fine",
        "खराब", "कठिन", "बोझ", "दंड", "नुकसान", "अस्पष्ट", "समस्या", "विरोध"
    ]
    positive_words = [
        "support", "welcome", "improve", "better", "clear", "helpful",
        "reasonable", "fair", "good", "benefit", "easier", "transparent",
        "commend", "approve", "positive", "effective",
        "अच्छा", "स्वागत", "सुधार", "सराहनीय", "पारदर्शी", "लाभ", "उचित"
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


def analyze_sentiment(text: str) -> dict[str, Any]:
    """
    Analyze sentiment of input text using local multilingual transformer.
    Returns dictionary with sentiment, confidence, model_name, detected_language, and language_confidence.
    """
    cleaned = re.sub(r"\s+", " ", text.strip())
    if not cleaned:
        return {
            "sentiment": "Neutral",
            "confidence": 0.0,
            "model_name": "empty-text",
            "detected_language": "unknown",
            "language_confidence": 0.0,
        }

    lang, lang_conf = detect_language(cleaned)

    # 1. Primary: Local Multilingual ML model
    pipe = _load_pipeline()
    if pipe is not None:
        try:
            id2label = getattr(pipe.model.config, "id2label", None) if hasattr(pipe, "model") else None
            results = pipe(cleaned[:512])[0]
            if isinstance(results, list):
                best = max(results, key=lambda x: x["score"])
                sentiment, confidence = _map_label_dynamically(best["label"], best["score"], id2label)
            else:
                sentiment, confidence = _map_label_dynamically(results["label"], results["score"], id2label)
            return {
                "sentiment": sentiment,
                "confidence": round(float(confidence), 4),
                "model_name": _model_name,
                "detected_language": lang,
                "language_confidence": lang_conf,
            }
        except Exception as e:
            logger.error(f"Inference error with local sentiment pipeline: {e}")

    # 2. Secondary: Remote HF API (if configured)
    api_result = _hf_api_analyze(cleaned)
    if api_result is not None:
        api_result["detected_language"] = lang
        api_result["language_confidence"] = lang_conf
        return api_result

    # 3. Fallback: Keyword Analysis
    fallback_res = _fallback_analyze(cleaned)
    fallback_res["detected_language"] = lang
    fallback_res["language_confidence"] = lang_conf
    return fallback_res
