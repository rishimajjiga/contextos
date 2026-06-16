@echo off
title ContextOS MCP — Debug
cd /d "%~dp0mcp-server"
echo === Testing MCP Server Startup ===
echo.

if not exist ".venv\Scripts\python.exe" (
    echo ERROR: .venv not found. Run setup-claude-mcp.bat first.
    pause
    exit /b 1
)

echo Python path: %~dp0mcp-server\.venv\Scripts\python.exe
echo Server path: %~dp0mcp-server\server.py
echo.
echo Running server (it should wait silently for input - that means it works!)
echo If you see an error below, that is the problem.
echo Press Ctrl+C to stop.
echo.
set CONTEXTOS_API_URL=http://localhost:8000
set CONTEXTOS_API_KEY=ctxos_922dc111302c0883a8c43bb5d8f60396320ee6a72897675da064714a67daf57f
.venv\Scripts\python.exe server.py 2>&1
echo.
echo Exit code: %ERRORLEVEL%
pause
