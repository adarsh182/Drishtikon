import io
from typing import Any

import pandas as pd


COLUMN_ALIASES = {
    "comment": ["comment", "comments", "text", "comment_text", "feedback"],
    "section": ["section", "sections"],
    "subsection": ["subsection", "sub_section", "sub-section"],
    "stakeholder": ["stakeholder", "stakeholder_type", "stakeholders", "stakeholder group"],
    "version": ["version", "version_number", "draft_version"],
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    col_map = {}
    lower_cols = {c.lower().strip(): c for c in df.columns}
    for canonical, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in lower_cols:
                col_map[lower_cols[alias]] = canonical
                break
    return df.rename(columns=col_map)


def parse_csv(file_content: bytes, max_rows: int = 10000) -> dict[str, Any]:
    errors: list[str] = []
    if not file_content:
        return {"valid": False, "errors": ["Empty file"], "rows": []}

    if len(file_content) > 10 * 1024 * 1024:
        return {"valid": False, "errors": ["File exceeds 10MB limit"], "rows": []}

    try:
        df = pd.read_csv(io.BytesIO(file_content))
    except Exception:
        return {"valid": False, "errors": ["Invalid CSV format"], "rows": []}

    if df.empty:
        return {"valid": False, "errors": ["CSV contains no rows"], "rows": []}

    if len(df) > max_rows:
        return {"valid": False, "errors": [f"CSV exceeds {max_rows} row limit"], "rows": []}

    df = _normalize_columns(df)
    if "comment" not in df.columns:
        return {"valid": False, "errors": ["Missing required 'comment' column"], "rows": []}

    valid_rows: list[dict[str, Any]] = []
    invalid_count = 0

    for idx, row in df.iterrows():
        comment = str(row.get("comment", "")).strip()
        if not comment or comment.lower() == "nan":
            invalid_count += 1
            errors.append(f"Row {idx + 2}: empty comment")
            continue
        version = str(row.get("version", "v1.0")).strip()
        if not version or version.lower() == "nan":
            version = "v1.0"
        valid_rows.append({
            "comment": comment,
            "section": _clean(row.get("section")),
            "subsection": _clean(row.get("subsection")),
            "stakeholder": _clean(row.get("stakeholder")),
            "version": version,
        })

    return {
        "valid": len(valid_rows) > 0,
        "errors": errors[:20],
        "rows": valid_rows,
        "rows_total": len(df),
        "rows_valid": len(valid_rows),
        "rows_invalid": invalid_count,
    }


def _clean(val) -> str | None:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    return s if s and s.lower() != "nan" else None
