@echo off
set OUT=C:\Users\Rishi\OneDrive\Desktop\contextOS\contextos\diagnose-output.txt
echo === Diagnosing MCP config === > %OUT%
echo. >> %OUT%

echo AppData Claude config: >> %OUT%
if exist "%APPDATA%\Claude\claude_desktop_config.json" (
    echo FOUND >> %OUT%
    type "%APPDATA%\Claude\claude_desktop_config.json" >> %OUT%
) else (
    echo NOT FOUND >> %OUT%
)

echo. >> %OUT%
echo .claude folder: >> %OUT%
if exist "%USERPROFILE%\.claude" (
    echo FOUND >> %OUT%
    dir "%USERPROFILE%\.claude" /b >> %OUT%
) else (
    echo NOT FOUND >> %OUT%
)

echo. >> %OUT%
echo .claude.json file: >> %OUT%
if exist "%USERPROFILE%\.claude.json" (
    echo FOUND >> %OUT%
    type "%USERPROFILE%\.claude.json" >> %OUT%
) else (
    echo NOT FOUND >> %OUT%
)

echo Done. Results in diagnose-output.txt
