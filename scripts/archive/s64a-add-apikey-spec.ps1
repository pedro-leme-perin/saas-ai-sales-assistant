# =============================================================================
# S64-A - Add api-key.guard.spec.ts (FIX: commit -F file, no -m heredoc)
# =============================================================================
# Adds dedicated spec for ApiKeyGuard + ci.yml threshold display fix.
# Closes pending S63-D root cause: api-key.guard.ts had no dedicated spec.
#
# RUN AFTER S63-D pushed (HEAD ~ b8b9861):
#   cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
#   powershell -ExecutionPolicy Bypass -File .\scripts\s64a-add-apikey-spec.ps1
#
# FIX vs original v1: previous script used `git commit -m $heredoc` and the
# embedded literal " in the message broke PowerShell-to-git arg parsing
# (multiple `pathspec did not match` errors). This version writes the message
# to a temp file and uses `git commit -F file` which preserves bytes verbatim.
# =============================================================================

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"

Write-Host "=== S64-A: add api-key.guard.spec.ts (v2 with -F file fix) ===" -ForegroundColor Cyan
Set-Location $repoRoot

# ---- 1. Sanity HEAD ----
$head = git rev-parse HEAD
Write-Host "HEAD: $head"
if ($head -notlike "b8b9861*") {
    Write-Host "WARN: HEAD is not S63-D (b8b9861). Pull latest or check state." -ForegroundColor Yellow
    $ans = Read-Host "Continue? (y/N)"
    if ($ans -ne "y" -and $ans -ne "Y") { exit 1 }
}

# ---- 2. Sanity spec ----
$specPath = "apps\backend\test\unit\api-key.guard.spec.ts"
if (-not (Test-Path $specPath)) {
    Write-Error "FATAL: $specPath not found"
    exit 1
}
$specLines = (Get-Content $specPath | Measure-Object -Line).Lines
Write-Host "Spec: $specPath ($specLines lines)"
if ($specLines -lt 380) {
    Write-Error "FATAL: spec file looks truncated ($specLines lines, expected 400+)"
    exit 1
}

# ---- 3. Free index.lock ----
if (Test-Path ".git\index.lock") {
    Get-Process -Name "Code" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue
}

# ---- 4. Stage all S64-A files ----
git add apps\backend\test\unit\api-key.guard.spec.ts
git add scripts\s64a-add-apikey-spec.ps1
git add .github\workflows\ci.yml
# CLAUDE.md and PROJECT_HISTORY.md may have been staged earlier or have local changes
git add CLAUDE.md
git add PROJECT_HISTORY.md

$status = git status --porcelain --untracked-files=no
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "WARN: nothing staged. Files may already be committed." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Staged files:" -ForegroundColor Cyan
git diff --cached --name-only

# ---- 5. Write commit message to temp file (avoids -m arg parsing issues) ----
$msgFile = Join-Path $env:TEMP "s64a-commit-msg.txt"
$lines = @(
    'test(s64-a): add dedicated unit spec for ApiKeyGuard + ci.yml threshold display fix',
    '',
    'Closes pending S63-D root cause: api-key.guard.ts was the only guard without',
    'a dedicated spec, dragging src/common/guards/ coverage to 62.17/53.84/60/61.11',
    '(forced S63-D split: guards/ at 60/50/55/55, others at 75/65/75/75).',
    '',
    'Spec covers 25 scenarios across 9 describe blocks:',
    '  - header validation (2):     missing X-API-Key, fail-fast no DB call',
    '  - DB lookup (3):             SHA-256 hashing, unknown 401, company select',
    '  - active status (2):         inactive 401, no usage increment on inactive',
    '  - expiration (3):            past 401, future OK, null OK',
    '  - scope validation (5):      empty OK, all-of, missing one, empty vs required, error lists',
    '  - per-key rate limit (6):    null skip, zero skip, prefix, 429, X-RateLimit headers, clamp',
    '  - usage counter (2):         increment+lastUsedAt, fire-and-forget on update fail',
    '  - request context (1):       attaches apiKeyCompanyId/Scopes/Name',
    '  - happy path (1):            full pipeline integration',
    '',
    'Mocks at Infrastructure layer only (PrismaService, CacheService) per CLAUDE.md S9.',
    '',
    'Also fixes ci.yml step Coverage-summary-to-PR hardcoded threshold display',
    '(was stuck at S62 floor 40/30/40/40 + 60 pct security; now matches S63-D actual:',
    'global 60/50/60/60, guards/ 60/50/55/55, filters/interceptors/resilience/ 75/65/75/75).',
    '',
    'Expected impact: guards/ coverage rises from ~62 pct to >75 pct, enabling',
    'S64-B to re-unify the threshold block at 75/65/75/75 (revert S63-D split).',
    '',
    'Reference: Building Microservices Cap. 11 (API Security)',
    'Reference: Release It! (Fail Fast, Bulkhead)',
    'Reference: System Design Interview Cap. 4 (sliding window rate limit)'
)
$lines | Out-File -FilePath $msgFile -Encoding utf8 -Force

git commit -F $msgFile
$commitExit = $LASTEXITCODE
Remove-Item -Force $msgFile -ErrorAction SilentlyContinue
if ($commitExit -ne 0) {
    Write-Error "FATAL: git commit failed (exit $commitExit)"
    exit 1
}

Write-Host ""
Write-Host "Commit:" -ForegroundColor Green
git log --oneline -1
Write-Host ""

git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Error "FATAL: git push failed"
    exit 1
}

Write-Host ""
Write-Host "=== S64-A PUSHED ===" -ForegroundColor Green
Write-Host "Run scripts\s63-verify-ci.ps1 to monitor CI #247"
Write-Host ""
Write-Host "After CI #247 green, check coverage summary in PR step output."
Write-Host "If guards/ measured >= 75/65/75/75, run S64-B (re-unify block)."
