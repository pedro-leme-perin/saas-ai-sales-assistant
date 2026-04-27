# =============================================================================
# S64-B step 1 - Download coverage artifact from latest run, parse per-path
# =============================================================================
# Decides whether guards/ measured coverage now reaches 75/65/75/75 to allow
# re-unifying the threshold block (revert S63-D split).
#
# RUN AFTER CI #248 green:
#   cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
#   powershell -ExecutionPolicy Bypass -File .\scripts\s64b-check-guards-coverage.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"

$head = git rev-parse HEAD
Write-Host "HEAD: $head" -ForegroundColor Cyan

$runId = gh run list --commit $head --limit 1 --json databaseId --jq '.[0].databaseId'
if (-not $runId) {
    Write-Error "No CI run found for HEAD"
    exit 1
}
Write-Host "Run ID: $runId" -ForegroundColor Cyan

# Download artifacts
$artifactDir = "coverage-artifact-$runId"
if (Test-Path $artifactDir) { Remove-Item -Recurse -Force $artifactDir }
New-Item -ItemType Directory -Path $artifactDir | Out-Null

Write-Host "Downloading coverage artifact..." -ForegroundColor Yellow
gh run download $runId --dir $artifactDir
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to download artifact"
    exit 1
}

# Find coverage-summary.json (could be in subdir)
$summaryFile = Get-ChildItem -Path $artifactDir -Recurse -Filter "coverage-summary.json" | Select-Object -First 1
if (-not $summaryFile) {
    Write-Host "coverage-summary.json not found - listing artifacts:" -ForegroundColor Yellow
    Get-ChildItem -Path $artifactDir -Recurse -File | Select-Object FullName, Length
    exit 1
}
Write-Host "Found: $($summaryFile.FullName)" -ForegroundColor Green

# Parse JSON and extract per-path
$summary = Get-Content $summaryFile.FullName -Raw | ConvertFrom-Json

# Filter paths under src/common/{guards,filters,interceptors,resilience}/
$securityPaths = @('guards', 'filters', 'interceptors', 'resilience')

Write-Host ""
Write-Host "=== Per-path coverage (security paths) ===" -ForegroundColor Cyan
Write-Host ("{0,-50} {1,8} {2,8} {3,8} {4,8}" -f "File", "Stmt", "Br", "Fn", "Lines")
Write-Host ("-" * 86)

# Aggregators
$agg = @{}
foreach ($p in $securityPaths) {
    $agg[$p] = @{ stmtCov = 0; stmtTot = 0; brCov = 0; brTot = 0; fnCov = 0; fnTot = 0; linesCov = 0; linesTot = 0; files = 0 }
}

$summary.PSObject.Properties | ForEach-Object {
    $key = $_.Name
    if ($key -eq "total") { return }

    foreach ($p in $securityPaths) {
        if ($key -match "src[\\/]common[\\/]$p[\\/]") {
            $entry = $_.Value
            $stmtPct = [math]::Round($entry.statements.pct, 2)
            $brPct = [math]::Round($entry.branches.pct, 2)
            $fnPct = [math]::Round($entry.functions.pct, 2)
            $linesPct = [math]::Round($entry.lines.pct, 2)

            $shortName = $key -replace '.*src[\\/]common[\\/]', ''
            Write-Host ("{0,-50} {1,7}% {2,7}% {3,7}% {4,7}%" -f $shortName, $stmtPct, $brPct, $fnPct, $linesPct)

            $agg[$p].stmtCov += $entry.statements.covered
            $agg[$p].stmtTot += $entry.statements.total
            $agg[$p].brCov += $entry.branches.covered
            $agg[$p].brTot += $entry.branches.total
            $agg[$p].fnCov += $entry.functions.covered
            $agg[$p].fnTot += $entry.functions.total
            $agg[$p].linesCov += $entry.lines.covered
            $agg[$p].linesTot += $entry.lines.total
            $agg[$p].files++
            break
        }
    }
}

Write-Host ""
Write-Host "=== Aggregated per security path ===" -ForegroundColor Cyan
Write-Host ("{0,-15} {1,4} {2,8} {3,8} {4,8} {5,8}" -f "Path", "Files", "Stmt", "Br", "Fn", "Lines")
Write-Host ("-" * 60)

foreach ($p in $securityPaths) {
    $a = $agg[$p]
    if ($a.files -eq 0) {
        Write-Host ("{0,-15} (no files matched)" -f $p)
        continue
    }
    $stmtPct = if ($a.stmtTot -gt 0) { [math]::Round(100 * $a.stmtCov / $a.stmtTot, 2) } else { 100 }
    $brPct = if ($a.brTot -gt 0) { [math]::Round(100 * $a.brCov / $a.brTot, 2) } else { 100 }
    $fnPct = if ($a.fnTot -gt 0) { [math]::Round(100 * $a.fnCov / $a.fnTot, 2) } else { 100 }
    $linesPct = if ($a.linesTot -gt 0) { [math]::Round(100 * $a.linesCov / $a.linesTot, 2) } else { 100 }

    Write-Host ("{0,-15} {1,4} {2,7}% {3,7}% {4,7}% {5,7}%" -f $p, $a.files, $stmtPct, $brPct, $fnPct, $linesPct)
}

Write-Host ""
Write-Host "=== Decision matrix S64-B ===" -ForegroundColor Cyan
$g = $agg['guards']
if ($g.files -gt 0) {
    $gStmt = [math]::Round(100 * $g.stmtCov / $g.stmtTot, 2)
    $gBr = [math]::Round(100 * $g.brCov / $g.brTot, 2)
    $gFn = [math]::Round(100 * $g.fnCov / $g.fnTot, 2)
    $gLines = [math]::Round(100 * $g.linesCov / $g.linesTot, 2)

    Write-Host "guards/ measured: stmt $gStmt / br $gBr / fn $gFn / lines $gLines"
    Write-Host ""
    if ($gStmt -ge 75 -and $gBr -ge 65 -and $gFn -ge 75 -and $gLines -ge 75) {
        Write-Host "[GO] guards/ ALL >= 75/65/75/75 - safe to re-unify block" -ForegroundColor Green
        Write-Host "Run S64-B (re-unify): set guards/ threshold back to 75/65/75/75"
    }
    elseif ($gStmt -ge 65 -and $gBr -ge 55 -and $gFn -ge 65 -and $gLines -ge 65) {
        Write-Host "[PARTIAL] guards/ in 65-75 pct range - safe ratchet to 65/55/65/65" -ForegroundColor Yellow
    }
    else {
        Write-Host "[HOLD] guards/ below 65 pct - keep S63-D split (60/50/55/55)" -ForegroundColor Red
    }
}

# Save full summary for inspection
$saveAs = "coverage-per-path-$runId.json"
Copy-Item $summaryFile.FullName $saveAs -Force
Write-Host ""
Write-Host "Full summary saved: $saveAs" -ForegroundColor Cyan
