# VendorBot Process Analyzer and Cleanup
# Usage: .\analyze-processes.ps1

Write-Host "`n=== VendorBot Process Analysis ===" -ForegroundColor Cyan

# Get all node processes with VendorBot
$allProcs = Get-WmiObject Win32_Process -Filter "name='node.exe'"
$vendorBotProcs = @()

foreach ($proc in $allProcs) {
    $cmd = $proc.CommandLine
    if ($cmd -like '*VendorBot*') {
        $script = 'unknown'
        $category = 'other'
        
        # Identify script type
        if ($cmd -match 'src\\server\.js') {
            $script = '[MAIN SERVER]'
            $category = 'server'
        }
        elseif ($cmd -match 'test_query\.js') {
            $script = 'test_query'
            $category = 'test'
        }
        elseif ($cmd -match 'test_search\.js') {
            $script = 'test_search'
            $category = 'test'
        }
        elseif ($cmd -match 'trace_scores\.js') {
            $script = 'trace_scores'
            $category = 'test'
        }
        elseif ($cmd -match 'test_fix\.js') {
            $script = 'test_fix'
            $category = 'test'
        }
        elseif ($cmd -match 'test_stats\.js') {
            $script = 'test_stats'
            $category = 'test'
        }
        elseif ($cmd -match 'test_province_filter\.js') {
            $script = 'test_province'
            $category = 'test'
        }
        elseif ($cmd -match 'test_city_detection\.js') {
            $script = 'test_city'
            $category = 'test'
        }
        elseif ($cmd -match '\-e.*knowledgeBase') {
            $script = 'kb-inline'
            $category = 'test'
        }
        
        $vendorBotProcs += [PSCustomObject]@{
            PID      = $proc.ProcessId
            Script   = $script
            Category = $category
            Memory   = [math]::Round($proc.WorkingSetSize / 1MB, 1)
            Started  = $proc.ConvertToDateTime($proc.CreationDate).ToString("HH:mm")
            Age      = ((Get-Date) - $proc.ConvertToDateTime($proc.CreationDate)).TotalMinutes
        }
    }
}

# Display categorized
Write-Host "`n[1] MAIN SERVER:" -ForegroundColor Green
$servers = $vendorBotProcs | Where-Object { $_.Category -eq 'server' } | Sort-Object PID
if ($servers) {
    $servers | Format-Table PID, Script, @{Name = "Mem(MB)"; Expression = { $_.Memory } }, Started, @{Name = "RunTime(min)"; Expression = { [math]::Round($_.Age, 0) } } -AutoSize
}
else {
    Write-Host "    [WARNING] No main server running!" -ForegroundColor Red
}

Write-Host "`n[2] TEST SCRIPTS:" -ForegroundColor Yellow
$tests = $vendorBotProcs | Where-Object { $_.Category -eq 'test' } | Sort-Object Age -Descending
if ($tests) {
    $tests | Format-Table PID, Script, @{Name = "Mem(MB)"; Expression = { $_.Memory } }, Started, @{Name = "RunTime(min)"; Expression = { [math]::Round($_.Age, 0) } } -AutoSize
    
    # Find duplicates
    $grouped = $tests | Group-Object Script
    $duplicates = $grouped | Where-Object { $_.Count -gt 1 }
    
    if ($duplicates) {
        Write-Host "`n[DUPLICATES FOUND]:" -ForegroundColor Red
        foreach ($dup in $duplicates) {
            Write-Host "    $($dup.Name): $($dup.Count) instances" -ForegroundColor Yellow
            $dup.Group | Format-Table PID, @{Name = "Mem(MB)"; Expression = { $_.Memory } }, Started -AutoSize
        }
    }
    
    # Find old processes (> 60 minutes)
    $old = $tests | Where-Object { $_.Age -gt 60 }
    if ($old) {
        Write-Host "`n[OLD PROCESSES (>60 min)]:" -ForegroundColor Red
        $old | Format-Table PID, Script, @{Name = "Mem(MB)"; Expression = { $_.Memory } }, Started, @{Name = "RunTime(min)"; Expression = { [math]::Round($_.Age, 0) } } -AutoSize
    }
}
else {
    Write-Host "    [INFO] No test scripts running" -ForegroundColor Gray
}

# Summary
Write-Host "`n[SUMMARY]:" -ForegroundColor Cyan
Write-Host "  Total VendorBot processes: $($vendorBotProcs.Count)"
Write-Host "  Servers: $(($vendorBotProcs | Where-Object {$_.Category -eq 'server'}).Count)"
Write-Host "  Tests: $(($vendorBotProcs | Where-Object {$_.Category -eq 'test'}).Count)"
Write-Host "  Total Memory: $([math]::Round(($vendorBotProcs | Measure-Object -Property Memory -Sum).Sum, 1)) MB"

# Cleanup suggestion
Write-Host "`n[CLEANUP OPTIONS]:" -ForegroundColor Yellow
Write-Host "  To kill old test scripts (>60 min):"
Write-Host "  .\cleanup-old-tests.ps1" -ForegroundColor Green
Write-Host "`n  To kill duplicates:"
Write-Host "  .\cleanup-duplicates.ps1" -ForegroundColor Green
Write-Host "`n================================`n" -ForegroundColor Cyan
