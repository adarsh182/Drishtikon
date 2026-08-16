import io
import re
from typing import Any
import pandas as pd

COLUMN_ALIASES = {
    "comment": [
        "comment", "comments", "comment_text", "feedback", "feedback_text", 
        "response", "response_text", "submission", "submission_text", 
        "stakeholder_comment", "public_comment", "remarks", "suggestion", 
        "opinion", "view", "feedback_details", "text"
    ],
    "section": [
        "section", "section_no", "section_number", "section_name", 
        "clause", "clause_no", "clause_number", "provision", "provision_no", 
        "legal_section", "sections", "true_clause"
    ],
    "subsection": [
        "subsection", "sub_section", "subsection_no", "subclause", "sub-section"
    ],
    "stakeholder": [
        "stakeholder", "stakeholder_type", "stakeholder_group", 
        "respondent", "respondent_type", "respondent_category", 
        "category", "organization_type", "stakeholders"
    ],
    "version": [
        "version", "draft", "draft_version", "version_number", 
        "draft_number", "revision", "revision_number"
    ],
}

def _clean_header(header: str) -> str:
    """Normalize headers: lowercase, trim whitespace, replace punctuation/spaces with underscore."""
    if not isinstance(header, str):
        return ""
    h = header.lower().strip()
    h = h.replace("\ufeff", "")  # Remove BOM
    h = re.sub(r'[^a-z0-9]', '_', h)
    h = re.sub(r'_+', '_', h)
    return h.strip("_")

def _normalize_columns(df: pd.DataFrame) -> tuple[pd.DataFrame, list[str]]:
    warnings = []
    # Strip empty unnamed columns entirely
    df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
    
    col_map = {}
    normalized_headers = {c: _clean_header(c) for c in df.columns}
    
    for canonical, aliases in COLUMN_ALIASES.items():
        found = []
        for orig_col, norm_col in normalized_headers.items():
            if norm_col in aliases:
                found.append(orig_col)
        
        if len(found) == 1:
            col_map[found[0]] = canonical
        elif len(found) > 1:
            warnings.append(f"Ambiguous columns for '{canonical}': {found}. Used '{found[0]}'.")
            col_map[found[0]] = canonical

    # Rename the mapped columns, keeping unmapped ones as is (extra columns)
    return df.rename(columns=col_map), warnings

def _normalize_version(val: Any) -> str:
    if pd.isna(val) or not str(val).strip():
        return "Unspecified"
    
    v = str(val).strip().lower()
    if v == "nan":
        return "Unspecified"
        
    # Extract number if possible: "Draft 1", "v1", "Version 1", "1" -> "v1.0"
    match = re.search(r'(\d+(?:\.\d+)?)', v)
    if match:
        num = match.group(1)
        if "." not in num:
            num += ".0"
        return f"v{num}"
    
    return str(val).strip()

def _clean(val) -> str:
    if val is None or pd.isna(val):
        return ""
    s = str(val).strip()
    return s if s.lower() != "nan" else ""

def parse_csv(file_content: bytes, max_rows: int = 10000) -> dict[str, Any]:
    row_errors: list[dict[str, Any]] = []
    warnings: list[str] = []
    
    if not file_content:
        return {"valid": False, "errors": ["Empty file"], "warnings": [], "rows": []}

    if len(file_content) > 10 * 1024 * 1024:
        return {"valid": False, "errors": ["File exceeds 10MB limit"], "warnings": [], "rows": []}

    try:
        # read_csv handles standard comma escaping automatically
        df = pd.read_csv(io.BytesIO(file_content), skip_blank_lines=True)
    except Exception as e:
        return {"valid": False, "errors": [f"Invalid CSV format: {str(e)}"], "warnings": [], "rows": []}

    # Drop entirely empty rows
    df.dropna(how='all', inplace=True)
    
    if df.empty:
        return {"valid": False, "errors": ["CSV contains no usable rows"], "warnings": [], "rows": []}

    if len(df) > max_rows:
        return {"valid": False, "errors": [f"CSV exceeds {max_rows} row limit"], "warnings": [], "rows": []}

    df, map_warnings = _normalize_columns(df)
    warnings.extend(map_warnings)
    
    if "comment" not in df.columns:
        return {
            "valid": False, 
            "errors": [
                f"Unable to identify the comment column. "
                f"Detected columns: {list(df.columns)}. "
                "Required: a column representing stakeholder comments (e.g., 'comment', 'feedback')."
            ],
            "warnings": warnings,
            "rows": []
        }

    valid_rows: list[dict[str, Any]] = []
    filtered_count = 0
    failed_count = 0

    for idx, row in df.iterrows():
        try:
            comment = str(row.get("comment", "")).strip()
            if not comment or comment.lower() == "nan":
                filtered_count += 1
                row_errors.append({"row_number": idx + 2, "status": "FILTERED", "reason": "Empty comment"})
                continue
                
            version = _normalize_version(row.get("version"))
            section = _clean(row.get("section")) or "Unspecified"
            subsection = _clean(row.get("subsection"))
            stakeholder = _clean(row.get("stakeholder")) or "Unknown"
            
            valid_rows.append({
                "comment": comment,
                "section": section,
                "subsection": subsection if subsection else None,
                "stakeholder": stakeholder,
                "version": version,
                "row_number": idx + 2
            })
        except Exception as e:
            failed_count += 1
            row_errors.append({"row_number": idx + 2, "status": "FAILED", "reason": f"Malformed row: {str(e)}"})

    total_rows = len(df)
    processed_rows = len(valid_rows)
    
    # Sanity check constraint: total_rows = processed_rows + filtered_rows + failed_rows
    if total_rows != (processed_rows + filtered_count + failed_count):
        warnings.append("Row accounting mismatch. Some rows were inexplicably dropped.")

    return {
        "valid": processed_rows > 0,
        "errors": [e["reason"] for e in row_errors if e["status"] == "FAILED"][:20],
        "warnings": warnings,
        "rows": valid_rows,
        "row_errors": row_errors,
        "rows_total": total_rows,
        "rows_processed": processed_rows,
        "rows_filtered": filtered_count,
        "rows_failed": failed_count,
    }
