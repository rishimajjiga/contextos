@echo off
title ContextOS — Generate API Key
cd /d "%~dp0backend"
call .venv\Scripts\activate.bat
python generate_api_key.py
