import logging
from typing import Any

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.comment import Comment, CommentAnalysis
from app.models.consultation import DraftVersion
from app.services.issue_service import detect_issue
from app.services.sentiment_service import analyze_sentiment

logger = logging.getLogger(__name__)


def analyze_comment_text(text: str) -> dict[str, Any]:
    try:
        sentiment = analyze_sentiment(text)
        issue = detect_issue(text)
        return {**sentiment, **issue}
    except Exception as e:
        logger.error(f"NLP failure: {str(e)}")
        return {
            "sentiment": "Neutral",
            "confidence": 0.5,
            "model_name": "error-fallback",
            "topics": None,
            "issue": "General Feedback",
            "issue_confidence": 0.5,
        }


def process_and_store_comments(
    db: Session,
    consultation_id: int,
    version_map: dict[str, int],
    rows: list[dict[str, Any]],
    batch_size: int = 100,
) -> dict[str, Any]:
    stored = 0
    failed_rows = 0
    row_errors = []
    sentiments = {"Positive": 0, "Negative": 0, "Neutral": 0}
    issues_detected: set[str] = set()

    batch_items = []

    def flush_current_batch():
        nonlocal stored, failed_rows
        if not batch_items:
            return

        # Try to flush the entire batch
        try:
            with db.begin_nested():
                for item in batch_items:
                    db.add(item["comment"])
                db.flush()
                
                for item in batch_items:
                    result = item["analysis"]
                    sentiments[result["sentiment"]] = sentiments.get(result["sentiment"], 0) + 1
                    if result.get("issue"):
                        issues_detected.add(result["issue"])
                    db.add(CommentAnalysis(
                        comment_id=item["comment"].id,
                        sentiment=result["sentiment"],
                        confidence=result["confidence"],
                        model_name=result["model_name"],
                        topics=result.get("topics"),
                        issue=result.get("issue"),
                        issue_confidence=result.get("issue_confidence"),
                    ))
                db.flush()
            stored += len(batch_items)
            return
        except SQLAlchemyError as batch_err:
            logger.warning(f"Batch insert failed, falling back to row-by-row: {str(batch_err)}")
        
        # Fallback to row-by-row if batch failed
        for item in batch_items:
            try:
                with db.begin_nested():
                    db.add(item["comment"])
                    db.flush()
                    result = item["analysis"]
                    sentiments[result["sentiment"]] = sentiments.get(result["sentiment"], 0) + 1
                    if result.get("issue"):
                        issues_detected.add(result["issue"])
                    db.add(CommentAnalysis(
                        comment_id=item["comment"].id,
                        sentiment=result["sentiment"],
                        confidence=result["confidence"],
                        model_name=result["model_name"],
                        topics=result.get("topics"),
                        issue=result.get("issue"),
                        issue_confidence=result.get("issue_confidence"),
                    ))
                    db.flush()
                stored += 1
            except Exception as row_err:
                failed_rows += 1
                row_errors.append({
                    "row_number": item["row_number"],
                    "status": "FAILED",
                    "reason": f"Database insertion failed: {str(row_err)}"
                })

    for row in rows:
        version_key = row.get("version", "v1.0")
        version_id = version_map.get(version_key)
        if not version_id:
            failed_rows += 1
            row_errors.append({
                "row_number": row.get("row_number", -1),
                "status": "FAILED", 
                "reason": f"Version '{version_key}' mapping failed."
            })
            continue

        try:
            analysis_result = analyze_comment_text(row["comment"])
            comment = Comment(
                consultation_id=consultation_id,
                version_id=version_id,
                text=row["comment"],
                section=row.get("section"),
                subsection=row.get("subsection"),
                stakeholder_type=row.get("stakeholder") or row.get("stakeholder_type"),
            )
            batch_items.append({
                "comment": comment, 
                "analysis": analysis_result,
                "row_number": row.get("row_number", -1)
            })
        except Exception as e:
            failed_rows += 1
            row_errors.append({
                "row_number": row.get("row_number", -1),
                "status": "FAILED",
                "reason": f"NLP/Preparation failed: {str(e)}"
            })

        if len(batch_items) >= batch_size:
            flush_current_batch()
            batch_items = []

    if batch_items:
        flush_current_batch()

    db.commit()

    for vn, vid in version_map.items():
        count = db.query(Comment).filter(Comment.version_id == vid).count()
        db.query(DraftVersion).filter(DraftVersion.id == vid).update({"comment_count": count})
    db.commit()

    return {
        "stored": stored,
        "failed": failed_rows,
        "row_errors": row_errors,
        "sentiments": sentiments,
        "issues_detected": list(issues_detected),
    }
