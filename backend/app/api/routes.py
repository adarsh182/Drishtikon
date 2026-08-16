from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session, joinedload

from app.database.connection import get_db
from app.models.comment import Comment, CommentAnalysis
from app.models.consultation import Consultation, DraftVersion
from app.schemas import (
    CommentListResponse,
    CommentOut,
    ConsultationListItem,
    ConsultationOut,
    DashboardResponse,
    EvidenceResponse,
    HealthResponse,
    IssueDetailOut,
    IssueOut,
    UploadResponse,
    VersionOut,
)
from app.services.analysis_pipeline import process_and_store_comments
from app.services.dashboard_service import get_dashboard
from app.services.evidence_service import get_issue_evidence
from app.services.evolution_service import get_comparison, get_issue_evolution
from app.utils.csv_parser import parse_csv

router = APIRouter()


@router.get("/")
def root():
    return {
        "service": "Drishtikon (दृष्टिकोण) · National Policy Analytics API",
        "status": "running",
        "health": "/health",
        "docs": "/docs",
    }


@router.get("/health", response_model=HealthResponse)
def health():
    return {"status": "ok"}


@router.get("/consultations", response_model=list[ConsultationListItem])
def list_consultations(db: Session = Depends(get_db)):
    consultations = db.query(Consultation).all()
    result = []
    for c in consultations:
        total = db.query(func.count(Comment.id)).filter(Comment.consultation_id == c.id).scalar() or 0
        pos = (
            db.query(func.count(Comment.id))
            .join(CommentAnalysis)
            .filter(Comment.consultation_id == c.id, CommentAnalysis.sentiment == "Positive")
            .scalar()
        ) or 0
        neg = (
            db.query(func.count(Comment.id))
            .join(CommentAnalysis)
            .filter(Comment.consultation_id == c.id, CommentAnalysis.sentiment == "Negative")
            .scalar()
        ) or 0
        top = (
            db.query(CommentAnalysis.issue, func.count(Comment.id))
            .join(Comment, Comment.id == CommentAnalysis.comment_id)
            .filter(Comment.consultation_id == c.id, CommentAnalysis.issue.isnot(None))
            .group_by(CommentAnalysis.issue)
            .order_by(func.count(Comment.id).desc())
            .limit(3)
            .all()
        )
        result.append(ConsultationListItem(
            id=c.id,
            title=c.title,
            status=c.status,
            total_comments=total,
            positive_pct=round(pos / total * 100, 1) if total else 0,
            negative_pct=round(neg / total * 100, 1) if total else 0,
            top_issues=[t[0] for t in top],
        ))
    return result


@router.get("/consultations/{consultation_id}", response_model=ConsultationOut)
def get_consultation(consultation_id: int, db: Session = Depends(get_db)):
    c = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return ConsultationOut(
        id=c.id,
        title=c.title,
        description=c.description,
        status=c.status,
        created_at=c.created_at,
        versions=[VersionOut.model_validate(v) for v in c.versions],
    )


@router.get("/consultations/{consultation_id}/versions", response_model=list[VersionOut])
def get_versions(consultation_id: int, db: Session = Depends(get_db)):
    versions = (
        db.query(DraftVersion)
        .filter(DraftVersion.consultation_id == consultation_id)
        .order_by(DraftVersion.version_number)
        .all()
    )
    return [VersionOut.model_validate(v) for v in versions]


@router.get("/dashboard/{consultation_id}", response_model=DashboardResponse)
def dashboard(consultation_id: int, db: Session = Depends(get_db)):
    data = get_dashboard(db, consultation_id)
    if not data:
        raise HTTPException(status_code=404, detail="Consultation not found")
    return data


@router.get("/comments", response_model=CommentListResponse)
def list_comments(
    consultation_id: int = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    version: str | None = None,
    sentiment: str | None = None,
    section: str | None = None,
    stakeholder: str | None = None,
    issue: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
):
    q = (
        db.query(Comment)
        .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .options(joinedload(Comment.analysis), joinedload(Comment.version))
        .filter(Comment.consultation_id == consultation_id)
    )
    if version:
        q = q.join(DraftVersion, DraftVersion.id == Comment.version_id).filter(DraftVersion.version_number == version)
    if sentiment:
        q = q.filter(CommentAnalysis.sentiment == sentiment)
    if section:
        q = q.filter(Comment.section == section)
    if stakeholder:
        q = q.filter(Comment.stakeholder_type == stakeholder)
    if issue:
        q = q.filter(CommentAnalysis.issue == issue)
    if search:
        q = q.filter(or_(Comment.text.ilike(f"%{search}%"), CommentAnalysis.issue.ilike(f"%{search}%")))

    total = q.count()
    items = q.order_by(Comment.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return CommentListResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=[_comment_to_out(c) for c in items],
    )


@router.get("/comments/{comment_id}", response_model=CommentOut)
def get_comment(comment_id: int, db: Session = Depends(get_db)):
    c = (
        db.query(Comment)
        .options(joinedload(Comment.analysis), joinedload(Comment.version))
        .filter(Comment.id == comment_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")
    return _comment_to_out(c)


@router.get("/issues/{consultation_id}", response_model=list[IssueOut])
def list_issues(consultation_id: int, db: Session = Depends(get_db)):
    from app.services.evolution_service import get_issue_evolution
    from app.services.dashboard_service import calc_priority_full

    evolution_data = get_issue_evolution(db, consultation_id)
    evolution_map = {item["issue"]: item for item in evolution_data}
    
    versions = db.query(DraftVersion).filter(DraftVersion.consultation_id == consultation_id).order_by(DraftVersion.version_number).all()
    version_labels = [v.version_number for v in versions]

    total_stakeholders_in_consult = (
        db.query(func.count(func.distinct(Comment.stakeholder_type)))
        .filter(Comment.consultation_id == consultation_id, Comment.stakeholder_type.isnot(None))
        .scalar() or 1
    )

    total_consult_recent = 0
    if versions:
        n = len(versions)
        weights = [i + 1 for i in range(n)]
        sum_w = sum(weights)
        norm_w = [w / sum_w for w in weights]
        total_consult_recent = sum((v.comment_count or 0) * w for v, w in zip(versions, norm_w))

    rows = (
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
        .all()
    )
    result = []
    for issue, count, neg, sh_count in rows:
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
        result.append(
            IssueOut(
                issue=issue,
                count=count,
                negative_pct=neg_pct,
                priority_score=priority_res["priority_score"],
                priority_level=priority_res["priority_level"],
                evidence_sufficiency=priority_res["evidence_sufficiency"]
            )
        )
    return result


@router.get("/issues/{consultation_id}/{issue_name}", response_model=IssueDetailOut)
def get_issue_detail(consultation_id: int, issue_name: str, db: Session = Depends(get_db)):
    from app.services.dashboard_service import calc_priority_full

    base = (
        db.query(Comment)
        .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .filter(Comment.consultation_id == consultation_id, CommentAnalysis.issue == issue_name)
    )
    total = base.count()
    if total == 0:
        raise HTTPException(status_code=404, detail="Issue not found")

    neg = base.filter(CommentAnalysis.sentiment == "Negative").count()
    pos = base.filter(CommentAnalysis.sentiment == "Positive").count()
    neu = total - neg - pos
    neg_pct = round(neg / total * 100, 1)

    section_rows = (
        db.query(Comment.section, func.count(Comment.id))
        .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .filter(Comment.consultation_id == consultation_id, CommentAnalysis.issue == issue_name, Comment.section.isnot(None))
        .group_by(Comment.section)
        .all()
    )
    stakeholder_rows = (
        db.query(Comment.stakeholder_type, func.count(Comment.id))
        .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .filter(Comment.consultation_id == consultation_id, CommentAnalysis.issue == issue_name, Comment.stakeholder_type.isnot(None))
        .group_by(Comment.stakeholder_type)
        .all()
    )
    issue_stakeholders = len(stakeholder_rows)

    version_rows = (
        db.query(DraftVersion.version_number, func.count(Comment.id))
        .join(Comment, Comment.version_id == DraftVersion.id)
        .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .filter(Comment.consultation_id == consultation_id, CommentAnalysis.issue == issue_name)
        .group_by(DraftVersion.version_number)
        .all()
    )
    version_counts_map = {v: c for v, c in version_rows}

    # Fetch context needed for priority calc
    versions = db.query(DraftVersion).filter(DraftVersion.consultation_id == consultation_id).order_by(DraftVersion.version_number).all()
    version_labels = [v.version_number for v in versions]
    v_counts = [version_counts_map.get(v, 0) for v in version_labels]

    total_stakeholders_in_consult = (
        db.query(func.count(func.distinct(Comment.stakeholder_type)))
        .filter(Comment.consultation_id == consultation_id, Comment.stakeholder_type.isnot(None))
        .scalar() or 1
    )

    total_consult_recent = 0
    if versions:
        n = len(versions)
        weights = [i + 1 for i in range(n)]
        sum_w = sum(weights)
        norm_w = [w / sum_w for w in weights]
        total_consult_recent = sum((v.comment_count or 0) * w for v, w in zip(versions, norm_w))

    priority_res = calc_priority_full(
        v_counts,
        total_consult_recent,
        neg_pct,
        issue_stakeholders,
        total_stakeholders_in_consult
    )

    return IssueDetailOut(
        issue=issue_name,
        count=total,
        negative_pct=neg_pct,
        positive_pct=round(pos / total * 100, 1),
        neutral_pct=round(neu / total * 100, 1),
        priority_score=priority_res["priority_score"],
        priority_level=priority_res["priority_level"],
        evidence_sufficiency=priority_res["evidence_sufficiency"],
        priority_explanation=priority_res["priority_explanation"],
        components=priority_res["components"],
        lifecycle=priority_res["lifecycle"],
        trajectory=priority_res["trajectory"],
        sections=[{"section": s, "count": c} for s, c in section_rows],
        stakeholders=[{"stakeholder": s, "count": c} for s, c in stakeholder_rows],
        version_counts=version_counts_map,
    )


@router.get("/issues/{consultation_id}/{issue_name}/evidence", response_model=EvidenceResponse)
def issue_evidence(
    consultation_id: int,
    issue_name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    data = get_issue_evidence(db, consultation_id, issue_name, limit=page_size, offset=(page - 1) * page_size)
    return EvidenceResponse(
        total=data["total"],
        issue=data["issue"],
        items=[CommentOut(**item) for item in data["items"]],
    )


@router.get("/comparison/{consultation_id}")
def comparison(consultation_id: int, db: Session = Depends(get_db)):
    return get_comparison(db, consultation_id)


@router.get("/stakeholders/{consultation_id}")
def stakeholders(consultation_id: int, db: Session = Depends(get_db)):
    data = get_dashboard(db, consultation_id)
    return {"stakeholders": data.get("stakeholders", []), "sections": data.get("sections", [])}


@router.get("/demo/download")
def download_demo():
    from fastapi.responses import FileResponse
    import os
    path = os.path.join(os.path.dirname(__file__), "..", "..", "static", "mca_econsultation_demo.csv")
    path = os.path.abspath(path)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Demo CSV not yet generated. Run seed script.")
    return FileResponse(path, filename="mca_econsultation_demo.csv", media_type="text/csv")


@router.post("/comments/upload", response_model=UploadResponse)
async def upload_comments(
    file: UploadFile = File(...),
    consultation_id: int | None = None,
    title: str | None = None,
    replace: bool = False,
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a valid CSV file.")

    content = await file.read()
    parsed = parse_csv(content)
    
    # Check if totally invalid (e.g. no comment column, bad format)
    if not parsed.get("valid") and not parsed.get("rows"):
        return UploadResponse(
            success=False,
            message="; ".join(parsed["errors"][:5]) or "Validation failed",
            rows_total=parsed.get("rows_total", 0),
            rows_invalid=parsed.get("rows_invalid", 0),
            rows_processed=0,
            rows_filtered=parsed.get("rows_filtered", 0),
            rows_failed=parsed.get("rows_failed", 0),
            row_errors=parsed.get("row_errors", []),
            warnings=parsed.get("warnings", []),
        )

    if consultation_id:
        consultation = db.query(Consultation).filter(Consultation.id == consultation_id).first()
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")
    else:
        new_title = title.strip() if (title and title.strip()) else f"Uploaded Dataset ({file.filename})"
        consultation = Consultation(
            title=new_title,
            description="Comments uploaded and analyzed via CSV",
            status="active",
        )
        db.add(consultation)
        db.flush()

    if replace and consultation:
        db.query(CommentAnalysis).filter(
            CommentAnalysis.comment_id.in_(
                db.query(Comment.id).filter(Comment.consultation_id == consultation.id)
            )
        ).delete(synchronize_session=False)
        db.query(Comment).filter(Comment.consultation_id == consultation.id).delete()
        db.commit()

    versions = db.query(DraftVersion).filter(DraftVersion.consultation_id == consultation.id).all()
    version_map = {v.version_number: v.id for v in versions}
    for vn in set(r["version"] for r in parsed["rows"]):
        if vn not in version_map:
            dv = DraftVersion(consultation_id=consultation.id, version_number=vn, label=vn)
            db.add(dv)
            db.flush()
            version_map[vn] = dv.id

    import logging
    logger = logging.getLogger(__name__)
    
    try:
        result = process_and_store_comments(db, consultation.id, version_map, parsed["rows"])
    except Exception as e:
        logger.error(f"Error processing comments for consultation {consultation.id}: {str(e)}")
        # Note: If it fails catastrophically despite our try-except block, we return 500
        raise HTTPException(
            status_code=500, 
            detail="A catastrophic error occurred while analyzing the comments. Please try again."
        )

    # Combine errors from parsing (filtered/failed) and processing (DB/NLP failed)
    final_errors = parsed.get("row_errors", []) + result.get("row_errors", [])
    total_processed = result["stored"]
    total_failed = parsed.get("rows_failed", 0) + result.get("failed", 0)
    total_filtered = parsed.get("rows_filtered", 0)

    return UploadResponse(
        success=True,
        message=f"Successfully analyzed {total_processed} comments.",
        rows_total=parsed["rows_total"],
        rows_stored=total_processed,
        rows_invalid=total_failed, # legacy backwards compat
        rows_processed=total_processed,
        rows_filtered=total_filtered,
        rows_failed=total_failed,
        row_errors=final_errors,
        warnings=parsed.get("warnings", []),
        sentiments=result["sentiments"],
        issues_detected=result["issues_detected"],
        consultation_id=consultation.id,
    )


def _comment_to_out(c: Comment) -> CommentOut:
    a = c.analysis
    return CommentOut(
        id=c.id,
        text=c.text,
        section=c.section,
        subsection=c.subsection,
        stakeholder_type=c.stakeholder_type,
        version=c.version.version_number if c.version else None,
        sentiment=a.sentiment if a else None,
        confidence=a.confidence if a else None,
        model_name=a.model_name if a else None,
        issue=a.issue if a else None,
        issue_confidence=a.issue_confidence if a else None,
    )
