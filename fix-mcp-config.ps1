# fix-mcp-config.ps1 — Diagnose and fix the ContextOS MCP config

$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$runBat     = "C:\Users\Rishi\OneDrive\Desktop\contextOS\contextos\mcp-server\run-server.bat"

Write-Host ""
Write-Host "=== Current config ===" -ForegroundColor Cyan
if (Test-Path $configPath) {
    $content = Get-Content $configPath -Raw
    Write-Host $content
} else {
    Write-Host "CONFIG FILE NOT FOUND at $configPath" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Writing correct config ===" -ForegroundColor Cyan

$newConfig = @{
    mcpServers = @{
        contextos = @{
            command = "cmd"
            args    = @("/c", $runBat)
        }
    }
} | ConvertTo-Json -Depth 10

Set-Content -Path $configPath -Value $newConfig -Encoding UTF8
Write-Host "Written!" -ForegroundColor Green
Write-Host ""
Write-Host "=== Verifying ===" -ForegroundColor Cyan
Get-Content $configPath -Raw | Write-Host

Write-Host ""
Write-Host "Done. Now FULLY QUIT Claude (tray icon -> Quit) and reopen it." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to close"
