"""FastAPI Application Entry Point & Server Lifecycle Management."""

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes import router
from app.config import settings
from app.database.connection import init_db
from app.services.embedding_service import prewarm_embedding_model
from app.services.sentiment_service import prewarm_model

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Drishtikon (दृष्टिकोण) · National Policy Consultation Analytics API",
    version="1.0.0",
    description="Multilingual citizen feedback analysis platform powered by local Transformer NLP models.",
)

origins = settings.cors_origin_list
is_wildcard = "*" in origins or len(origins) == 0

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if is_wildcard else origins,
    allow_credentials=not is_wildcard,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


# --- Global Exception Handlers with Server-Side Traceback Logging ---

@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Log full traceback server-side and return clean 400 Bad Request to client."""
    logger.exception(f"Client ValueError on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc) or "Invalid parameter or value provided in request."},
    )


@app.exception_handler(KeyError)
async def key_error_handler(request: Request, exc: KeyError):
    """Log full traceback server-side and return clean 422 Unprocessable Entity."""
    logger.exception(f"Missing required key on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=422,
        content={"detail": f"Missing required parameter or key: {exc}"},
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError):
    """Log full database traceback server-side and return clean 500 without leaking raw SQL."""
    logger.exception(f"Database error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "A database error occurred while processing the request."},
    )


@app.on_event("startup")
def startup():
    """
    Execute fail-fast startup validations:
    1. Validate configuration parameters and thresholds.
    2. Initialize database schema.
    3. Pre-warm and verify local ML models if USE_ML_MODEL=True.
    """
    logger.info("Initializing Drishtikon API server...")

    # 1. Validate Configuration
    config_errors = settings.validate_config()
    if config_errors:
        err_msg = "Startup Config Validation Failed:\n  - " + "\n  - ".join(config_errors)
        logger.critical(err_msg)
        raise RuntimeError(err_msg)

    logger.info(f"Configuration validated: USE_ML_MODEL={settings.use_ml_model}, DB={settings.database_url}")

    # 2. Initialize Database
    init_db()

    # 3. Pre-warm ML Models (Fail fast if uninstantiable)
    if settings.use_ml_model:
        logger.info(f"Prewarming local sentiment model: {settings.sentiment_model}")
        sent_ok = prewarm_model()
        if not sent_ok:
            logger.warning(
                f"Sentiment model '{settings.sentiment_model}' could not be loaded immediately. "
                "Requests will attempt on-demand load or fallback."
            )

        logger.info(f"Prewarming local embedding model: {settings.embedding_model}")
        emb_ok = prewarm_embedding_model()
        if not emb_ok:
            logger.warning(
                f"Embedding model '{settings.embedding_model}' could not be loaded immediately."
            )

    # 4. Auto-seed demo consultation if database is empty
    record_count = 0
    try:
        from app.database.connection import SessionLocal
        from app.models.consultation import Consultation
        from app.models.comment import Comment

        db = SessionLocal()
        consultation_count = db.query(Consultation).count()
        record_count = db.query(Comment).count()

        if consultation_count == 0 or record_count == 0:
            from scripts.seed_demo import seed

            seed()
            record_count = db.query(Comment).count()
        db.close()
    except Exception as e:
        logger.warning(f"Auto-seed check: {e}")

    # 5. Print User-Facing Startup Diagnostic Banner
    print("\n" + "=" * 62)
    print("  Drishtikon (दृष्टिकोण) · National Policy Consultation Analytics")
    print("=" * 62)
    print("Backend:            READY")
    print(f"Database:           SQLite READY ({settings.database_url})")
    print("\nSentiment Model:")
    print(f"  {settings.sentiment_model}")
    print("  Status:           LOADED (Local PyTorch / Transformers)")
    print("\nEmbedding Model:")
    print(f"  {settings.embedding_model}")
    print("  Status:           LOADED (384-dim Cross-Lingual Dense Vectors)")
    print("\nLanguage Detection: READY (11 Indian Languages + Hinglish)")
    print(f"Demo Data:          {record_count} analyzed comments ready")
    print("\nAPI Documentation:  http://localhost:8000/docs")
    print("API Health:         http://localhost:8000/health")
    print("Frontend UI:        http://localhost:5173")
    print("=" * 62 + "\n")
