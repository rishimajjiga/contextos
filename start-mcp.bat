@echo off
title ContextOS — MCP Server
cd /d "%~dp0mcp-server"

if not exist ".venv\Scripts\activate.bat" (
    echo Creating virtual environment...
    python -m venv .venv
)
call .venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt

if not exist ".env" (
    echo.
    echo ERROR: mcp-server\.env is missing!
    echo Copy .env.example to .env and add your CONTEXTOS_API_KEY.
    echo Generate a key at: http://localhost:8000/docs#/api-keys/create_api_key_api_v1_api_keys_post
    echo.
    pause
    exit /b 1
)

echo.
echo Starting ContextOS MCP Server...
echo.
python server.py
pause
