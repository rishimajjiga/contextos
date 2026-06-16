@echo off
title ContextOS — Show Claude Config
echo === claude_desktop_config.json content ===
echo.
type "%APPDATA%\Claude\claude_desktop_config.json"
echo.
echo.
echo === File location ===
echo %APPDATA%\Claude\claude_desktop_config.json
echo.
pause
