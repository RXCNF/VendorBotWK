# VendorBot Server Restart Script
# Usage: .\restart-server.ps1

Write-Host "[*] Restarting VendorBot Server..." -ForegroundColor Cyan

# Find and kill process using port 3000
$processes = @(Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess)
if ($processes) {
    foreach ($processId in $processes) {
        if ($processId -ne 0) {
            Write-Host "[STOP] Stopping old server (PID: $processId)..." -ForegroundColor Yellow
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 1
}

# Start new server
Write-Host "[START] Starting new server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; node src/server.js"

Write-Host "[OK] Server restart complete!" -ForegroundColor Green
Write-Host "[INFO] Server running at http://localhost:3000" -ForegroundColor Cyan
