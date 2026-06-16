@echo off
cd /d "%~dp0"
call .venv\Scripts\activate.bat
set CONTEXTOS_API_URL=http://localhost:8000
set CONTEXTOS_API_KEY=ctxos_922dc111302c0883a8c43bb5d8f60396320ee6a72897675da064714a67daf57f
python server.py
