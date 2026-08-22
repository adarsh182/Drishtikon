from typing import Any

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.config import settings
from app.models.comment import Comment, CommentAnalysis
from app.models.consultation import DraftVersion


"""Policy Evolution & Multi-Version Trajectory Tracking Service.

Architectural Decisions & Rationale:
- Multi-Draft Comparison (v1.0 -> v2.0 -> v3.0): Evaluates whether draft revisions resolved
  stakeholder objections across consultation lifecycle.
- Deterministic Classification:
  - IMPROVED: Negative complaints dropped by >= evolution_improved_drop_pct (default 40%).
  - EMERGING: Issues with rapid growth (>= evolution_emerging_min_growth_pct, default 100%) or newly introduced in later versions.
  - WORSENED: Issues with substantial complaint growth (>= evolution_worsened_min_growth_pct, default 50%).
  - PERSISTENT: Issues remaining active without resolution (|growth| <= evolution_persistent_max_change_pct, default 25%).
"""

def classify_lifecycle(v1_count: int, v2_count: int, v3_count: int) -> str:
    """Deterministic lifecycle classification from version counts using configured thresholds."""
    counts = [v1_count, v2_count, v3_count]
    total = sum(counts)
    if total == 0:
        return "PERSISTENT"

    v1, v3 = counts[0], counts[2]
    if v1 == 0 and v3 > 0:
        return "EMERGING"

    if v1 > 0:
        drop_pct = ((v1 - v3) / v1) * 100 if v1 else 0
        growth_v1_v3 = ((v3 - v1) / v1) * 100 if v1 else 0
        growth_v1_v2 = ((v2_count - v1) / v1) * 100 if v1 else 0

        if drop_pct >= settings.evolution_improved_drop_pct and v3 < v2_count <= v1:
            return "IMPROVED"
        if v1 <= counts[1] * 0.3 and growth_v1_v3 >= settings.evolution_emerging_min_growth_pct:
            return "EMERGING"
        if growth_v1_v3 >= settings.evolution_worsened_min_growth_pct and v1 > 20:
            return "WORSENED"
        if abs(growth_v1_v3) <= settings.evolution_persistent_max_change_pct and total >= 30:
            return "PERSISTENT"
        if drop_pct >= (settings.evolution_improved_drop_pct / 2.0):
            return "IMPROVED"
        if growth_v1_v2 >= settings.evolution_worsened_min_growth_pct or growth_v1_v3 >= settings.evolution_worsened_min_growth_pct:
            return "EMERGING" if v1 < 50 else "WORSENED"

    return "PERSISTENT"


def get_issue_evolution(db: Session, consultation_id: int) -> list[dict[str, Any]]:
    versions = (
        db.query(DraftVersion)
        .filter(DraftVersion.consultation_id == consultation_id)
        .order_by(DraftVersion.version_number)
        .all()
    )
    version_map = {v.id: v.version_number for v in versions}

    rows = (
        db.query(
            CommentAnalysis.issue,
            Comment.version_id,
            func.count(Comment.id).label("count"),
            func.sum(case((CommentAnalysis.sentiment == "Negative", 1), else_=0)).label("neg"),
        )
        .join(Comment, Comment.id == CommentAnalysis.comment_id)
        .filter(Comment.consultation_id == consultation_id, CommentAnalysis.issue.isnot(None))
        .group_by(CommentAnalysis.issue, Comment.version_id)
        .all()
    )

    issue_data: dict[str, dict[str, Any]] = {}
    for issue, version_id, count, neg in rows:
        if issue not in issue_data:
            issue_data[issue] = {"issue": issue, "versions": {}, "total": 0}
        vn = version_map.get(version_id, "unknown")
        neg_pct = round((neg / count) * 100, 1) if count else 0
        issue_data[issue]["versions"][vn] = {"count": count, "negative_pct": neg_pct}
        issue_data[issue]["total"] += count

    result = []
    version_labels = [v.version_number for v in versions]
    for issue, data in sorted(issue_data.items(), key=lambda x: -x[1]["total"]):
        counts = [data["versions"].get(v, {}).get("count", 0) for v in version_labels]
        while len(counts) < 3:
            counts.append(0)
        status = classify_lifecycle(counts[0], counts[1] if len(counts) > 1 else 0, counts[2] if len(counts) > 2 else 0)
        change_pct = 0.0
        if counts[0] > 0:
            change_pct = round(((counts[-1] - counts[0]) / counts[0]) * 100, 1)
        result.append({
            "issue": issue,
            "version_counts": {v: data["versions"].get(v, {}).get("count", 0) for v in version_labels},
            "version_negative_pct": {v: data["versions"].get(v, {}).get("negative_pct", 0) for v in version_labels},
            "total": data["total"],
            "change_pct": change_pct,
            "status": status,
        })
    return result


def get_comparison(db: Session, consultation_id: int) -> dict[str, Any]:
    versions = (
        db.query(DraftVersion)
        .filter(DraftVersion.consultation_id == consultation_id)
        .order_by(DraftVersion.version_number)
        .all()
    )
    sentiment_by_version = []
    for v in versions:
        total = (
            db.query(func.count(Comment.id))
            .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
            .filter(Comment.version_id == v.id)
            .scalar()
        ) or 0
        if total == 0:
            sentiment_by_version.append({
                "version": v.version_number,
                "total": 0,
                "positive_pct": 0,
                "negative_pct": 0,
                "neutral_pct": 0,
            })
            continue
        pos = db.query(func.count(Comment.id)).join(CommentAnalysis).filter(
            Comment.version_id == v.id, CommentAnalysis.sentiment == "Positive"
        ).scalar() or 0
        neg = db.query(func.count(Comment.id)).join(CommentAnalysis).filter(
            Comment.version_id == v.id, CommentAnalysis.sentiment == "Negative"
        ).scalar() or 0
        neu = total - pos - neg
        sentiment_by_version.append({
            "version": v.version_number,
            "total": total,
            "positive_pct": round(pos / total * 100, 1),
            "negative_pct": round(neg / total * 100, 1),
            "neutral_pct": round(neu / total * 100, 1),
        })

    return {
        "sentiment_by_version": sentiment_by_version,
        "issue_evolution": get_issue_evolution(db, consultation_id),
    }
