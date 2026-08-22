@echo off
REM ==============================================================================
REM Drishtikon (दृष्टिकोण) · Automated Local Startup Script (Windows)
REM Portable local setup for compatible Windows/macOS/Linux systems.
REM ==============================================================================

cd /d "%~dp0"

if not exist "backend\venv" (
    echo First-time setup detected. Running setup.bat...
    call setup.bat
)

echo ================================================================================
echo   Starting Drishtikon (दृष्टिकोण) Local Application Stack...
echo   Backend API:  http://localhost:8000
echo   Frontend App: http://localhost:5173
echo ================================================================================

REM 1. Start Backend in a dedicated window
start "Drishtikon Backend API" cmd /k "cd /d "%~dp0backend" && venv\Scripts\uvicorn app.main:app --port 8000"

REM Wait 3 seconds for backend initialization
timeout /t 3 /nobreak >nul

REM 2. Start Frontend in a dedicated window
start "Drishtikon Frontend UI" cmd /k "cd /d "%~dp0frontend" && npm run dev"

REM 3. Automatically open browser
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo Applications started in background windows.
echo Close the terminal windows to stop services.
