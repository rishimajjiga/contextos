@echo off
title ContextOS — Setup Claude Desktop MCP
cd /d "%~dp0"
echo Installing MCP package in mcp-server venv...

cd mcp-server
if not exist ".venv\Scripts\activate.bat" (
    python -m venv .venv
)
call .venv\Scripts\activate.bat
pip install -r requirements.txt -q
cd ..

echo.
echo Updating Claude Desktop config...
python setup-claude-mcp.py
