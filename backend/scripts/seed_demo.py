"""Generate synthetic demo comments and analyze through the real pipeline."""
import csv
import os
import random
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database.connection import SessionLocal, init_db
from app.models.consultation import Consultation, DraftVersion
from app.models.comment import Comment
from app.services.analysis_pipeline import process_and_store_comments

random.seed(42)

STAKEHOLDERS = [
    "Small Business", "Large Enterprise", "Professional", "Industry Association",
    "NGO", "Citizen", "Legal Professional", "Other",
]
SECTIONS = ["Compliance", "Penalties", "Reporting", "Enforcement", "Governance"]

TEMPLATES = {
    "Compliance Burden": {
        "v1.0": [
            "The compliance requirements are too complicated for small businesses.",
            "Excessive paperwork creates an unnecessary compliance burden.",
            "Monthly reporting is excessive and creates administrative workload.",
            "Too many documents required under the proposed compliance framework.",
            "Small companies cannot manage this level of reporting burden.",
        ],
        "v2.0": [
            "Compliance requirements are still burdensome though slightly improved.",
            "Reporting burden remains high despite quarterly reporting change.",
            "Administrative workload is still significant for MSMEs.",
        ],
        "v3.0": [
            "The revised compliance framework is much more manageable.",
            "Reporting requirements are now reasonable for small businesses.",
            "Compliance burden has been substantially reduced in this version.",
        ],
    },
    "Penalty Structure": {
        "v1.0": [
            "The penalty structure is too harsh for minor violations.",
            "Fines are disproportionate and excessive for small enterprises.",
            "Criminal liability for compliance failures is too severe.",
        ],
        "v2.0": [
            "Penalties remain too harsh despite minor adjustments.",
            "The fine structure is still excessive for procedural errors.",
            "Sanctions are disproportionate to the severity of violations.",
        ],
        "v3.0": [
            "Penalty provisions continue to be a major concern.",
            "Fines remain excessive though slightly moderated.",
            "The punishment framework is still too severe.",
        ],
    },
    "Implementation Ambiguity": {
        "v1.0": [
            "Some minor clarity needed but overall acceptable.",
        ],
        "v2.0": [
            "Implementation guidance is unclear and needs clarification.",
            "The amendment lacks practical guidance on implementation.",
            "Ambiguous language creates uncertainty for companies.",
            "How to implement these provisions is not defined clearly.",
        ],
        "v3.0": [
            "Implementation timeline remains vague and confusing.",
            "Lack of clarity on interpretation is a serious concern.",
            "Unclear guidance makes compliance practically impossible.",
            "The provisions are ambiguous and need detailed clarification.",
        ],
    },
    "positive": [
        "We welcome the improved transparency in the proposed amendment.",
        "The revision improves corporate governance standards effectively.",
        "This is a positive step toward better regulatory clarity.",
        "We support the balanced approach in this draft.",
        "The amendment provides helpful guidance for compliance.",
    ],
    "neutral": [
        "We request clarification on the transitional provisions.",
        "Please provide additional guidance on Section applicability.",
        "We note the changes and will review internally.",
    ],
}

VERSION_COUNTS = {
    "v1.0": {"Compliance Burden": 700, "Penalty Structure": 500, "Implementation Ambiguity": 30, "positive": 200, "neutral": 150},
    "v2.0": {"Compliance Burden": 300, "Penalty Structure": 370, "Implementation Ambiguity": 280, "positive": 250, "neutral": 180},
    "v3.0": {"Compliance Burden": 100, "Penalty Structure": 330, "Implementation Ambiguity": 410, "positive": 300, "neutral": 200},
}


def generate_rows() -> list[dict]:
    rows = []
    for version, counts in VERSION_COUNTS.items():
        for category, count in counts.items():
            for _ in range(count):
                if category in ("positive", "neutral"):
                    text = random.choice(TEMPLATES[category])
                    section = random.choice(SECTIONS)
                else:
                    text = random.choice(TEMPLATES[category][version])
                    section_map = {
                        "Compliance Burden": "Compliance",
                        "Penalty Structure": "Penalties",
                        "Implementation Ambiguity": "Reporting",
                    }
                    section = section_map.get(category, random.choice(SECTIONS))
                rows.append({
                    "comment": text,
                    "section": section,
                    "subsection": None,
                    "stakeholder": random.choice(STAKEHOLDERS),
                    "version": version,
                })
    random.shuffle(rows)
    return rows


def seed():
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(Consultation).filter(Consultation.title == "Companies Act Amendment 2026").first()
        if existing:
            print("Demo consultation already exists. Skipping seed.")
            return existing.id

        consultation = Consultation(
            title="Companies Act Amendment 2026",
            description="Synthetic demonstration consultation for MCA PolicyLens prototype.",
            status="demo",
        )
        db.add(consultation)
        db.flush()

        version_map = {}
        for vn in ["v1.0", "v2.0", "v3.0"]:
            dv = DraftVersion(consultation_id=consultation.id, version_number=vn, label=vn)
            db.add(dv)
            db.flush()
            version_map[vn] = dv.id

        db.commit()

        rows = generate_rows()
        print(f"Generating and analyzing {len(rows)} synthetic comments through real pipeline...")
        result = process_and_store_comments(db, consultation.id, version_map, rows, batch_size=200)
        print(f"Stored: {result['stored']}, Sentiments: {result['sentiments']}, Issues: {result['issues_detected']}")

        _export_demo_csv(rows[:800])
        print("Demo CSV exported.")
        return consultation.id
    finally:
        db.close()


def _export_demo_csv(rows: list[dict]):
    static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
    os.makedirs(static_dir, exist_ok=True)
    path = os.path.join(static_dir, "mca_econsultation_demo.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["comment", "section", "subsection", "stakeholder", "version"])
        writer.writeheader()
        for r in rows:
            writer.writerow({
                "comment": r["comment"],
                "section": r["section"] or "",
                "subsection": r.get("subsection") or "",
                "stakeholder": r["stakeholder"],
                "version": r["version"],
            })


if __name__ == "__main__":
    seed()
