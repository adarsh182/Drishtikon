from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings
from app.database.connection import init_db

app = FastAPI(title="Drishtikon (दृष्टिकोण) · Policy Consultation API", version="1.0.0")

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


@app.on_event("startup")
def startup():
    init_db()
    # If consultations table is empty on Render restart, auto-seed demo
    try:
        from app.database.connection import SessionLocal
        from app.models.consultation import Consultation
        from app.models.comment import Comment
        db = SessionLocal()
        consultation_count = db.query(Consultation).count()
        comment_count = db.query(Comment).count()
        db.close()
        
        if consultation_count == 0 or comment_count == 0:
            import threading
            from scripts.seed_demo import seed
            threading.Thread(target=seed, daemon=True).start()
    except Exception:
        pass
