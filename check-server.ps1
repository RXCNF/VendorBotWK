# VendorBot Server Status Check
# Usage: .\check-server.ps1

Write-Host "`n=== VendorBot Server Status ===" -ForegroundColor Cyan

# Check port 3000 (VendorBot main server)
Write-Host "`n[1] Port 3000 Status:" -ForegroundColor Yellow
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($port3000) {
    Write-Host "    [RUNNING] Port 3000 is in use" -ForegroundColor Green
    $port3000 | Select-Object LocalAddress, LocalPort, State, OwningProcess | Format-Table -AutoSize
}
else {
    Write-Host "    [STOPPED] Port 3000 is available" -ForegroundColor Red
}

# Check all Node.js processes
Write-Host "`n[2] Node.js Processes:" -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Select-Object Id, 
    @{Name = "Name"; Expression = { $_.ProcessName } },
    @{Name = "Started"; Expression = { $_.StartTime.ToString("HH:mm:ss") } },
    @{Name = "CPU(s)"; Expression = { [math]::Round($_.CPU, 2) } },
    @{Name = "Memory(MB)"; Expression = { [math]::Round($_.WorkingSet64 / 1MB, 2) } } | Format-Table -AutoSize
    Write-Host "    Total Node.js processes: $($nodeProcesses.Count)" -ForegroundColor Cyan
}
else {
    Write-Host "    [INFO] No Node.js processes running" -ForegroundColor Gray
}

# Check common ports
Write-Host "`n[3] Common Ports Status:" -ForegroundColor Yellow
$commonPorts = @(3000, 3001, 5000, 8080)
foreach ($port in $commonPorts) {
    $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connection) {
        Write-Host "    Port $port : [LISTENING] PID: $($connection.OwningProcess)" -ForegroundColor Green
    }
    else {
        Write-Host "    Port $port : [AVAILABLE]" -ForegroundColor Gray
    }
}

# Show running commands in VendorBot directory
Write-Host "`n[4] VendorBot Directory Processes:" -ForegroundColor Yellow
$allNodeProcesses = Get-WmiObject Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue
$vendorBotProcesses = $allNodeProcesses | Where-Object { $_.CommandLine -like "*VendorBot*" }
if ($vendorBotProcesses) {
    $vendorBotProcesses | ForEach-Object {
        Write-Host "    PID: $($_.ProcessId)" -ForegroundColor Cyan
        Write-Host "    CMD: $($_.CommandLine)" -ForegroundColor Gray
    }
}
else {
    Write-Host "    [INFO] No VendorBot processes found" -ForegroundColor Gray
}

Write-Host "`n================================`n" -ForegroundColor Cyan
