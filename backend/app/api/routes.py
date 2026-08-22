from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database.connection import get_db
from app.models.comment import Comment, CommentAnalysis
from app.models.consultation import Consultation, DraftVersion
from app.schemas import (
    CommentListResponse,
    CommentOut,
    ConsultationListItem,
    ConsultationOut,
    DashboardResponse,
    DuplicateGroupOut,
    EvidenceResponse,
    HealthResponse,
    IssueDetailOut,
    IssueOut,
    LanguageStatOut,
    SimilarCommentOut,
    SystemInfoOut,
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
def health(db: Session = Depends(get_db)):
    """
    Comprehensive health probe for load balancers and system monitoring.
    Verifies database connectivity and local PyTorch model readiness.
    """
    from sqlalchemy import text
    from app.services.sentiment_service import is_model_loaded as is_sentiment_model_loaded
    from app.services.embedding_service import is_embedding_model_loaded

    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Health check database probe failed: {e}")
        db_status = "error"

    sent_loaded = is_sentiment_model_loaded()
    emb_loaded = is_embedding_model_loaded()

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        database=db_status,
        sentiment_model_loaded=sent_loaded,
        embedding_model_loaded=emb_loaded,
        sentiment_model=settings.sentiment_model,
        embedding_model=settings.embedding_model,
        inference_mode="Local Analysis Mode (PyTorch / Transformers)" if settings.use_ml_model else "Deployed Static Mode",
        ready=db_status == "connected",
    )


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
    language: str | None = None,
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
    if language:
        q = q.filter(CommentAnalysis.detected_language == language)
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



@router.get("/comments/duplicates", response_model=list[DuplicateGroupOut])
def get_duplicate_comments(
    consultation_id: int = Query(...),
    threshold: float = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Detect exact and near-duplicate comments efficiently without naive O(n^2).
    1. Exact duplicate check via text grouping.
    2. Near-duplicate candidates via sentence embeddings above duplicate_threshold.
    """
    from app.services.embedding_service import deserialize_embedding, cosine_similarity
    from app.config import settings

    actual_threshold = threshold if threshold is not None else settings.duplicate_threshold

    all_comments = (
        db.query(Comment)
        .options(joinedload(Comment.analysis), joinedload(Comment.version))
        .filter(Comment.consultation_id == consultation_id)
        .order_by(Comment.id.asc())
        .all()
    )

    if not all_comments:
        return []

    groups: list[DuplicateGroupOut] = []
    group_counter = 1
    handled_comment_ids = set()

    # Step 1: Exact Duplicates via normalized text mapping
    exact_text_map: dict[str, list[Comment]] = {}
    for c in all_comments:
        norm_txt = c.text.strip().lower()
        exact_text_map.setdefault(norm_txt, []).append(c)

    for norm_txt, c_list in exact_text_map.items():
        if len(c_list) > 1:
            for c in c_list:
                handled_comment_ids.add(c.id)

            comments_out = [
                SimilarCommentOut(
                    comment_id=c.id,
                    similarity_score=1.0,
                    text=c.text,
                    version=c.version.version_number if c.version else None,
                    sentiment=c.analysis.sentiment if c.analysis else None,
                    issue=c.analysis.issue if c.analysis else None,
                    detected_language=c.analysis.detected_language if c.analysis else None,
                    stakeholder_type=c.stakeholder_type,
                )
                for c in c_list
            ]
            groups.append(DuplicateGroupOut(
                group_id=group_counter,
                duplicate_type="exact",
                similarity_score=1.0,
                representative_text=c_list[0].text,
                comment_count=len(c_list),
                comments=comments_out,
            ))
            group_counter += 1
            if len(groups) >= limit:
                return groups

    # Step 2: Near-duplicate candidates among remaining comments using embeddings
    remaining = [c for c in all_comments if c.id not in handled_comment_ids and c.analysis and c.analysis.embedding]
    if len(remaining) > 1 and len(groups) < limit:
        vectors = [(c, deserialize_embedding(c.analysis.embedding)) for c in remaining]
        vectors = [v for v in vectors if v[1] is not None]

        used_in_near = set()
        for i in range(len(vectors)):
            c_i, vec_i = vectors[i]
            if c_i.id in used_in_near:
                continue

            near_matches = [c_i]
            for j in range(i + 1, min(len(vectors), i + 50)):  # Windowed candidate comparison for scalability
                c_j, vec_j = vectors[j]
                if c_j.id in used_in_near:
                    continue
                sim = cosine_similarity(vec_i, vec_j)
                if sim >= actual_threshold:
                    near_matches.append(c_j)
                    used_in_near.add(c_j.id)

            if len(near_matches) > 1:
                used_in_near.add(c_i.id)
                comments_out = [
                    SimilarCommentOut(
                        comment_id=c.id,
                        similarity_score=round(cosine_similarity(vec_i, deserialize_embedding(c.analysis.embedding) or vec_i), 4),
                        text=c.text,
                        version=c.version.version_number if c.version else None,
                        sentiment=c.analysis.sentiment if c.analysis else None,
                        issue=c.analysis.issue if c.analysis else None,
                        detected_language=c.analysis.detected_language if c.analysis else None,
                        stakeholder_type=c.stakeholder_type,
                    )
                    for c in near_matches
                ]
                groups.append(DuplicateGroupOut(
                    group_id=group_counter,
                    duplicate_type="near",
                    similarity_score=actual_threshold,
                    representative_text=c_i.text,
                    comment_count=len(near_matches),
                    comments=comments_out,
                ))
                group_counter += 1
                if len(groups) >= limit:
                    break

    return groups


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

    if not settings.use_ml_model:
        raise HTTPException(
            status_code=503,
            detail="Live multilingual model analysis is available in Local Analysis Mode. The deployed demo operates on pre-analyzed consultation datasets stored in Supabase."
        )

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
        rows_invalid=total_failed,
        rows_processed=total_processed,
        rows_filtered=total_filtered,
        rows_failed=total_failed,
        row_errors=final_errors,
        warnings=parsed.get("warnings", []),
        sentiments=result["sentiments"],
        issues_detected=result["issues_detected"],
        consultation_id=consultation.id,
    )


@router.get("/comments/{comment_id}/similar", response_model=list[SimilarCommentOut])
def get_similar_comments(
    comment_id: int,
    threshold: float = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Retrieve semantically similar comments using multilingual sentence embeddings."""
    from app.services.embedding_service import deserialize_embedding, find_similar, generate_embedding
    from app.config import settings

    actual_threshold = threshold if threshold is not None else settings.similarity_threshold

    target_comment = (
        db.query(Comment)
        .options(joinedload(Comment.analysis))
        .filter(Comment.id == comment_id)
        .first()
    )
    if not target_comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    target_analysis = target_comment.analysis
    target_embedding = deserialize_embedding(target_analysis.embedding) if target_analysis else None
    if not target_embedding and target_comment.text:
        target_embedding = generate_embedding(target_comment.text)

    if not target_embedding:
        return []

    # Fetch candidate comments from same consultation
    candidates_db = (
        db.query(Comment)
        .options(joinedload(Comment.analysis), joinedload(Comment.version))
        .join(CommentAnalysis, CommentAnalysis.comment_id == Comment.id)
        .filter(
            Comment.consultation_id == target_comment.consultation_id,
            Comment.id != comment_id,
            CommentAnalysis.embedding.isnot(None),
        )
        .all()
    )

    candidate_vectors = []
    comment_map = {}
    for c in candidates_db:
        emb = deserialize_embedding(c.analysis.embedding)
        if emb:
            candidate_vectors.append((c.id, emb))
            comment_map[c.id] = c

    matches = find_similar(target_embedding, candidate_vectors, threshold=actual_threshold, top_k=limit)

    results = []
    for cid, score in matches:
        c = comment_map.get(cid)
        if c:
            a = c.analysis
            results.append(SimilarCommentOut(
                comment_id=c.id,
                similarity_score=score,
                text=c.text,
                version=c.version.version_number if c.version else None,
                sentiment=a.sentiment if a else None,
                issue=a.issue if a else None,
                detected_language=a.detected_language if a else None,
                stakeholder_type=c.stakeholder_type,
            ))

    return results


@router.get("/dashboard/{consultation_id}/languages", response_model=list[LanguageStatOut])
def get_language_statistics(consultation_id: int, db: Session = Depends(get_db)):
    """Retrieve language breakdown and sentiment by language from real database records."""
    LANG_NAMES = {
        "en": "English",
        "hi": "Hindi (हिन्दी)",
        "mr": "Marathi (मराठी)",
        "gu": "Gujarati (ગુજરાતી)",
        "bn": "Bengali (বাংলা)",
        "ta": "Tamil (தமிழ்)",
        "te": "Telugu (తెలుగు)",
        "kn": "Kannada (ಕನ್ನಡ)",
        "ml": "Malayalam (മലയാളം)",
        "pa": "Punjabi (ਪੰਜਾਬੀ)",
        "mixed": "Hinglish / Code-Mixed",
        "unknown": "Unspecified",
    }

    rows = (
        db.query(
            CommentAnalysis.detected_language,
            CommentAnalysis.sentiment,
            func.count(Comment.id)
        )
        .join(Comment, Comment.id == CommentAnalysis.comment_id)
        .filter(Comment.consultation_id == consultation_id)
        .group_by(CommentAnalysis.detected_language, CommentAnalysis.sentiment)
        .all()
    )

    total_comments = sum(r[2] for r in rows) or 1
    lang_map: dict[str, dict[str, Any]] = {}

    for lang_code, sentiment, count in rows:
        code = lang_code or "unknown"
        if code not in lang_map:
            lang_map[code] = {"count": 0, "pos": 0, "neg": 0, "neu": 0}
        lang_map[code]["count"] += count
        if sentiment == "Positive":
            lang_map[code]["pos"] += count
        elif sentiment == "Negative":
            lang_map[code]["neg"] += count
        else:
            lang_map[code]["neu"] += count

    results = []
    for code, data in sorted(lang_map.items(), key=lambda x: -x[1]["count"]):
        cnt = data["count"]
        results.append(LanguageStatOut(
            language=LANG_NAMES.get(code, code.capitalize()),
            code=code,
            count=cnt,
            percentage=round((cnt / total_comments) * 100, 1),
            positive_pct=round((data["pos"] / cnt) * 100, 1) if cnt else 0,
            negative_pct=round((data["neg"] / cnt) * 100, 1) if cnt else 0,
            neutral_pct=round((data["neu"] / cnt) * 100, 1) if cnt else 0,
        ))

    return results


@router.get("/system/info", response_model=SystemInfoOut)
def get_system_info():
    """Judge-facing model metadata and configuration."""
    from app.config import settings
    return SystemInfoOut(
        sentiment_model=settings.sentiment_model,
        embedding_model=settings.embedding_model,
        language_detection="langdetect (Statistical n-gram + Hinglish heuristics)",
        inference_mode="Local Analysis Mode (PyTorch / Transformers)" if settings.use_ml_model else "Deployed Demo Mode (Database)",
        languages_tested=[
            "English", "Hindi (हिन्दी)", "Marathi (मराठी)", "Gujarati (ગુજરાતી)",
            "Bengali (বাংলা)", "Tamil (தமிழ்)", "Telugu (తెలుగు)", "Kannada (ಕನ್ನಡ)",
            "Malayalam (മലയാളം)", "Punjabi (ਪੰਜਾਬੀ)", "Hinglish (Code-Mixed)"
        ],
        similarity_threshold=settings.similarity_threshold,
        duplicate_threshold=settings.duplicate_threshold,
        issue_similarity_threshold=settings.issue_similarity_threshold,
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
        detected_language=a.detected_language if a else None,
        language_confidence=a.language_confidence if a else None,
        aspect=a.aspect if a else None,
        aspect_confidence=a.aspect_confidence if a else None,
        argument_evidence=a.argument_evidence if a else None,
    )

