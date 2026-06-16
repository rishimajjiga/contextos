@echo off
title ContextOS — Frontend
cd /d "%~dp0frontend"

echo Installing dependencies...
call npm install

echo.
echo Starting Vite dev server...
call npm run dev
pause
