#!/usr/bin/env bash
# ==============================================================================
# Drishtikon (दृष्टिकोण) · Automated Local Startup Script (macOS / Linux)
# Portable local setup for compatible Windows/macOS/Linux systems.
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

if [ ! -d "backend/venv" ] || [ ! -d "frontend/node_modules" ]; then
    echo "First-time setup detected. Running ./setup.sh..."
    ./setup.sh
fi

echo "================================================================================"
echo "  Starting Drishtikon (दृष्टिकोण) Local Application Stack..."
echo "  Backend API:  http://localhost:8000"
echo "  Frontend App: http://localhost:5173"
echo "================================================================================"
echo "Press Ctrl+C to stop both services."
echo ""

# Handle graceful shutdown on Ctrl+C / SIGINT
cleanup() {
    echo ""
    echo "Stopping Drishtikon services..."
    kill $(jobs -p) 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start Backend FastAPI Server
(
    cd backend
    ./venv/bin/uvicorn app.main:app --port 8000
) &
BACKEND_PID=$!

# Wait briefly for backend to initialize
sleep 2

# 2. Start Frontend Vite Dev Server
(
    cd frontend
    npm run dev
) &
FRONTEND_PID=$!

# Wait for background processes
wait $BACKEND_PID $FRONTEND_PID
