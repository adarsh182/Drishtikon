from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    versions: Mapped[list["DraftVersion"]] = relationship(back_populates="consultation", cascade="all, delete-orphan")
    comments: Mapped[list["Comment"]] = relationship(back_populates="consultation", cascade="all, delete-orphan")
    issues: Mapped[list["Issue"]] = relationship(back_populates="consultation", cascade="all, delete-orphan")


class DraftVersion(Base):
    __tablename__ = "draft_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    consultation_id: Mapped[int] = mapped_column(ForeignKey("consultations.id"), index=True)
    version_number: Mapped[str] = mapped_column(String(20), nullable=False)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    consultation: Mapped["Consultation"] = relationship(back_populates="versions")
    comments: Mapped[list["Comment"]] = relationship(back_populates="version")
