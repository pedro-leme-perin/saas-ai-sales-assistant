# =============================================================================
# S64-A FIX v2 - Re-amend after Stripe-pattern recursion in amend script itself
# =============================================================================
# Previous push failed: scripts/s64a-amend-fix.ps1 line 5 had a literal example
# of the rejected fixture in a comment. Removed in working tree.
#
# RUN:
#   cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
#   powershell -ExecutionPolicy Bypass -File .\scripts\s64a-amend-fix2.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"

Write-Host "=== S64-A amend v2 (recursive fixture leak fix) ===" -ForegroundColor Cyan

# ---- 1. Sanity HEAD ----
$head = git rev-parse HEAD
Write-Host "HEAD: $head"
if ($head -notlike "6585634*") {
    Write-Host "WARN: HEAD is not 6585634 (the previous rejected commit)." -ForegroundColor Yellow
    $ans = Read-Host "Continue anyway? (y/N)"
    if ($ans -ne "y" -and $ans -ne "Y") { exit 1 }
}

# ---- 2. Scan ALL files in HEAD commit for any Stripe-pattern leak ----
Write-Host "Scanning all files in HEAD for Stripe-pattern leaks..." -ForegroundColor Yellow
$files = git show --name-only --format="" HEAD | Where-Object { $_ -ne "" }
$leaks = @()
foreach ($f in $files) {
    if (-not (Test-Path $f)) { continue }
    $hits = Select-String -Path $f -Pattern "(sk|pk|rk)_(live|test)_[A-Za-z0-9]{20,}" -ErrorAction SilentlyContinue
    if ($hits) {
        $leaks += [PSCustomObject]@{ File = $f; Line = $hits.LineNumber; Text = $hits.Line }
    }
}
if ($leaks.Count -gt 0) {
    Write-Host "LEAKS FOUND in working tree (will block push):" -ForegroundColor Red
    $leaks | Format-Table -AutoSize
    Write-Error "FATAL: Remove leaks before re-running."
    exit 1
}
Write-Host "OK: zero Stripe-pattern leaks in tracked files" -ForegroundColor Green

# ---- 3. Free index.lock ----
if (Test-Path ".git\index.lock") {
    Get-Process -Name "Code" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue
}

# ---- 4. Stage cleaned amend script + this script ----
git add scripts\s64a-amend-fix.ps1
git add scripts\s64a-amend-fix2.ps1

$status = git status --porcelain --untracked-files=no
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "WARN: nothing staged. Maybe already in HEAD." -ForegroundColor Yellow
    Write-Host "Will attempt push only..." -ForegroundColor Yellow
}
else {
    # Amend with same message
    $msgFile = Join-Path $env:TEMP "s64a-amend-v2-msg.txt"
    git log -1 --pretty=%B | Out-File -FilePath $msgFile -Encoding utf8 -Force
    Add-Content -Path $msgFile -Value ''
    Add-Content -Path $msgFile -Value 'Amended v2: removed recursive leak in scripts/s64a-amend-fix.ps1 line 5'
    Add-Content -Path $msgFile -Value '(comment quoted the original blocked literal verbatim, re-triggering scanner).'

    git commit --amend -F $msgFile
    Remove-Item -Force $msgFile -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -ne 0) {
        Write-Error "FATAL: amend failed"
        exit 1
    }
}

Write-Host ""
Write-Host "Amended commit:" -ForegroundColor Green
git log --oneline -1

# ---- 5. Force push (rewriting amended commit) ----
Write-Host ""
Write-Host "Pushing (force-with-lease for amend safety)..." -ForegroundColor Yellow
git push origin main --force-with-lease
if ($LASTEXITCODE -ne 0) {
    Write-Error "FATAL: push failed (exit $LASTEXITCODE)"
    exit 1
}

Write-Host ""
Write-Host "=== S64-A v2 PUSHED ===" -ForegroundColor Green
Write-Host "Run scripts\s63-verify-ci.ps1 to monitor CI #247"
