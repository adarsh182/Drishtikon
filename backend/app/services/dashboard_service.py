import math
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

    from app.services.evolution_service import get_issue_evolution
    evolution_data = get_issue_evolution(db, consultation_id)
    evolution_map = {item["issue"]: item for item in evolution_data}
    evolution_preview = evolution_data[:5]

    total_stakeholders_in_consult = len(stakeholders)
    
    # Calculate recent weighted volume for the entire consultation to use as baseline
    total_consult_recent = 0
    if versions:
        n = len(versions)
        weights = [i + 1 for i in range(n)]
        sum_w = sum(weights)
        norm_w = [w / sum_w for w in weights]
        total_consult_recent = sum(v.comment_count * w for v, w in zip(versions, norm_w))

    issue_rows = (
        db.query(
            CommentAnalysis.issue,
            func.count(Comment.id),
            func.sum(case((CommentAnalysis.sentiment == "Negative", 1), else_=0)),
            func.count(func.distinct(Comment.stakeholder_type))
        )
        .join(Comment, Comment.id == CommentAnalysis.comment_id)
        .filter(Comment.consultation_id == consultation_id, CommentAnalysis.issue.isnot(None))
        .group_by(CommentAnalysis.issue)
        .order_by(func.count(Comment.id).desc())
        .limit(10)
        .all()
    )
    top_issues = []
    version_labels = [v.version_number for v in versions]
    for issue, count, neg, sh_count in issue_rows:
        neg_pct = round((neg / count) * 100, 1) if count else 0
        
        evo = evolution_map.get(issue)
        if evo:
            v_counts = [evo["version_counts"].get(v, 0) for v in version_labels]
        else:
            v_counts = [count]

        priority_res = calc_priority_full(
            v_counts,
            total_consult_recent,
            neg_pct,
            sh_count,
            total_stakeholders_in_consult
        )
        top_issues.append({
            "issue": issue,
            "count": count,
            "negative_pct": neg_pct,
            "priority_score": priority_res["priority_score"],
            "priority_level": priority_res["priority_level"],
            "evidence_sufficiency": priority_res["evidence_sufficiency"],
        })

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


def _calc_magnitude(version_counts: list[int], total_recent_volume: int) -> float:
    n = len(version_counts)
    if n == 0:
        return 0.0
    weights = [i + 1 for i in range(n)]
    sum_w = sum(weights)
    norm_w = [w / sum_w for w in weights]
    recent_weighted_count = sum(c * w for c, w in zip(version_counts, norm_w))
    issue_share = recent_weighted_count / max(total_recent_volume, 1)
    return min(100.0, (issue_share / 0.10) ** 0.5 * 100.0)


def _calc_evolution(version_counts: list[int]) -> tuple[float, str, str]:
    n = len(version_counts)
    if n <= 1:
        return 50.0, "STABLE", "PERSISTENT"

    w = [i + 1 for i in range(n)]
    x = list(range(n))
    sum_w = sum(w)
    x_mean = sum(x[i] * w[i] for i in range(n)) / sum_w
    y_mean = sum(version_counts[i] * w[i] for i in range(n)) / sum_w

    num = sum(w[i] * (x[i] - x_mean) * (version_counts[i] - y_mean) for i in range(n))
    den = sum(w[i] * (x[i] - x_mean) ** 2 for i in range(n))
    slope = num / den if den != 0 else 0.0

    trend_factor = math.tanh(slope / 100.0)
    evolution_score = max(0.0, min(100.0, 50.0 + trend_factor * 50.0))

    overall_diff = version_counts[-1] - version_counts[0]
    abs_diffs = sum(abs(version_counts[i] - version_counts[i - 1]) for i in range(1, n))

    consistency = abs(overall_diff) / max(abs_diffs, 1) if abs_diffs > 0 else 1.0

    if consistency < 0.5 and abs_diffs > 0:
        trajectory = "VOLATILE / RECOVERY" if version_counts[-1] > version_counts[-2] else "VOLATILE"
    elif 45 <= evolution_score <= 55:
        trajectory = "STABLE"
    elif evolution_score > 55:
        trajectory = "GROWING"
    else:
        trajectory = "DECLINING"

    # Minimal lifecycle mapping purely for backwards compatibility if needed, though trajectory is better
    if trajectory == "STABLE":
        lifecycle = "PERSISTENT"
    elif trajectory == "GROWING":
        lifecycle = "EMERGING" if version_counts[0] < 50 else "WORSENED"
    elif trajectory in ("VOLATILE", "VOLATILE / RECOVERY"):
        lifecycle = "PERSISTENT"
    else:
        lifecycle = "IMPROVED"

    return evolution_score, trajectory, lifecycle


def calc_priority_full(
    version_counts: list[int],
    total_consultation_recent: int,
    neg_pct: float,
    issue_stakeholders: int,
    total_stakeholders: int,
) -> dict:
    magnitude = _calc_magnitude(version_counts, total_consultation_recent)
    negativity = neg_pct
    diversity = (issue_stakeholders / max(total_stakeholders, 1)) * 100.0
    
    evolution, trajectory, lifecycle = _calc_evolution(version_counts)

    priority_score = (
        0.30 * magnitude
        + 0.30 * negativity
        + 0.20 * diversity
        + 0.20 * evolution
    )

    if priority_score >= 70:
        priority_level = "HIGH"
    elif priority_score >= 40:
        priority_level = "MEDIUM"
    else:
        priority_level = "LOW"
        
    total_issue_count = sum(version_counts)
    if total_issue_count < 10:
        evidence_sufficiency = "INSUFFICIENT"
    elif total_issue_count < 30:
        evidence_sufficiency = "LIMITED"
    else:
        evidence_sufficiency = "SUFFICIENT"
        
    # Generate explanation
    reasons = []
    if magnitude > 70: reasons.append("affects a substantial share of submissions")
    elif magnitude > 40: reasons.append("affects a moderate share of submissions")
    if negativity > 70: reasons.append("has predominantly negative feedback")
    if diversity > 70: reasons.append("is raised across multiple stakeholder groups")
    if evolution > 65: reasons.append("has increased across recent drafts")
    elif evolution < 35: reasons.append("has decreased across recent drafts")
    
    explanation = f"{priority_level.capitalize()} priority because the concern "
    if reasons:
        if len(reasons) > 1:
            explanation += ", ".join(reasons[:-1]) + f", and {reasons[-1]}."
        else:
            explanation += reasons[0] + "."
    else:
        explanation += "has a balanced mix of volume, sentiment, and trajectory."

    return {
        "priority_score": round(priority_score, 1),
        "priority_level": priority_level,
        "evidence_sufficiency": evidence_sufficiency,
        "priority_explanation": explanation,
        "lifecycle": lifecycle,
        "trajectory": trajectory,
        "components": {
            "magnitude": round(magnitude, 1),
            "negativity": round(negativity, 1),
            "stakeholder_breadth": round(diversity, 1),
            "evolution": round(evolution, 1),
        }
    }
