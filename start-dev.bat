@echo off
title ContextOS Dev

echo Starting ContextOS backend...
start "ContextOS Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

timeout /t 2 /nobreak >nul

echo Starting ContextOS frontend...
start "ContextOS Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo Opening browser...
start "" "http://localhost:5173"
