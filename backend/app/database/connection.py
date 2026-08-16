from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


is_sqlite = settings.database_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

# Use conservative connection pooling settings for PostgreSQL/Render to handle stale connections
engine_kwargs = {
    "connect_args": connect_args,
}
if not is_sqlite:
    engine_kwargs.update({
        "pool_pre_ping": True,    # Test connection liveness before checkout
        "pool_recycle": 300,      # Recycle connections older than 5 mins
        "pool_size": 5,           # Conservative pool size for free tier
        "max_overflow": 10,       # Allow burst of connections
    })

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.models import comment, consultation, issue  # noqa: F401

    Base.metadata.create_all(bind=engine)
