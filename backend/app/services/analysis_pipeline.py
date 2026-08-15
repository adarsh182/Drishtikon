from typing import Any

from sqlalchemy.orm import Session

from app.models.comment import Comment, CommentAnalysis
from app.models.consultation import DraftVersion
from app.services.issue_service import detect_issue
from app.services.sentiment_service import analyze_sentiment


def analyze_comment_text(text: str) -> dict[str, Any]:
    sentiment = analyze_sentiment(text)
    issue = detect_issue(text)
    return {**sentiment, **issue}


def process_and_store_comments(
    db: Session,
    consultation_id: int,
    version_map: dict[str, int],
    rows: list[dict[str, Any]],
    batch_size: int = 100,
) -> dict[str, Any]:
    stored = 0
    sentiments = {"Positive": 0, "Negative": 0, "Neutral": 0}
    issues_detected: set[str] = set()

    batch_comments: list[Comment] = []
    batch_analyses: list[tuple[Comment, dict]] = []

    for row in rows:
        version_key = row.get("version", "v1.0")
        version_id = version_map.get(version_key)
        if not version_id:
            continue

        analysis_result = analyze_comment_text(row["comment"])
        comment = Comment(
            consultation_id=consultation_id,
            version_id=version_id,
            text=row["comment"],
            section=row.get("section"),
            subsection=row.get("subsection"),
            stakeholder_type=row.get("stakeholder") or row.get("stakeholder_type"),
        )
        batch_comments.append(comment)
        batch_analyses.append((comment, analysis_result))

        if len(batch_comments) >= batch_size:
            _flush_batch(db, batch_comments, batch_analyses, sentiments, issues_detected)
            stored += len(batch_comments)
            batch_comments = []
            batch_analyses = []

    if batch_comments:
        _flush_batch(db, batch_comments, batch_analyses, sentiments, issues_detected)
        stored += len(batch_comments)

    db.commit()

    for vn, vid in version_map.items():
        count = db.query(Comment).filter(Comment.version_id == vid).count()
        db.query(DraftVersion).filter(DraftVersion.id == vid).update({"comment_count": count})
    db.commit()

    return {
        "stored": stored,
        "sentiments": sentiments,
        "issues_detected": list(issues_detected),
    }


def _flush_batch(
    db: Session,
    comments: list[Comment],
    analyses: list[tuple[Comment, dict]],
    sentiments: dict[str, int],
    issues_detected: set[str],
) -> None:
    db.add_all(comments)
    db.flush()
    for comment, result in analyses:
        sentiments[result["sentiment"]] = sentiments.get(result["sentiment"], 0) + 1
        if result.get("issue"):
            issues_detected.add(result["issue"])
        db.add(CommentAnalysis(
            comment_id=comment.id,
            sentiment=result["sentiment"],
            confidence=result["confidence"],
            model_name=result["model_name"],
            topics=result.get("topics"),
            issue=result.get("issue"),
            issue_confidence=result.get("issue_confidence"),
        ))
