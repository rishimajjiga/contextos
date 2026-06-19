@echo off
title ContextOS Backend
cd /d "%~dp0backend"
echo Running startup checks...
echo.
python test_startup.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Fix the errors above then try again.
    pause
    exit /b 1
)
echo.
echo Starting server on http://localhost:8000
echo Press Ctrl+C to stop.
echo.
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
