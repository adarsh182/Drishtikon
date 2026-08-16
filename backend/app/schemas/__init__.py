from datetime import datetime
from typing import Any

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str


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
