@echo off
set SETTINGS=%USERPROFILE%\.claude\settings.json
set OUT=%USERPROFILE%\.claude\settings.json

echo === Current settings.json ===
type "%SETTINGS%"
echo.
echo.

echo === Writing ContextOS MCP to settings.json ===

REM Use Python to merge properly (keeps existing settings)
python -c "
import json, os, sys

settings_path = os.path.expanduser(r'~\.claude\settings.json')

# Load existing settings
try:
    with open(settings_path, 'r', encoding='utf-8') as f:
        settings = json.load(f)
    print('Loaded existing settings.json')
except:
    settings = {}
    print('Creating new settings.json')

# Add our MCP server
if 'mcpServers' not in settings:
    settings['mcpServers'] = {}

settings['mcpServers']['contextos'] = {
    'type': 'stdio',
    'command': 'cmd',
    'args': ['/c', r'C:\Users\Rishi\OneDrive\Desktop\contextOS\contextos\mcp-server\run-server.bat']
}

with open(settings_path, 'w', encoding='utf-8') as f:
    json.dump(settings, f, indent=2)

print('Done! ContextOS MCP added to settings.json')
print()
print('Entry added:')
print(json.dumps(settings['mcpServers']['contextos'], indent=2))
"

echo.
echo === Done ===
echo Restart Claude Desktop for changes to take effect.
pause
