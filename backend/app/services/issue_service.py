import json
from typing import Any

ISSUE_TAXONOMY: dict[str, list[str]] = {
    "Compliance Burden": [
        "compliance burden", "too much paperwork", "excessive compliance",
        "too many documents", "administrative burden", "reporting burden",
        "documentation burden", "bureaucratic", "paperwork", "reporting frequency",
        "monthly reporting", "quarterly reporting", "compliance cost",
        "compliance requirements are too", "unnecessary paperwork",
    ],
    "Penalty Structure": [
        "penalty", "penalties", "fine", "fines", "punishment", "sanction",
        "too harsh", "excessive penalty", "disproportionate", "penalty structure",
        "criminal liability", "imprisonment", "monetary penalty",
    ],
    "Implementation Ambiguity": [
        "ambiguous", "unclear", "uncertainty", "confusing", "vague",
        "implementation", "interpretation", "lack of clarity", "not defined",
        "how to implement", "unclear guidance", "needs clarification",
        "implementation timeline", "practical guidance",
    ],
    "Reporting Requirements": [
        "reporting requirement", "disclosure", "filing", "annual report",
        "financial reporting", "reporting obligation", "mandatory reporting",
    ],
    "Cost Impact": [
        "cost", "expensive", "financial burden", "afford", "budget",
        "operational cost", "implementation cost", "costly",
    ],
    "Data Privacy": [
        "privacy", "data protection", "personal data", "confidential",
        "data security", "gdpr",
    ],
    "Enforcement": [
        "enforcement", "regulator", "inspection", "audit", "prosecution",
        "regulatory action", "enforcement mechanism",
    ],
    "Small Business Impact": [
        "small business", "msme", "startup", "sme", "micro enterprise",
        "small enterprise", "small companies", "small firms",
    ],
}


def detect_issue(text: str) -> dict[str, Any]:
    lower = text.lower()
    best_issue = None
    best_score = 0.0
    matched_keywords: list[str] = []

    for issue_name, keywords in ISSUE_TAXONOMY.items():
        score = 0.0
        hits: list[str] = []
        for kw in keywords:
            if kw in lower:
                score += 1.0 + len(kw) / 50.0
                hits.append(kw)
        if score > best_score:
            best_score = score
            best_issue = issue_name
            matched_keywords = hits

    if best_issue is None or best_score == 0:
        return {"issue": "General Feedback", "issue_confidence": 0.3, "topics": json.dumps(["general"])}

    confidence = min(0.95, 0.4 + best_score * 0.15)
    topics = list({best_issue.split()[0].lower(), *matched_keywords[:2]})
    return {
        "issue": best_issue,
        "issue_confidence": round(confidence, 4),
        "topics": json.dumps(topics),
    }


def get_all_issue_names() -> list[str]:
    return list(ISSUE_TAXONOMY.keys()) + ["General Feedback"]
