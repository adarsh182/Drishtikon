"""Policy Aspect Identification & Argument Evidence Extraction."""

import logging
import re
from typing import Any

from ..config import settings
from .embedding_service import cosine_similarity, generate_embedding

logger = logging.getLogger(__name__)

# Predefined Policy Aspect Anchors for semantic matching
ASPECT_ANCHORS: dict[str, list[str]] = {
    "Compliance & Administration": [
        "compliance requirements paperwork administrative burden documentation procedural rules",
        "अनुपालन कागजी कार्रवाई प्रशासनिक बोझ दस्तावेज प्रक्रिया",
    ],
    "Penalty & Sanctions": [
        "penalty structure fines monetary punishment imprisonment criminal liability sanctions",
        "जुर्माना दंड वित्तीय सजा कारावास कानूनी कार्रवाई",
    ],
    "Reporting & Disclosure": [
        "reporting frequency monthly filing quarterly return annual disclosure transparency",
        "रिपोर्टिंग विवरण तिमाही दाखिल वार्षिक प्रकटीकरण",
    ],
    "Implementation & Clarity": [
        "implementation timeline transition period guidance ambiguity unclear definition vague rules",
        "कार्यान्वयन समय सीमा संक्रमण काल स्पष्टता अस्पष्ट नियम",
    ],
    "Financial & Cost Impact": [
        "cost impact expensive financial burden fee structure audit fees operational cost",
        "वित्तीय लागत खर्च आर्थिक बोझ फीस संरचना",
    ],
    "Data Privacy & Security": [
        "data protection privacy confidentiality personal information security digital record",
        "डेटा सुरक्षा गोपनीयता व्यक्तिगत जानकारी डिजिटल रिकॉर्ड",
    ],
    "MSME & Small Business": [
        "small business msme startup micro enterprise exemptions threshold relief",
        "छोटे व्यवसाय एमएसएमई स्टार्टअप सूक्ष्म उद्योग छूट",
    ],
    "Governance & Oversight": [
        "corporate governance board oversight independent director audit committee accountability",
        "कॉर्पोरेट प्रशासन बोर्ड निरीक्षण स्वतंत्र निदेशक जवाबदेही",
    ],
    "Regulatory Enforcement": [
        "regulator power inspection investigation audit authority prosecution enforcement",
        "नियामक अधिकार निरीक्षण जांच ऑडिट अभियोजन",
    ],
}

_aspect_embeddings_cache: dict[str, list[float]] = {}


def _get_aspect_embeddings() -> dict[str, list[float]]:
    """Cache anchor embeddings for fast aspect classification."""
    global _aspect_embeddings_cache
    if _aspect_embeddings_cache:
        return _aspect_embeddings_cache

    for aspect, anchors in ASPECT_ANCHORS.items():
        combined_text = " ".join(anchors)
        emb = generate_embedding(combined_text)
        if emb:
            _aspect_embeddings_cache[aspect] = emb

    return _aspect_embeddings_cache


def classify_aspect(text: str, text_embedding: list[float] | None = None) -> tuple[str, float]:
    """
    Classify comment into a predefined Policy Aspect using semantic embedding similarity.
    Returns (aspect_name, confidence).
    """
    if not text or not text.strip():
        return "General", 0.0

    emb = text_embedding if text_embedding is not None else generate_embedding(text)
    if not emb:
        return "General", 0.3

    aspect_embeddings = _get_aspect_embeddings()
    if not aspect_embeddings:
        return "General", 0.3

    best_aspect = "General"
    best_score = 0.0

    for aspect, anchor_emb in aspect_embeddings.items():
        score = cosine_similarity(emb, anchor_emb)
        if score > best_score:
            best_score = score
            best_aspect = aspect

    threshold = settings.aspect_similarity_threshold
    if best_score >= threshold:
        return best_aspect, round(best_score, 4)

    return "General", round(best_score, 4)


def extract_argument_evidence(text: str, aspect: str = "General") -> str:
    """
    Extract the most prominent/relevant sentence or clause from the comment
    as evidence for the argument, preserving verbatim wording.
    """
    if not text or not text.strip():
        return ""

    cleaned = text.strip()
    # Split by standard sentence delimiters across English and Indic punctuation (। and .)
    sentences = [s.strip() for s in re.split(r"[.।!?\n]+", cleaned) if s.strip() and len(s.strip()) > 8]

    if not sentences:
        return cleaned[:200]

    # If only one sentence, return it directly
    if len(sentences) == 1:
        return sentences[0]

    # Select sentence with highest density of strong keywords or length
    key_terms = ["burden", "penalty", "cost", "clarity", "support", "unclear", "excessive", "welcome", "बोझ", "दंड", "सुधार", "कठिन"]
    best_sentence = sentences[0]
    best_score = 0

    for s in sentences:
        score = sum(2 for kw in key_terms if kw in s.lower()) + min(len(s) / 50.0, 1.0)
        if score > best_score:
            best_score = score
            best_sentence = s

    return best_sentence
