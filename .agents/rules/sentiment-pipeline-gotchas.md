---
description: Gotchas, bug patterns, Hugging Face API constraints, and architectural requirements for the sentiment analysis pipeline
activation: glob
globs:
  - "**/sentiment.py"
  - "**/sentiment_service.py"
  - "**/test_sentiment.py"
alwaysApply: false
---

# Sentiment Pipeline Gotchas & Rules

This rule documents critical constraints, bug patterns, and verified implementation statuses for the sentiment analysis pipeline in Drishtikon (`backend/app/services/sentiment_service.py` / `sentiment.py`).

---

## Verified Status of Sentiment Pipeline Components

### 1. Hugging Face Inference API Endpoint & Authentication
- **Constraint**: The legacy endpoint `api-inference.huggingface.co` is deprecated and returns `404 Not Found` on API requests. The working replacement endpoint is `https://router.huggingface.co/hf-inference/models/{model}`. Furthermore, Hugging Face now enforces mandatory authentication requiring an `Authorization: Bearer {HF_TOKEN}` header even for public models on the free tier (anonymous requests are rejected).
- **Current State in Repo**: **`Still needs fixing`**
- **Findings in Codebase**:
  - `backend/app/services/sentiment_service.py` still references `_HF_API_URL = f"https://api-inference.huggingface.co/models/{_model_name}"`.
  - The comments still assume no token is required (`# HF Inference API (free, no token required for public models)`), and requests proceed with an empty header when `HF_TOKEN` is unset.
  - When modifying this file, update the endpoint URL to `https://router.huggingface.co/hf-inference/models/{model}` and ensure a valid `HF_TOKEN` is supplied in the headers.

---

### 2. Circuit Breaker Cooldown & Retry Window
- **Constraint**: Remote API calls must be protected by a resilient circuit breaker that includes a time-based cooldown/retry window (e.g., reset after 60 seconds or exponential backoff). Without a cooldown mechanism, transient rate limits (HTTP 429) or cold starts (HTTP 503/504) trip the breaker permanently after 3 failures, disabling the API for the remainder of the server lifecycle.
- **Current State in Repo**: **`Still needs fixing`**
- **Findings in Codebase**:
  - `backend/app/services/sentiment_service.py` uses a primitive counter: `_circuit_breaker_fails = 0` and `_circuit_breaker_max = 3`.
  - Once `_circuit_breaker_fails >= 3`, `_hf_api_analyze()` immediately returns `None` without recording failure timestamps or allowing any retry cooldown window.
  - When modifying this file, introduce timestamp-based tracking (e.g., `_circuit_breaker_last_trip_time`) so the circuit breaker transitions to a half-open state after a cooldown duration.

---

### 3. Multilingual Coverage vs. Keyword-Matching Fallback
- **Constraint**: The keyword-matching fallback (`_fallback_analyze`) is strictly English-only and serves merely as an emergency fallback. A batch of `Neutral` results across Hindi, Hinglish, or regional-language comments indicates that the real ML model (`cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual`) failed to load or execute, not that the comments are genuinely neutral.
- **Current State in Repo**: **`Still needs fixing`** (Active Gotcha & Limitation)
- **Findings in Codebase**:
  - `_fallback_analyze()` in `backend/app/services/sentiment_service.py` evaluates only static English keyword sets (`negative_words = ["too", "excessive", ...]` and `positive_words = ["support", "welcome", ...]`).
  - When non-English text bypasses or fails the ML pipeline, it matches zero keywords and defaults to `{"sentiment": "Neutral", "confidence": 0.6, "model_name": "keyword-fallback-v1"}`.
  - Debugging Rule: When analyzing consultation outputs, always verify `model_name` in `CommentAnalysis`. If `model_name` is `keyword-fallback-v1` or `error-fallback` on non-English comments, the ML transformer pipeline was not engaged.

---

### 4. Local Model Startup Warm-up
- **Constraint**: The local transformer pipeline should be initialized and warmed up during server startup (`@app.on_event("startup")` or at module import time when `USE_ML_MODEL=true`), rather than lazily on the first incoming user request. Lazy loading causes the live demo or first CSV upload batch to block and potentially trigger client timeouts while weights download and initialize in memory.
- **Current State in Repo**: **`Still needs fixing`**
- **Findings in Codebase**:
  - `_pipeline` is initialized to `None` and loaded on-demand via `_load_pipeline()` upon the first call to `analyze_sentiment()`.
  - `backend/app/main.py`'s `startup()` event initializes the database connection and demo seeds, but does not invoke `_load_pipeline()` to warm up model tensors.
  - When modifying the startup workflow, ensure `_load_pipeline()` is invoked during application initialization if `settings.use_ml_model` is enabled.
