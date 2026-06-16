@echo off
title ContextOS — Backend
cd /d "%~dp0backend"

if not exist ".venv\Scripts\activate.bat" (
    echo Creating virtual environment...
    python -m venv .venv
)
echo Activating virtual environment...
call .venv\Scripts\activate.bat
echo Installing/updating dependencies...
pip install -r requirements.txt

if not exist ".env" (
    echo.
    echo ERROR: backend\.env file is missing!
    echo.
    pause
    exit /b 1
)

echo.
echo Starting FastAPI server...
echo Tables will be created automatically on first run.
echo.
.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
pause
