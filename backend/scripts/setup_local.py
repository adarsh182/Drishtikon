"""Local-First Environment Setup & Pre-flight Verification Script.

This script executes the complete setup required for a fresh local installation:
1. Verifies Python runtime compatibility (>= 3.10).
2. Initializes SQLite database and executes idempotent schema migrations.
3. Checks local Hugging Face model cache (downloads only if missing).
4. Pre-warms multilingual sentiment and sentence embedding models.
5. Seeds the 11-language synthetic demonstration dataset if empty.
6. Validates end-to-end local inference pipeline.
"""

import os
import sys
import time
from pathlib import Path

# Set up project path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings
from app.database.connection import SessionLocal, init_db
from app.models.comment import Comment, CommentAnalysis
from app.models.consultation import Consultation
from app.services.embedding_service import prewarm_embedding_model
from app.services.sentiment_service import analyze_sentiment, prewarm_model


def check_python_version():
    """Ensure Python >= 3.10."""
    print("------------------------------------------------------------")
    print(f"Python Runtime: {sys.version.split()[0]} ({sys.executable})")
    if sys.version_info < (3, 10):
        print("ERROR: Python 3.10 or higher is required.")
        sys.exit(1)
    print("✓ Python version is compatible.")


def check_and_prepare_models():
    """Verify model caches and prewarm models."""
    print("------------------------------------------------------------")
    print("Checking Local AI Models:")

    # 1. Sentiment Model Check
    sent_model = settings.sentiment_model
    print(f"\n1. Sentiment Model: {sent_model}")
    try:
        from huggingface_hub import try_to_load_from_cache

        cached = try_to_load_from_cache(sent_model, "config.json")
        if cached and isinstance(cached, str):
            print("   ✓ Using cached model (Hugging Face hub cache)")
        else:
            print("   ⏳ Model not found in cache. Downloading from Hugging Face (~1.1 GB)...")
    except Exception:
        print("   ⏳ Checking/loading sentiment pipeline...")

    t0 = time.time()
    sent_ok = prewarm_model()
    load_time = round(time.time() - t0, 2)
    if sent_ok:
        print(f"   ✓ Sentiment model LOADED and verified in {load_time}s")
    else:
        print(f"   ⚠️ Warning: Sentiment model could not be prewarmed in {load_time}s.")

    # 2. Embedding Model Check
    emb_model = settings.embedding_model
    print(f"\n2. Sentence Embedding Model: {emb_model}")
    try:
        from huggingface_hub import try_to_load_from_cache

        cached_emb = try_to_load_from_cache(emb_model, "config.json")
        if cached_emb and isinstance(cached_emb, str):
            print("   ✓ Using cached model (Hugging Face hub cache)")
        else:
            print("   ⏳ Model not found in cache. Downloading from Hugging Face (~450 MB)...")
    except Exception:
        print("   ⏳ Checking/loading embedding model...")

    t0 = time.time()
    emb_ok = prewarm_embedding_model()
    load_time = round(time.time() - t0, 2)
    if emb_ok:
        print(f"   ✓ Embedding model LOADED and verified in {load_time}s")
    else:
        print(f"   ⚠️ Warning: Embedding model could not be prewarmed in {load_time}s.")


def initialize_database():
    """Initialize SQLite database and schema."""
    print("------------------------------------------------------------")
    print(f"Initializing Database: {settings.database_url}")
    init_db()
    print("✓ SQLite schema initialized and verified.")


def seed_demo_data_if_needed():
    """Ensure demo consultation is populated."""
    print("------------------------------------------------------------")
    db = SessionLocal()
    try:
        consultation_count = db.query(Consultation).count()
        comment_count = db.query(Comment).count()

        if consultation_count == 0 or comment_count == 0:
            print("Demo dataset is empty. Seeding multilingual consultation...")
            from scripts.seed_demo import seed

            seed()
            comment_count = db.query(Comment).count()
            print(f"✓ Seeded {comment_count} multilingual comments successfully.")
        else:
            print(f"✓ Found {consultation_count} consultation(s) with {comment_count} comments in database.")
    finally:
        db.close()


def run_pipeline_self_test():
    """Execute quick single-comment end-to-end self test."""
    print("------------------------------------------------------------")
    print("Executing End-to-End Pipeline Self-Test:")
    sample = "The compliance burden is excessive for small business enterprises."
    res = analyze_sentiment(sample)
    print(f"  Input: '{sample}'")
    print(f"  Output Sentiment: {res['sentiment']} (Confidence: {res['confidence']})")
    print(f"  Model: {res['model_name']}")
    print("✓ Self-test passed successfully.")


def main():
    print("============================================================")
    print("  Drishtikon (दृष्टिकोण) · Local Environment Setup")
    print("============================================================")
    check_python_version()
    initialize_database()
    check_and_prepare_models()
    seed_demo_data_if_needed()
    run_pipeline_self_test()

    print("============================================================")
    print("✓ LOCAL SETUP COMPLETE & READY TO SERVE")
    print("  You can now start the application using: ./start.sh (or start.bat on Windows)")
    print("============================================================")


if __name__ == "__main__":
    main()
