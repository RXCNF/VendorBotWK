# Cleanup Old Test Scripts
# Kills test scripts running for more than 60 minutes

Write-Host "`n[CLEANUP] Killing old test scripts (>60 min)..." -ForegroundColor Yellow

$allProcs = Get-WmiObject Win32_Process -Filter "name='node.exe'"
$killed = 0

foreach ($proc in $allProcs) {
    $cmd = $proc.CommandLine
    if ($cmd -like '*VendorBot*test_*.js*' -or $cmd -like '*VendorBot*trace_*.js*') {
        $age = ((Get-Date) - $proc.ConvertToDateTime($proc.CreationDate)).TotalMinutes
        if ($age -gt 60) {
            Write-Host "  Killing PID $($proc.ProcessId) (age: $([math]::Round($age,0)) min)" -ForegroundColor Red
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
            $killed++
        }
    }
}

Write-Host "`n[DONE] Killed $killed old test processes" -ForegroundColor Green
