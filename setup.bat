@echo off
REM ==============================================================================
REM Drishtikon (दृष्टिकोण) · Automated Local Setup Script (Windows)
REM Portable local setup for compatible Windows/macOS/Linux systems.
REM ==============================================================================

cd /d "%~dp0"

echo ================================================================================
echo   Drishtikon (दृष्टिकोण) · Local-First Setup (Windows)
echo ================================================================================

REM 1. Check Python
echo [1/5] Checking Python environment...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python 3.10+ is required but not found in PATH.
    echo Please install Python 3.10+ from python.org and check "Add Python to PATH".
    pause
    exit /b 1
)

REM 2. Check Node & npm
echo [2/5] Checking Node.js environment...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js (v18+) is required but not found in PATH.
    echo Please install Node.js from nodejs.org.
    pause
    exit /b 1
)

REM 3. Create Python Virtual Environment
echo [3/5] Setting up Python virtual environment in backend\venv...
if not exist "backend\venv" (
    python -m venv backend\venv
)

REM Install backend dependencies
echo       Installing backend Python dependencies (PyTorch, Transformers, FastAPI)...
call backend\venv\Scripts\python -m pip install --upgrade pip --quiet
call backend\venv\Scripts\pip install -r backend\requirements.txt --quiet
call backend\venv\Scripts\pip install pytest pytest-asyncio --quiet

REM 4. Install Frontend Dependencies
echo [4/5] Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install --quiet --no-audit
cd /d "%~dp0"

REM 5. Pre-warm AI Models and Initialize Database
echo [5/5] Initializing local SQLite database and pre-warming AI models...
call backend\venv\Scripts\python backend\scripts\setup_local.py

echo.
echo ================================================================================
echo [SUCCESS] Setup complete!
echo To start Drishtikon, run:
echo     start.bat
echo ================================================================================
pause
