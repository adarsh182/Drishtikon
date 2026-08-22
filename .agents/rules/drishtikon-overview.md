---
description: Drishtikon overview, hackathon problem statement, stack conventions, architecture, and commands
activation: always_on
alwaysApply: true
---

# Drishtikon (दृष्टिकोण) · Project Overview & Workspace Rules

## 1. Hackathon & Problem Statement Context

- **Platform Name**: Drishtikon (दृष्टिकोण) — Policy Consultation Intelligence Platform
- **Event**: Smart India Hackathon (SIH)
- **Problem Statement ID**: SIH26035 (Ministry of Corporate Affairs / MCA)
- **Problem Statement Title**: AI/ML-driven sentiment analysis, policy issue extraction, and trend tracking for public consultation comments submitted through the MCA eConsultation module.
- **Team Name**: Cosmet
- **Team ID**: SIH2602

---

## 2. Core Architectural & Domain Decisions

These decisions are foundational to the project's design and cannot be deduced from source code alone:

### Multilingual Sentiment Model Choice
- The sentiment model is explicitly configured to `cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual` (multilingual RoBERTa), **not** an English-only sentiment model (such as `twitter-roberta-base-sentiment-latest`).
- **Rationale**: Real eConsultation feedback submitted to MCA contains Hindi, Hinglish, and regional Indian languages. An English-only model or rule-based heuristic silently fails on non-English text and misclassifies comments as `Neutral`.

### Local ML Inference Priority (`USE_ML_MODEL=true`)
- Sentiment inference is designed to run locally in-process via Hugging Face `transformers` and `torch` when `USE_ML_MODEL=true` (using `requirements-local.txt`).
- **Rationale**: Running locally removes any external network dependency, latency penalty, API rate limits, or potential service downtime during live hackathon evaluation and demos.

### Competitive & Reference Baseline: "Avalokan"
- **Reference Paper**: "Avalokan" (published in IJERT, April 2026, by CBIT Hyderabad).
- **Avalokan Architecture**: DistilBERT for sentiment analysis + SentenceBERT for comment deduplication + version-wise trend tracking, built on a React / Flask / MongoDB stack.
- **Drishtikon Differentiator**: Multilingual RoBERTa support for Indian languages/Hinglish, automated schema/alias detection for flexible CSV ingestion, mathematical priority scoring (0–100) with evidence sufficiency indicators, verbatim comment-to-issue traceability, and policy evolution trajectory tracking (Improved, Persistent, Emerging, Worsening, Volatile) across draft iterations (v1 → v2 → v3).

---

## 3. Technology Stack & Architecture

| Layer | Technologies & Libraries |
| :--- | :--- |
| **Backend** | Python 3.11+, FastAPI, SQLAlchemy 2.0 (Mapped ORM), Pydantic v2, Pydantic-Settings, Uvicorn, Pandas, HTTPX |
| **NLP & AI** | Hugging Face Transformers (`cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual`), PyTorch, Keyword Fallback |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4 (`@tailwindcss/vite`), React Router DOM v7, Recharts, Lucide React, Axios |
| **Database** | SQLite (`sqlite:///./policylens.db`) for local development; PostgreSQL / Supabase for production |
| **Deployment** | Vercel (Frontend), Render (`render.yaml`, Python web service) (Backend), Supabase (Database) |

### Analysis Pipeline Flow
1. **Multipart CSV Ingestion**: Flexible column aliasing (`text`, `comment`, `feedback`, `stakeholder`, `version`, `section`, `clause`, etc.).
2. **Row Validation & Sanitization**: Strips malformed rows without failing the entire batch upload.
3. **Sentiment Analysis**: Multilingual transformer pipeline (or API/keyword fallback) yielding polarity and confidence score.
4. **Issue Detection**: Rule/taxonomy-based classification tagging comments to policy issue categories.
5. **Database Transaction Batching**: Nested transaction commits with row-by-row fallback resilience.
6. **Metrics & Evolution Aggregation**: Computes issue priority scores (0–100) and draft version trajectories (`v1` → `v2` → `v3`).

---

## 4. Repository Structure

```
/Users/adarsh/Downloads/SIH/
├── backend/
│   ├── app/
│   │   ├── api/routes.py          # FastAPI REST endpoints (/consultations, /comments, /issues, /dashboard)
│   │   ├── config.py              # Pydantic Settings (models, thresholds, database, CORS)
│   │   ├── database/connection.py # SQLAlchemy session maker and engine
│   │   ├── models/                # SQLAlchemy ORM models (Consultation, DraftVersion, Comment, CommentAnalysis, Issue)
│   │   ├── schemas/               # Pydantic request/response schemas
│   │   ├── services/              # Core domain services:
│   │   │   ├── analysis_pipeline.py  # Ingestion batch processor & NLP coordinator
│   │   │   ├── sentiment_service.py  # Sentiment analysis (Local ML / HF API / Fallback)
│   │   │   ├── issue_service.py      # Issue taxonomy and classification
│   │   │   ├── evolution_service.py  # Cross-version policy trajectory tracking
│   │   │   ├── dashboard_service.py  # Analytics, aggregations, and priority scoring
│   │   │   └── evidence_service.py   # Verbatim comment retrieval & citations
│   │   └── utils/csv_parser.py    # CSV encoding & alias detection
│   ├── scripts/seed_demo.py       # Automated demo dataset seed script
│   ├── static/                    # Demo consultation datasets (mca_econsultation_demo.csv)
│   ├── Dockerfile                 # Container definition for backend
│   ├── requirements.txt           # Lightweight production dependencies (Render)
│   ├── requirements-local.txt     # Local ML dependencies (includes transformers & torch)
│   └── test_sentiment.py          # Standalone sentiment pipeline verification script
├── frontend/
│   ├── src/
│   │   ├── components/            # Reusable UI components (Layout, ErrorState, LoadingState)
│   │   ├── context/               # React Contexts (ConsultationContext)
│   │   ├── pages/                 # Route views (Dashboard, Issues, IssueDetail, Comments, CommentDetail, PolicyEvolution, Upload, Consultations, ConsultationDetail)
│   │   ├── services/api.ts        # Axios API client with configurable timeouts
│   │   ├── types/index.ts         # TypeScript interfaces and data types
│   │   └── utils/format.ts        # Formatting helpers (percentages, scores, badges)
│   ├── package.json
│   ├── vite.config.ts
│   └── vercel.json
├── .env.example                   # Baseline environment variable templates
├── .pylintrc                      # Python linting configuration with backend path hook
├── render.yaml                    # Render blueprint for backend deployment
└── README.md                      # Platform documentation and developer guide
```

---

## 5. Development, Testing, and Deployment Commands

### Backend Commands
```bash
# Setup virtual environment
cd backend
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt          # Lightweight production/API mode
# OR for local ML model execution:
pip install -r requirements-local.txt    # Includes transformers and torch

# Run FastAPI backend with hot reload
uvicorn app.main:app --reload --port 8000

# Run sentiment analysis test script
python test_sentiment.py

# Seed demo dataset manually (if not auto-seeded on startup)
python -m scripts.seed_demo
```

### Frontend Commands
```bash
cd frontend

# Install packages
npm install

# Run Vite dev server (runs at http://localhost:5173)
npm run dev

# Typecheck and build production bundle
npm run build

# Run linter
npm run lint
```

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (or defaults to local SQLite).
- `CORS_ORIGINS`: Comma-separated allowed origins (e.g., `http://localhost:5173,https://drishtikon-indol.vercel.app`).
- `USE_ML_MODEL`: `true` to run local Hugging Face Transformers pipeline; `false` to fallback to API/rules.
- `HF_TOKEN`: Hugging Face User Access Token (required for router inference API).
- `VITE_API_URL`: Backend URL for frontend client (e.g., `http://localhost:8000`).
