@echo off
title ContextOS MCP — Test Server Startup
cd /d "%~dp0mcp-server"
echo Testing ContextOS MCP server startup...
echo.
call .venv\Scripts\activate.bat
python server.py
echo.
echo Exit code: %ERRORLEVEL%
pause
