from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    consultation_id: Mapped[int] = mapped_column(ForeignKey("consultations.id"), index=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("draft_versions.id"), index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    section: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    subsection: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stakeholder_type: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    consultation: Mapped["Consultation"] = relationship(back_populates="comments")
    version: Mapped["DraftVersion"] = relationship(back_populates="comments")
    analysis: Mapped["CommentAnalysis | None"] = relationship(back_populates="comment", uselist=False, cascade="all, delete-orphan")


class CommentAnalysis(Base):
    __tablename__ = "comment_analyses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id"), unique=True, index=True)
    sentiment: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    model_name: Mapped[str] = mapped_column(String(200), nullable=False)
    topics: Mapped[str | None] = mapped_column(Text, nullable=True)
    issue: Mapped[str | None] = mapped_column(String(150), index=True, nullable=True)
    issue_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Multilingual & Semantic additions
    detected_language: Mapped[str | None] = mapped_column(String(20), index=True, nullable=True)
    language_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    embedding: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-serialized 384-dim vector
    aspect: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    aspect_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    argument_evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding_model: Mapped[str | None] = mapped_column(String(200), nullable=True)

    comment: Mapped["Comment"] = relationship(back_populates="analysis")

