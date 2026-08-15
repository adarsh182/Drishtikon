from typing import Any

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.comment import Comment, CommentAnalysis
from app.models.consultation import Consultation, DraftVersion
from app.services.evolution_service import get_issue_evolution


def _sentiment_distribution(db: Session, consultation_id: int, **filters) -> dict[str, Any]:
    q = (
        db.query(CommentAnalysis.sentiment, func.count(Comment.id))
        .join(Comment, Comment.id == CommentAnalysis.comment_id)
        .filter(Comment.consultation_id == consultation_id)
    )
    for key, val in filters.items():
        if val is not None:
            q = q.filter(getattr(Comment, key) == val)
    rows = q.group_by(CommentAnalysis.sentiment).all()
    total = sum(r[1] for r in rows)
    dist = {s: c for s, c in rows}
    return {
        "total": total,
        "positive": dist.get("Positive", 0),
        "negative": dist.get("Negative", 0),
        "neutral": dist.get("Neutral", 0),
        "positive_pct": round(dist.get("Positive", 0) / total * 100, 1) if total else 0,
        "negative_pct": round(dist.get("Negative", 0) / total * 100, 1) if total else 0,
        "neutral_pct": round(dist.get("Neutral", 0) / total * 100, 1) if total else 0,
    }


def get_dashboard(db: Session, consultation_id: int) -> dict[str, Any]:
    consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not consultation:
        return {}

    overall = _sentiment_distribution(db, consultation_id)
    versions = (
        db.query(DraftVersion)
        .filter(DraftVersion.consultation_id == consultation_id)
        .order_by(DraftVersion.version_number)
        .all()
    )

    sentiment_by_version = []
    for v in versions:
        d = _sentiment_distribution(db, consultation_id)
        q = (
            db.query(CommentAnalysis.sentiment, func.count(Comment.id))
            .join(Comment, Comment.id == CommentAnalysis.comment_id)
            .filter(Comment.version_id == v.id)
            .group_by(CommentAnalysis.sentiment)
        )
        rows = q.all()
        total = sum(r[1] for r in rows)
        dist = {s: c for s, c in rows}
        sentiment_by_version.append({
            "version": v.version_number,
            "total": total,
            "positive_pct": round(dist.get("Positive", 0) / total * 100, 1) if total else 0,
            "negative_pct": round(dist.get("Negative", 0) / total * 100, 1) if total else 0,
            "neutral_pct": round(dist.get("Neutral", 0) / total * 100, 1) if total else 0,
        })

    section_rows = (
        db.query(
            Comment.section,
            CommentAnalysis.sentiment,
            func.count(Comment.id),
        )
        .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .filter(Comment.consultation_id == consultation_id, Comment.section.isnot(None))
        .group_by(Comment.section, CommentAnalysis.sentiment)
        .all()
    )
    section_map: dict[str, dict] = {}
    for section, sentiment, count in section_rows:
        if section not in section_map:
            section_map[section] = {"section": section, "total": 0, "positive": 0, "negative": 0, "neutral": 0}
        section_map[section]["total"] += count
        section_map[section][sentiment.lower()] = section_map[section].get(sentiment.lower(), 0) + count
    sections = []
    for s, data in section_map.items():
        t = data["total"]
        sections.append({
            "section": s,
            "total": t,
            "positive_pct": round(data.get("positive", 0) / t * 100, 1) if t else 0,
            "negative_pct": round(data.get("negative", 0) / t * 100, 1) if t else 0,
            "neutral_pct": round(data.get("neutral", 0) / t * 100, 1) if t else 0,
        })

    stakeholder_rows = (
        db.query(
            Comment.stakeholder_type,
            CommentAnalysis.sentiment,
            func.count(Comment.id),
        )
        .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .filter(Comment.consultation_id == consultation_id, Comment.stakeholder_type.isnot(None))
        .group_by(Comment.stakeholder_type, CommentAnalysis.sentiment)
        .all()
    )
    stakeholder_map: dict[str, dict] = {}
    for st, sentiment, count in stakeholder_rows:
        if st not in stakeholder_map:
            stakeholder_map[st] = {"stakeholder": st, "total": 0, "positive": 0, "negative": 0, "neutral": 0}
        stakeholder_map[st]["total"] += count
        stakeholder_map[st][sentiment.lower()] = stakeholder_map[st].get(sentiment.lower(), 0) + count
    stakeholders = []
    for st, data in stakeholder_map.items():
        t = data["total"]
        stakeholders.append({
            "stakeholder": st,
            "total": t,
            "positive_pct": round(data.get("positive", 0) / t * 100, 1) if t else 0,
            "negative_pct": round(data.get("negative", 0) / t * 100, 1) if t else 0,
            "neutral_pct": round(data.get("neutral", 0) / t * 100, 1) if t else 0,
        })

    issue_rows = (
        db.query(
            CommentAnalysis.issue,
            func.count(Comment.id),
            func.sum(case((CommentAnalysis.sentiment == "Negative", 1), else_=0)),
        )
        .join(Comment, Comment.id == CommentAnalysis.comment_id)
        .filter(Comment.consultation_id == consultation_id, CommentAnalysis.issue.isnot(None))
        .group_by(CommentAnalysis.issue)
        .order_by(func.count(Comment.id).desc())
        .limit(10)
        .all()
    )
    top_issues = []
    for issue, count, neg in issue_rows:
        neg_pct = round((neg / count) * 100, 1) if count else 0
        priority = _calc_priority(count, neg_pct, db, consultation_id, issue)
        top_issues.append({
            "issue": issue,
            "count": count,
            "negative_pct": neg_pct,
            "priority": priority,
        })

    evolution_preview = get_issue_evolution(db, consultation_id)[:5]

    return {
        "consultation": {
            "id": consultation.id,
            "title": consultation.title,
            "description": consultation.description,
            "status": consultation.status,
        },
        "kpis": overall,
        "versions": [{"id": v.id, "version_number": v.version_number, "comment_count": v.comment_count} for v in versions],
        "sentiment_by_version": sentiment_by_version,
        "sections": sorted(sections, key=lambda x: -x["total"]),
        "stakeholders": sorted(stakeholders, key=lambda x: -x["total"]),
        "top_issues": top_issues,
        "evolution_preview": evolution_preview,
    }


def _calc_priority(count: int, neg_pct: float, db: Session, consultation_id: int, issue: str) -> str:
    stakeholder_count = (
        db.query(func.count(func.distinct(Comment.stakeholder_type)))
        .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .filter(Comment.consultation_id == consultation_id, CommentAnalysis.issue == issue)
        .scalar()
    ) or 1
    freq_factor = min(count / 100, 3.0)
    neg_factor = neg_pct / 100
    diversity_factor = min(stakeholder_count / 3, 2.0)
    score = freq_factor * neg_factor * diversity_factor
    if score >= 1.5:
        return "High"
    if score >= 0.5:
        return "Medium"
    return "Low"
