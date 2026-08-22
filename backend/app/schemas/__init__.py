from datetime import datetime
from typing import Any

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    database: str = "connected"
    sentiment_model_loaded: bool = False
    embedding_model_loaded: bool = False
    sentiment_model: str = ""
    embedding_model: str = ""
    inference_mode: str = "Local Analysis Mode (PyTorch / Transformers)"
    ready: bool = True


class VersionOut(BaseModel):
    id: int
    version_number: str
    label: str | None = None
    comment_count: int

    class Config:
        from_attributes = True


class ConsultationOut(BaseModel):
    id: int
    title: str
    description: str | None = None
    status: str
    created_at: datetime | None = None
    versions: list[VersionOut] = []

    class Config:
        from_attributes = True


class ConsultationListItem(BaseModel):
    id: int
    title: str
    status: str
    total_comments: int = 0
    positive_pct: float = 0
    negative_pct: float = 0
    top_issues: list[str] = []


class CommentOut(BaseModel):
    id: int
    text: str
    section: str | None = None
    subsection: str | None = None
    stakeholder_type: str | None = None
    version: str | None = None
    sentiment: str | None = None
    confidence: float | None = None
    model_name: str | None = None
    issue: str | None = None
    issue_confidence: float | None = None
    detected_language: str | None = None
    language_confidence: float | None = None
    aspect: str | None = None
    aspect_confidence: float | None = None
    argument_evidence: str | None = None


class SimilarCommentOut(BaseModel):
    comment_id: int
    similarity_score: float
    text: str
    version: str | None = None
    sentiment: str | None = None
    issue: str | None = None
    detected_language: str | None = None
    stakeholder_type: str | None = None


class DuplicateGroupOut(BaseModel):
    group_id: int
    duplicate_type: str  # "exact" or "near"
    similarity_score: float
    representative_text: str
    comment_count: int
    comments: list[SimilarCommentOut]


class LanguageStatOut(BaseModel):
    language: str
    code: str
    count: int
    percentage: float
    positive_pct: float
    negative_pct: float
    neutral_pct: float


class SystemInfoOut(BaseModel):
    sentiment_model: str
    embedding_model: str
    language_detection: str
    inference_mode: str
    languages_tested: list[str]
    similarity_threshold: float
    duplicate_threshold: float
    issue_similarity_threshold: float



class CommentListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[CommentOut]


class PriorityComponents(BaseModel):
    magnitude: float
    negativity: float
    stakeholder_breadth: float
    evolution: float

class IssueOut(BaseModel):
    issue: str
    count: int
    negative_pct: float
    priority_score: float
    priority_level: str
    evidence_sufficiency: str


class IssueDetailOut(BaseModel):
    issue: str
    count: int
    negative_pct: float
    positive_pct: float
    neutral_pct: float
    priority_score: float
    priority_level: str
    evidence_sufficiency: str
    priority_explanation: str
    components: PriorityComponents
    lifecycle: str
    trajectory: str
    sections: list[dict[str, Any]]
    stakeholders: list[dict[str, Any]]
    version_counts: dict[str, int]


class EvidenceResponse(BaseModel):
    total: int
    issue: str
    items: list[CommentOut]


class UploadResponse(BaseModel):
    success: bool
    message: str
    rows_total: int = 0
    rows_stored: int = 0
    rows_invalid: int = 0
    rows_processed: int = 0
    rows_filtered: int = 0
    rows_failed: int = 0
    row_errors: list[dict[str, Any]] = []
    warnings: list[str] = []
    sentiments: dict[str, int] = {}
    issues_detected: list[str] = []
    consultation_id: int | None = None

class DashboardResponse(BaseModel):
    consultation: dict[str, Any]
    kpis: dict[str, Any]
    versions: list[dict[str, Any]]
    sentiment_by_version: list[dict[str, Any]]
    sections: list[dict[str, Any]]
    stakeholders: list[dict[str, Any]]
    top_issues: list[dict[str, Any]]
    evolution_preview: list[dict[str, Any]]
