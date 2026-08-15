from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.models.comment import Comment, CommentAnalysis
from app.models.consultation import DraftVersion


def get_issue_evidence(
    db: Session,
    consultation_id: int,
    issue_name: str,
    limit: int = 20,
    offset: int = 0,
) -> dict[str, Any]:
    query = (
        db.query(Comment)
        .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .options(joinedload(Comment.analysis), joinedload(Comment.version))
        .filter(Comment.consultation_id == consultation_id, CommentAnalysis.issue == issue_name)
        .order_by(CommentAnalysis.confidence.desc())
    )
    total = query.count()
    comments = query.offset(offset).limit(limit).all()

    items = []
    for c in comments:
        a = c.analysis
        items.append({
            "id": c.id,
            "text": c.text,
            "sentiment": a.sentiment if a else None,
            "confidence": a.confidence if a else None,
            "version": c.version.version_number if c.version else None,
            "section": c.section,
            "stakeholder_type": c.stakeholder_type,
            "issue": a.issue if a else None,
        })
    return {"total": total, "items": items, "issue": issue_name}
