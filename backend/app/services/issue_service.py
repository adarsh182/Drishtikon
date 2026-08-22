"""Policy Issue Classification: Semantic Embedding Matching against Predefined Policy Taxonomy."""

import json
import logging
from typing import Any

from ..config import settings
from .embedding_service import cosine_similarity, generate_embedding

logger = logging.getLogger(__name__)

# Predefined Policy Issue Taxonomy with rich semantic anchor descriptions
ISSUE_TAXONOMY: dict[str, list[str]] = {
    "Compliance Burden": [
        "excessive paperwork and complex administrative compliance requirements for enterprises",
        "monthly or quarterly reporting creates unnecessary procedural burden and documentation workload",
        "अत्यधिक कागजी कार्रवाई और जटिल प्रशासनिक अनुपालन आवश्यकताएं",
        "वारंवार अहवाल सादर करणे आणि प्रशासकीय कामाचा मोठा ताण",
    ],
    "Penalty Structure": [
        "harsh fines disproportionate monetary penalties imprisonment and criminal liability",
        "excessive punishment structure for procedural and inadvertent administrative lapses",
        "कठोर जुर्माना और अनुपातहीन वित्तीय दंड और सजा",
        "દંડની કડક જોગવાઈઓ અને અયોગ્ય આર્થિક બોજ",
    ],
    "Implementation Ambiguity": [
        "unclear transition timeline ambiguous language lack of practical implementation guidance",
        "vague definitions and confusing regulatory instructions needing urgent clarification",
        "अस्पष्ट कार्यान्वयन समय सीमा और नियमों की व्याख्या में अनिश्चितता",
        "விதிகள் மற்றும் நடைமுறைப்படுத்தலில் தெளிவின்மை",
    ],
    "Reporting Requirements": [
        "mandatory periodic disclosures filing obligations and annual financial reports",
        "stringent disclosure framework and regulatory filing obligations",
        "अनिवार्य प्रकटीकरण और विनियामक फाइलिंग आवश्यकताएं",
    ],
    "Cost Impact": [
        "high operational cost financial burden expensive software audit fees and budget strain",
        "अत्यधिक परिचालन लागत और महंगा वित्तीय बोझ",
    ],
    "Data Privacy": [
        "data protection confidentiality personal information security and digital rights",
        "डेटा सुरक्षा और व्यक्तिगत जानकारी की गोपनीयता",
    ],
    "Enforcement": [
        "regulatory inspection audit power investigation and prosecution mechanisms",
        "नियामक निरीक्षण और जांच एवं प्रवर्तन अधिकार",
    ],
    "Small Business Impact": [
        "disproportionate impact on msmes startups small companies needing threshold relief",
        "सूक्ष्म लघु और मध्यम उद्यमों एमएसएमई पर प्रतिकूल प्रभाव",
    ],
}

_issue_embeddings_cache: dict[str, list[float]] = {}


def _get_issue_embeddings() -> dict[str, list[float]]:
    """Cache anchor embeddings for fast issue matching."""
    global _issue_embeddings_cache
    if _issue_embeddings_cache:
        return _issue_embeddings_cache

    for issue_name, anchors in ISSUE_TAXONOMY.items():
        combined_text = " ".join(anchors)
        emb = generate_embedding(combined_text)
        if emb:
            _issue_embeddings_cache[issue_name] = emb

    return _issue_embeddings_cache


def detect_issue(text: str, text_embedding: list[float] | None = None) -> dict[str, Any]:
    """
    Classify a comment into the Policy Issue Taxonomy using:
    1. Multilingual Semantic Embedding similarity (primary)
    2. Deterministic keyword taxonomy matching (fallback)
    """
    if not text or not text.strip():
        return {
            "issue": "General Feedback",
            "issue_confidence": 0.0,
            "topics": json.dumps(["general"]),
            "matched_anchor": None,
        }

    emb = text_embedding if text_embedding is not None else generate_embedding(text)
    issue_embeddings = _get_issue_embeddings()

    # 1. Primary: Semantic Embedding Matching
    if emb and issue_embeddings:
        best_issue = None
        best_score = 0.0

        for issue_name, anchor_emb in issue_embeddings.items():
            score = cosine_similarity(emb, anchor_emb)
            if score > best_score:
                best_score = score
                best_issue = issue_name

        threshold = settings.issue_similarity_threshold
        if best_issue and best_score >= threshold:
            topics = [best_issue.split()[0].lower()]
            return {
                "issue": best_issue,
                "issue_confidence": round(best_score, 4),
                "topics": json.dumps(topics),
                "matched_anchor": f"Semantic match to {best_issue} taxonomy",
            }

    # 2. Fallback: Keyword-based matching
    lower = text.lower()
    best_issue = None
    best_score = 0.0
    matched_keywords: list[str] = []

    for issue_name, keywords in ISSUE_TAXONOMY.items():
        score = 0.0
        hits: list[str] = []
        for kw in keywords:
            for word in kw.split():
                if len(word) > 3 and word.lower() in lower:
                    score += 1.0
                    hits.append(word)
        if score > best_score:
            best_score = score
            best_issue = issue_name
            matched_keywords = hits

    if best_issue is not None and best_score > 0:
        confidence = min(0.85, 0.45 + best_score * 0.1)
        topics = list({best_issue.split()[0].lower(), *matched_keywords[:2]})
        return {
            "issue": best_issue,
            "issue_confidence": round(confidence, 4),
            "topics": json.dumps(topics),
            "matched_anchor": f"Keyword match: {', '.join(matched_keywords[:2])}",
        }

    return {
        "issue": "General Feedback",
        "issue_confidence": 0.35,
        "topics": json.dumps(["general"]),
        "matched_anchor": None,
    }


def get_all_issue_names() -> list[str]:
    return list(ISSUE_TAXONOMY.keys()) + ["General Feedback"]

