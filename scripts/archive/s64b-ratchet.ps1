# =============================================================================
# S64-B - Coverage threshold ratchet round 2 (data-driven post-S64-A measurement)
# =============================================================================
# Re-unify guards/ block (60/50/55/55 -> 75/65/75/75) since CI #248 measured
# guards/ at 97.44/84.62/93.33/97.22 (api-key.guard.spec.ts boost).
# Ratchet global +5pct (60/50/60/60 -> 65/55/65/65) locking real 69.48/61.42/65.69/69.94.
#
# RUN AFTER S64-B files are written by Claude (package.json, CLAUDE.md, ci.yml,
# PROJECT_HISTORY.md, scripts/s64b-check-guards-coverage.ps1):
#   cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
#   powershell -ExecutionPolicy Bypass -File .\scripts\s64b-ratchet.ps1
# =============================================================================

$ErrorActionPreference = "Stop"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"

Write-Host "=== S64-B threshold ratchet ===" -ForegroundColor Cyan

# ---- 1. Sanity HEAD ----
$head = git rev-parse HEAD
Write-Host "HEAD: $head"
if ($head -notlike "b4f5fd1*") {
    Write-Host "WARN: HEAD is not S64-A v3 (b4f5fd1)." -ForegroundColor Yellow
    $ans = Read-Host "Continue anyway? (y/N)"
    if ($ans -ne "y" -and $ans -ne "Y") { exit 1 }
}

# ---- 2. Verify package.json ratchet applied by Claude ----
Write-Host "[2/5] Verifying package.json thresholds..." -ForegroundColor Yellow
$pkg = Get-Content apps\backend\package.json -Raw | ConvertFrom-Json
$ct = $pkg.jest.coverageThreshold

$globalT = $ct.global
if ($globalT.statements -ne 65 -or $globalT.branches -ne 55 -or `
    $globalT.functions -ne 65 -or $globalT.lines -ne 65) {
    Write-Error "FATAL: global threshold not 65/55/65/65. Got: $($globalT | ConvertTo-Json -Compress)"
    exit 1
}
$guardsT = $ct.'./src/common/guards/'
if ($guardsT.statements -ne 75 -or $guardsT.branches -ne 65 -or `
    $guardsT.functions -ne 75 -or $guardsT.lines -ne 75) {
    Write-Error "FATAL: guards/ threshold not 75/65/75/75. Got: $($guardsT | ConvertTo-Json -Compress)"
    exit 1
}
Write-Host "OK: thresholds match S64-B target"

# ---- 3. Verify ci.yml has no NUL bytes (Edit tool corruption check) ----
Write-Host "[3/5] Checking ci.yml integrity (NUL byte scan)..." -ForegroundColor Yellow
$bytes = [IO.File]::ReadAllBytes(".github\workflows\ci.yml")
$hasNul = $false
foreach ($b in $bytes) {
    if ($b -eq 0) { $hasNul = $true; break }
}
if ($hasNul) {
    Write-Error "FATAL: ci.yml has NUL bytes - re-fetch from HEAD or re-write"
    exit 1
}
Write-Host "OK: ci.yml clean ($($bytes.Length) bytes, no NUL)"

# ---- 4. Free index.lock + stage ----
if (Test-Path ".git\index.lock") {
    Get-Process -Name "Code" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue
}

git add apps\backend\package.json
git add .github\workflows\ci.yml
git add CLAUDE.md
git add PROJECT_HISTORY.md
git add scripts\s64b-check-guards-coverage.ps1
git add scripts\s64b-ratchet.ps1

$status = git status --porcelain --untracked-files=no
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "WARN: nothing staged" -ForegroundColor Yellow
    exit 0
}

Write-Host "[4/5] Staged:" -ForegroundColor Yellow
git diff --cached --name-only

# ---- 5. Commit + push ----
$msgFile = Join-Path $env:TEMP "s64b-msg.txt"
$lines = @(
    'feat(s64-b): coverage threshold ratchet round 2 (data-driven post-S64-A)',
    '',
    'Re-unify guards/ block: 60/50/55/55 -> 75/65/75/75 (S63-D split reverted).',
    'Ratchet global: 60/50/60/60 -> 65/55/65/65 (+5 pct).',
    '',
    'CI #248 measured per-path coverage via gh run download + parse:',
    '  guards/      97.44 / 84.62 / 93.33 / 97.22  (api-key.guard.spec covered)',
    '  filters/     97.73 / 94.12 / 100   / 97.62',
    '  interceptors 100   / 94.12 / 100   / 100',
    '  resilience/  98.86 / 88.89 / 95    / 100',
    '  global       69.48 / 61.42 / 65.69 / 69.94',
    '',
    'guards/ headroom vs new floor: +22.44 / +19.62 / +18.33 / +22.22 pct.',
    'Global headroom vs new floor:  +4.48  / +6.42  / +0.69  / +4.94  pct.',
    'Functions global at 0.69 pct margin - alert for next ratchet round.',
    '',
    'S63-D split (added in commit b8b9861) is now obsolete and reverted.',
    'Pendency S64 closed.',
    '',
    'Updates ci.yml threshold display + CLAUDE.md S13 + PROJECT_HISTORY.md.',
    'Adds s64b-check-guards-coverage.ps1 (gh artifact parser + decision matrix).',
    '',
    'Reference: enterprise S1 (correctness > velocity) - locking measured state.'
)
$lines | Out-File -FilePath $msgFile -Encoding utf8 -Force

git commit -F $msgFile
$ec = $LASTEXITCODE
Remove-Item -Force $msgFile -ErrorAction SilentlyContinue
if ($ec -ne 0) {
    Write-Error "FATAL: commit failed (exit $ec)"
    exit 1
}

Write-Host ""
Write-Host "[5/5] Commit:" -ForegroundColor Green
git log --oneline -1

git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Error "FATAL: push failed"
    exit 1
}

Write-Host ""
Write-Host "=== S64-B PUSHED ===" -ForegroundColor Green
Write-Host "Run scripts\s63-verify-ci.ps1 to monitor CI #249"
Write-Host ""
Write-Host "Expected pass:"
Write-Host "  global       69.48 / 61.42 / 65.69 / 69.94 vs 65/55/65/65 (margin 4.48/6.42/0.69/4.94)"
Write-Host "  guards/      97.44 / 84.62 / 93.33 / 97.22 vs 75/65/75/75 (margin 22+/19+/18+/22+)"
Write-Host "  filters/     97.73 / 94.12 / 100   / 97.62 vs 75/65/75/75 (margin 22+/29+/25+/22+)"
Write-Host "  interceptors 100   / 94.12 / 100   / 100   vs 75/65/75/75 (margin 25+/29+/25+/25+)"
Write-Host "  resilience/  98.86 / 88.89 / 95    / 100   vs 75/65/75/75 (margin 23+/23+/20+/25+)"
