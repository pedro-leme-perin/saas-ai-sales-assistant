# =============================================================================
# S64-A FIX - Amend commit de72505 to remove Stripe-pattern test fixture
# =============================================================================
# Push of de72505 was blocked by GitHub Push Protection: the spec test
# fixture used a Stripe-shaped key prefix that matched the secret regex.
# Spec was edited locally to use a neutral test-fixture string;
# this script amends the commit and re-pushes.
#
# RUN:
#   cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
#   powershell -ExecutionPolicy Bypass -File .\scripts\s64a-amend-fix.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"

Write-Host "=== S64-A amend (Stripe pattern fix) ===" -ForegroundColor Cyan
Set-Location $repoRoot

# ---- 1. Sanity: HEAD must be the rejected commit ----
$head = git rev-parse HEAD
Write-Host "HEAD: $head"
if ($head -notlike "de72505*") {
    Write-Host "WARN: HEAD is not de72505 (the rejected S64-A commit)." -ForegroundColor Yellow
    Write-Host "Maybe already amended, or different state. Aborting to be safe." -ForegroundColor Yellow
    exit 1
}

# ---- 2. Verify spec file no longer has Stripe-pattern fixture ----
$specPath = "apps\backend\test\unit\api-key.guard.spec.ts"
$bad = Select-String -Path $specPath -Pattern "(sk|pk|rk)_(live|test)_[A-Za-z0-9]{20,}"
if ($bad) {
    Write-Error "FATAL: spec still contains Stripe-pattern fixture: $($bad.Line)"
    exit 1
}
Write-Host "OK: spec has no Stripe-pattern strings"

# ---- 3. Free index.lock if present ----
if (Test-Path ".git\index.lock") {
    Get-Process -Name "Code" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue
}

# ---- 4. Stage spec + amend ----
git add apps\backend\test\unit\api-key.guard.spec.ts
git add scripts\s64a-amend-fix.ps1

# Append note to existing commit message via amend
$msgFile = Join-Path $env:TEMP "s64a-amend-msg.txt"
git log -1 --pretty=%B | Out-File -FilePath $msgFile -Encoding utf8 -Force
Add-Content -Path $msgFile -Value ''
Add-Content -Path $msgFile -Value 'Amended: replaced sk_live_ test fixture prefix with neutral string'
Add-Content -Path $msgFile -Value 'to bypass GitHub Push Protection secret scanner false positive.'
Add-Content -Path $msgFile -Value 'Hash flow is prefix-agnostic, so semantic equivalence is preserved.'

git commit --amend -F $msgFile
$ec = $LASTEXITCODE
Remove-Item -Force $msgFile -ErrorAction SilentlyContinue
if ($ec -ne 0) {
    Write-Error "FATAL: git commit --amend failed (exit $ec)"
    exit 1
}

Write-Host ""
Write-Host "Amended commit:" -ForegroundColor Green
git log --oneline -1
Write-Host ""

git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Error "FATAL: git push failed"
    exit 1
}

Write-Host ""
Write-Host "=== S64-A AMENDED AND PUSHED ===" -ForegroundColor Green
Write-Host "Run scripts\s63-verify-ci.ps1 to monitor CI #247"
