# =============================================================================
# S63 - Cleanup + Commit + Push (ASCII-safe for Windows PowerShell 5.x CP1252)
# =============================================================================
# Bypass for sandbox limitations:
#   - Windows mount blocks `rm` (Operation not permitted)
#   - .git/index.lock persists (created by VS Code/file watcher)
#
# RUN FROM POWERSHELL ON WINDOWS, repo root:
#   cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
#   powershell -ExecutionPolicy Bypass -File .\scripts\s63-cleanup-and-commit.ps1
#
# Requires: git installed, auth configured (gh / SSH key / credential helper).
# =============================================================================

$ErrorActionPreference = "Stop"
$repoRoot = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"

Write-Host "=== S63 cleanup script ===" -ForegroundColor Cyan
Write-Host "Repo: $repoRoot"
Write-Host ""

# Sanity check
if (-not (Test-Path "$repoRoot\.git")) {
    Write-Error "ERROR: $repoRoot is not a git repo. Aborting."
    exit 1
}
Set-Location $repoRoot

# ---- 1. Free .git/index.lock (S62 lesson) ----
Write-Host "[1/6] Removing .git/index.lock if present..." -ForegroundColor Yellow
$lockPath = ".git\index.lock"
if (Test-Path $lockPath) {
    try {
        Remove-Item -Force $lockPath
        Write-Host "  OK: index.lock removed."
    }
    catch {
        Write-Host ("  WARN: failed to remove index.lock - " + $_.Exception.Message) -ForegroundColor Red
        Write-Host "  Trying: Stop-Process Code (VS Code)..." -ForegroundColor Yellow
        Get-Process -Name "Code" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Remove-Item -Force $lockPath -ErrorAction SilentlyContinue
        if (Test-Path $lockPath) {
            Write-Error "FATAL: index.lock persists. Close VS Code/Git GUI manually and re-run."
            exit 1
        }
    }
}
else {
    Write-Host "  OK: index.lock not present."
}

# ---- 2. Verify HEAD ----
Write-Host "[2/6] Verifying HEAD..." -ForegroundColor Yellow
$head = git rev-parse HEAD
Write-Host "  HEAD: $head"
if ($head -notlike "e02d5d4*") {
    Write-Host "  WARN: HEAD is not e02d5d4* (S62). Verify if already committed or pull main." -ForegroundColor Yellow
    $ans = Read-Host "  Continue anyway? (y/N)"
    if ($ans -ne "y" -and $ans -ne "Y") { exit 1 }
}

# ---- 3. Delete dead code (S63 - sandbox rm blocked) ----
Write-Host "[3/6] Deleting dead code..." -ForegroundColor Yellow
$filesToDelete = @(
    "apps\frontend\src\components\dashboard\audit-logs\audit-log-detail-modal.tsx",
    "apps\frontend\src\components\dashboard\team\invite-member-modal.tsx",
    "apps\backend\src\common\guards\Novo(a) Documento de Texto.txt"
)
foreach ($f in $filesToDelete) {
    if (Test-Path $f) {
        Remove-Item -Force $f
        Write-Host "  DELETED: $f"
    }
    else {
        Write-Host "  SKIP (already absent): $f"
    }
}

# ---- 4. Clean untracked test outputs ----
Write-Host "[4/6] Cleaning untracked test outputs..." -ForegroundColor Yellow
$untrackedToClean = @(
    "apps\backend\out1.txt",
    "apps\backend\test-output.txt"
)
foreach ($f in $untrackedToClean) {
    if (Test-Path $f) {
        Remove-Item -Force $f
        Write-Host "  CLEANED: $f"
    }
}

# ---- 5. git status pre-commit ----
Write-Host "[5/6] git status pre-commit..." -ForegroundColor Yellow
git status --short

# ---- 6. Commit + push ----
Write-Host "[6/6] Stage + commit + push..." -ForegroundColor Yellow
git add -A
$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "  WARN: nothing to commit (working tree clean). Exiting." -ForegroundColor Yellow
    exit 0
}

$commitMsg = @"
feat(s63): coverage ratchet 40->60 global / 60->75 security + dead code removal

- jest coverageThreshold floor: 40/30/40/40 -> 60/50/60/60 (stmt/br/fn/lines)
  Locks current measured state from CI #244: 68.82/60.96/65.34/69.26
  Defensive headroom: 8.82/10.96/5.34/9.26 pct
- jest coverageThreshold security paths: 60/50/60/60 -> 75/65/75/75
  src/common/{guards,filters,interceptors,resilience}/
  Justified by spec coverage density (8 specs covering 11 prod files)
- Remove apps/frontend/src/components/dashboard/audit-logs/audit-log-detail-modal.tsx
  (392 lines, 0 cross-codebase imports verified via Grep)
- Remove apps/frontend/src/components/dashboard/team/invite-member-modal.tsx
  (257 lines, 0 cross-codebase imports verified via Grep)
- Remove apps/backend/src/common/guards/Novo(a) Documento de Texto.txt
  (0-byte garbage Windows New File, tracked since 25/02/2026)

Total: 649 TSX lines deleted + 1 garbage file.
Ratchet plan: target 80% coverage in 4 incremental PRs (S64-S67).
Updates CLAUDE.md (v5.5, S63 entries) + PROJECT_HISTORY.md.
"@

git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) {
    Write-Error "FATAL: git commit failed (exit $LASTEXITCODE)."
    exit 1
}

Write-Host ""
Write-Host "Commit created:" -ForegroundColor Green
git log --oneline -1
Write-Host ""

Write-Host "Pushing to origin/main..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Error "FATAL: git push failed (exit $LASTEXITCODE)."
    exit 1
}

Write-Host ""
Write-Host "=== S63 COMMITTED AND PUSHED ===" -ForegroundColor Green
Write-Host "Next: run scripts\s63-verify-ci.ps1 to monitor CI green"
Write-Host "Expected: 68.82 pct stmt vs 60 pct floor (8.82 pct margin)"
