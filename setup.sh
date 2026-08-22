#!/usr/bin/env bash
# ==============================================================================
# Drishtikon (दृष्टिकोण) · Automated Local Setup Script (macOS / Linux)
# Portable local setup for compatible Windows/macOS/Linux systems.
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

echo "================================================================================"
echo "  Drishtikon (दृष्टिकोण) · Local-First Setup"
echo "================================================================================"

# 1. Check Python Runtime
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "ERROR: Python 3.10+ is required but not found in PATH."
    exit 1
fi

echo "[1/5] Checking Python environment ($PYTHON_CMD)..."
$PYTHON_CMD -c "
import sys
if sys.version_info < (3, 10):
    print(f'ERROR: Python 3.10+ required. Found {sys.version.split()[0]}')
    sys.exit(1)
"

# 2. Check Node Runtime
echo "[2/5] Checking Node.js environment..."
if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "ERROR: Node.js (v18+) and npm are required for the frontend."
    exit 1
fi
echo "      Found Node $(node -v) and npm $(npm -v)"

# 3. Setup Python Virtual Environment
echo "[3/5] Setting up Python virtual environment in backend/venv..."
if [ ! -d "backend/venv" ]; then
    $PYTHON_CMD -m venv backend/venv
fi

# Activate venv
source backend/venv/bin/activate

# Upgrade pip & install backend dependencies
echo "      Installing backend Python dependencies (PyTorch, Transformers, FastAPI)..."
pip install --upgrade pip --quiet
pip install -r backend/requirements.txt --quiet
pip install pytest pytest-asyncio --quiet

# 4. Setup Frontend Node Modules
echo "[4/5] Installing frontend dependencies..."
cd frontend
npm install --quiet --no-audit
cd "$PROJECT_ROOT"

# 5. Initialize Database, Cache Check, and Model Pre-warming
echo "[5/5] Initializing local SQLite database and pre-warming AI models..."
backend/venv/bin/python backend/scripts/setup_local.py

echo ""
echo "================================================================================"
echo "✓ SETUP COMPLETE! You are ready to start Drishtikon."
echo ""
echo "To start the application, run:"
echo "    ./start.sh"
echo ""
echo "Or start backend and frontend individually:"
echo "    Backend:  cd backend && ./venv/bin/uvicorn app.main:app --port 8000"
echo "    Frontend: cd frontend && npm run dev"
echo "================================================================================"
