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
            "मासिक रिपोर्टिंग की अनिवार्यता छोटे व्यवसायों के लिए बहुत अधिक कागजी काम और प्रशासनिक बोझ बढ़ाती है।",
            "वारंवार अहवाल सादर करणे आणि कागदपत्रांची पूर्तता करणे लघू उद्योगांना अत्यंत त्रासदायक आहे.",
            "Ye compliance requirement MSMEs ke liye kaafi difficult hai aur administrative burden bohot zyada hai.",
            "சிறு நிறுவனங்களுக்கு மாதாந்திர அறிக்கை சமர்ப்பிப்பது அதிக நிர்வாக சுமையை ஏற்படுத்துகிறது.",
        ],
        "v2.0": [
            "Compliance requirements are still burdensome though slightly improved.",
            "Reporting burden remains high despite quarterly reporting change.",
            "Administrative workload is still significant for MSMEs.",
            "तिमाही रिपोर्टिंग से थोड़ा सुधार हुआ है परंतु अनुपालन का बोझ अब भी अधिक है।",
            "कागदपत्रांचा ताण थोडा कमी झाला आहे तरीही अजून सुलभतेची गरज आहे.",
            "Quarterly reporting se thoda relief mila hai but compliance cost abhi bhi high hai.",
        ],
        "v3.0": [
            "The revised compliance framework is much more manageable.",
            "Reporting requirements are now reasonable for small businesses.",
            "Compliance burden has been substantially reduced in this version.",
            "संशोधित अनुपालन ढांचा अब बहुत सरल और व्यावहारिक है।",
            "नवीन नियमांमुळे अनुपालन प्रक्रिया सोपी झाली असून एमएसएमईंना मोठा दिलासा मिळाला आहे.",
            "Revised draft me reporting burden kafi kam ho gaya hai, good step.",
        ],
    },
    "Penalty Structure": {
        "v1.0": [
            "The penalty structure is too harsh for minor violations.",
            "Fines are disproportionate and excessive for small enterprises.",
            "Criminal liability for compliance failures is too severe.",
            "छोटे उल्लंघनों के लिए आपराधिक दायित्व और भारी जुर्माना पूरी तरह से अनुचित है।",
            "દંડની જોગવાઈઓ ખૂબ કડક છે અને સામાન્ય ભૂલો માટે આટલો મોટો દંડ અયોગ્ય છે.",
            "Penalty amount bohot zyada hai aur criminal liability bilkul nahi honi chahiye.",
            "அபராதத் தொகை மிகவும் அதிகமாக உள்ளது மற்றும் நியாயமற்றது.",
        ],
        "v2.0": [
            "Penalties remain too harsh despite minor adjustments.",
            "The fine structure is still excessive for procedural errors.",
            "Sanctions are disproportionate to the severity of violations.",
            "संशोधन के बाद भी दंडात्मक प्रावधान अत्यधिक कठोर हैं।",
            "દંડમાં થોડો ઘટાડો થયો છે પણ હજુ સામાન્ય વેપારીઓ માટે આર્થિક બોજ છે.",
            "Fine structure thoda moderate hua hai but procedural lapses par penalty abhi bhi severe hai.",
        ],
        "v3.0": [
            "Penalty provisions continue to be a major concern.",
            "Fines remain excessive though slightly moderated.",
            "The punishment framework is still too severe.",
            "जुर्माने के नियम अभी भी छोटे उद्योगों के लिए चिंता का मुख्य विषय बने हुए हैं।",
            "દંડની જોગવાઈઓમાં હજુ વધુ રાહત મળવી જોઈતી હતી.",
            "Penalty issue v3 me bhi persistent hai, penalties should be decriminalized further.",
        ],
    },
    "Implementation Ambiguity": {
        "v1.0": [
            "Some minor clarity needed but overall acceptable.",
            "प्रारंभिक मसौदे में कुछ बिंदुओं पर स्पष्टीकरण की आवश्यकता है।",
        ],
        "v2.0": [
            "Implementation guidance is unclear and needs clarification.",
            "The amendment lacks practical guidance on implementation.",
            "Ambiguous language creates uncertainty for companies.",
            "How to implement these provisions is not defined clearly.",
            "कार्यान्वयन की समय-सीमा और दिशा-निर्देश बहुत अस्पष्ट हैं, कृपया स्पष्ट गाइडलाइन्स जारी करें।",
            "નિયમોના અમલીકરણ અંગે સ્પષ્ટતાનો અભાવ છે અને માર્ગદર્શિકા જરૂરી છે.",
            "Implementation timeline bohot confusing hai aur clarity ki sakht zaroorat hai.",
            "விதிகள் மற்றும் நடைமுறைப்படுத்தலில் தெளிவின்மை உள்ளது.",
        ],
        "v3.0": [
            "Implementation timeline remains vague and confusing.",
            "Lack of clarity on interpretation is a serious concern.",
            "Unclear guidance makes compliance practically impossible.",
            "The provisions are ambiguous and need detailed clarification.",
            "अस्पष्ट व्याख्या और समय सीमा के कारण नए नियमों को लागू करना अत्यंत कठिन हो रहा है।",
            "ಅನುಷ್ಠಾನದ ಮಾರ್ಗಸೂಚಿಗಳು ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ ಮತ್ತು ಗೊಂದಲ ಮೂಡಿಸುತ್ತವೆ.",
            "നിയമങ്ങൾ നടപ്പിലാക്കുന്നതിനുള്ള സമയപരിധി അവ്യക്തമാണ്.",
            "ਨਿਯਮਾਂ ਦੀ ਵਿਆਖਿਆ ਵਿੱਚ ਸਪਸ਼ਟਤਾ ਦੀ ਘਾਟ ਇੱਕ ਵੱਡੀ ਸਮੱਸਿਆ ਹੈ।",
        ],
    },
    "positive": [
        "We welcome the improved transparency in the proposed amendment.",
        "The revision improves corporate governance standards effectively.",
        "This is a positive step toward better regulatory clarity.",
        "We support the balanced approach in this draft.",
        "The amendment provides helpful guidance for compliance.",
        "नवीन नियमांमुळे पारदर्शकता वाढेल आणि कंपनी कारभारात नक्कीच मोठी सुधारणा होईल.",
        "প্রস্তাবিত সংশোধনী করপোরেট সুশাসন উন্নত করতে সাহায্য করবে, আমরা এটিকে পূর্ণ সমর্থন করি।",
        "ఈ ముసాయిదా నిబంధనలు కంపెనీలకు మరింత స్పష్టత మరియు సులభతర వ్యాపార వాతావरणాన్ని అందిస్తాయి.",
        "புதிய விதிகள் கார்ப்பரேட் நிர்வாகத்தை மேம்படுத்த உதவுகின்றன, வரவேற்கத்தக்க முடிவு.",
        "Transparency improve hogi aur ease of doing business ko boost milega, very positive step.",
    ],
    "neutral": [
        "We request clarification on the transitional provisions.",
        "Please provide additional guidance on Section applicability.",
        "We note the changes and will review internally.",
        "कृपया धारा 135 की प्रयोज्यता पर अतिरिक्त मार्गदर्शन प्रदान करें।",
        "વચગાળાની જોગવાઈઓ અંગે વધારાની સ્પષ્ટતા આપવા વિનંતી છે.",
        "Transitional period ke bare me thoda clarification provide karein please.",
    ],
}

# Duplicate / Semantic similarity pairs to guarantee exact & near duplicate groups
DUPLICATE_PAIRS = [
    # Exact Duplicates
    {"comment": "The compliance requirements are too complicated for small businesses.", "section": "Compliance", "stakeholder": "Small Business", "version": "v1.0"},
    {"comment": "The compliance requirements are too complicated for small businesses.", "section": "Compliance", "stakeholder": "Small Business", "version": "v1.0"},
    {"comment": "मासिक रिपोर्टिंग की अनिवार्यता छोटे व्यवसायों के लिए बहुत अधिक कागजी काम और प्रशासनिक बोझ बढ़ाती है।", "section": "Compliance", "stakeholder": "Small Business", "version": "v1.0"},
    {"comment": "मासिक रिपोर्टिंग की अनिवार्यता छोटे व्यवसायों के लिए बहुत अधिक कागजी काम और प्रशासनिक बोझ बढ़ाती है।", "section": "Compliance", "stakeholder": "Small Business", "version": "v1.0"},
    
    # Near / Semantic Paraphrased Duplicates (Cross-lingual & English)
    {"comment": "The penalty structure is excessively harsh for minor administrative violations.", "section": "Penalties", "stakeholder": "Legal Professional", "version": "v2.0"},
    {"comment": "The fine structure is disproportionately harsh for minor procedural lapses.", "section": "Penalties", "stakeholder": "Legal Professional", "version": "v2.0"},
]


VERSION_COUNTS = {
    "v1.0": {"Compliance Burden": 70, "Penalty Structure": 50, "Implementation Ambiguity": 3, "positive": 20, "neutral": 15},
    "v2.0": {"Compliance Burden": 30, "Penalty Structure": 37, "Implementation Ambiguity": 28, "positive": 25, "neutral": 18},
    "v3.0": {"Compliance Burden": 10, "Penalty Structure": 33, "Implementation Ambiguity": 41, "positive": 30, "neutral": 20},
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
    for dup in DUPLICATE_PAIRS:
        rows.append({
            "comment": dup["comment"],
            "section": dup["section"],
            "subsection": None,
            "stakeholder": dup["stakeholder"],
            "version": dup["version"],
        })
    random.shuffle(rows)
    return rows


def seed(force_reseed: bool = False):
    init_db()
    db = SessionLocal()
    try:
        title_name = "Companies Act Amendment 2026"
        existing = db.query(Consultation).filter(Consultation.title.ilike("%Companies Act Amendment 2026%")).first()
        if existing and not force_reseed:
            count = db.query(Comment).filter(Comment.consultation_id == existing.id).count()
            if count > 0:
                print("Demo consultation already seeded. Skipping seed.")
                return existing.id
            else:
                print("Demo consultation orphaned without comments. Deleting and re-seeding.")
                db.delete(existing)
                db.commit()
        elif existing and force_reseed:
            print("Force re-seeding demo consultation...")
            db.delete(existing)
            db.commit()

        consultation = Consultation(
            title=title_name,
            description="Public consultation and stakeholder feedback analysis on proposed regulatory amendments.",
            status="active",
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
