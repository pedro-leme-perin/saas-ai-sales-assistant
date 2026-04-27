# =============================================================================
# S64-A FIX v3 - Prettier auto-format api-key.guard.spec.ts + commit + push
# =============================================================================
# CI #247 (run 24992811563) failed Backend Lint with 12 prettier/prettier errors
# in apps/backend/test/unit/api-key.guard.spec.ts (formatting only, zero
# semantic issues). All marked "potentially fixable with --fix".
#
# Sandbox cannot run pnpm/prettier (S62 lesson #3 - pnpm symlink mount fails),
# so prettier --fix runs locally on Windows where the workspace is real.
#
# RUN:
#   cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
#   powershell -ExecutionPolicy Bypass -File .\scripts\s64a-prettier-fix.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"

Write-Host "=== S64-A prettier fix v3 ===" -ForegroundColor Cyan

# ---- 1. Sanity HEAD ----
$head = git rev-parse HEAD
Write-Host "HEAD: $head"
if ($head -notlike "1e4ff4c*") {
    Write-Host "WARN: HEAD is not 1e4ff4c (the previous failed commit)." -ForegroundColor Yellow
    $ans = Read-Host "Continue anyway? (y/N)"
    if ($ans -ne "y" -and $ans -ne "Y") { exit 1 }
}

# ---- 2. Run prettier --write on the spec ----
$specPath = "apps\backend\test\unit\api-key.guard.spec.ts"
if (-not (Test-Path $specPath)) {
    Write-Error "FATAL: $specPath not found"
    exit 1
}

Write-Host "Running prettier --write on spec..." -ForegroundColor Yellow
Push-Location apps\backend
try {
    pnpm exec prettier --write test/unit/api-key.guard.spec.ts
    if ($LASTEXITCODE -ne 0) {
        Write-Error "FATAL: prettier failed (exit $LASTEXITCODE)"
        exit 1
    }
}
finally {
    Pop-Location
}

# ---- 3. Verify lint now passes ----
Write-Host "Verifying lint passes..." -ForegroundColor Yellow
Push-Location apps\backend
try {
    pnpm exec eslint test/unit/api-key.guard.spec.ts
    if ($LASTEXITCODE -ne 0) {
        Write-Error "FATAL: eslint still fails after prettier --fix. Manual review needed."
        exit 1
    }
}
finally {
    Pop-Location
}
Write-Host "Lint clean" -ForegroundColor Green

# ---- 4. Free index.lock ----
if (Test-Path ".git\index.lock") {
    Get-Process -Name "Code" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue
}

# ---- 5. Stage + amend ----
git add $specPath
git add scripts\s64a-prettier-fix.ps1

$status = git status --porcelain --untracked-files=no
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "WARN: nothing staged. Maybe already amended." -ForegroundColor Yellow
    Write-Host "Will attempt push only..." -ForegroundColor Yellow
}
else {
    $msgFile = Join-Path $env:TEMP "s64a-prettier-msg.txt"
    git log -1 --pretty=%B | Out-File -FilePath $msgFile -Encoding utf8 -Force
    Add-Content -Path $msgFile -Value ''
    Add-Content -Path $msgFile -Value 'Amended v3: prettier --write applied to spec to fix 12 formatting errors.'
    Add-Content -Path $msgFile -Value 'Zero semantic changes - same 25 tests across 9 describes.'

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

# ---- 6. Force-with-lease push ----
git push origin main --force-with-lease
if ($LASTEXITCODE -ne 0) {
    Write-Error "FATAL: push failed (exit $LASTEXITCODE)"
    exit 1
}

Write-Host ""
Write-Host "=== S64-A v3 PUSHED ===" -ForegroundColor Green
Write-Host "Run scripts\s63-verify-ci.ps1 to monitor CI #248"
