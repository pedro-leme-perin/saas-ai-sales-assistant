# Extract jest threshold violations from failed CI run
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\s63-fetch-fail.ps1

$ErrorActionPreference = "Continue"

$runId = "24946996536"
$outFile = "s63-fail.log"

Write-Host "Fetching failed logs for run $runId..." -ForegroundColor Cyan
gh run view $runId --log-failed > $outFile 2>&1

if (-not (Test-Path $outFile) -or (Get-Item $outFile).Length -eq 0) {
    Write-Host "Empty log. Try: gh run view $runId --log > s63-fail.log" -ForegroundColor Yellow
    gh run view $runId --log > $outFile 2>&1
}

Write-Host ""
Write-Host "=== Lines containing 'threshold' (5 lines context) ===" -ForegroundColor Cyan
Get-Content $outFile | Select-String -Pattern "threshold" -Context 0, 5 | Select-Object -First 30

Write-Host ""
Write-Host "=== Lines containing 'Jest:' (5 lines context) ===" -ForegroundColor Cyan
Get-Content $outFile | Select-String -Pattern "Jest:" -Context 0, 5 | Select-Object -First 30

Write-Host ""
Write-Host "=== Lines with coverage percentages (statements/branches/functions/lines) ===" -ForegroundColor Cyan
Get-Content $outFile | Select-String -Pattern "Statements\s*:|Branches\s*:|Functions\s*:|Lines\s*:" | Select-Object -First 30

Write-Host ""
Write-Host "=== Lines mentioning 'common/(guards|filters|interceptors|resilience)' ===" -ForegroundColor Cyan
Get-Content $outFile | Select-String -Pattern "common/(guards|filters|interceptors|resilience)" -Context 0, 2 | Select-Object -First 30

Write-Host ""
Write-Host "=== Last 50 lines of failed log ===" -ForegroundColor Cyan
Get-Content $outFile | Select-Object -Last 50

Write-Host ""
Write-Host "Full log: $outFile ($(((Get-Item $outFile).Length / 1KB).ToString('F1')) KB)" -ForegroundColor Green
