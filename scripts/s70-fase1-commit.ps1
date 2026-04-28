# scripts/s70-fase1-commit.ps1
#
# S70 Phase 1 - commit + push deliverables.
# Run from repo root via the .bat wrapper (s70-fase1-commit.bat).
#
# Steps:
#   1. Clear any stale git index lock
#   2. Verify HEAD and current branch
#   3. Stage all S70 files (defensive add of specific paths)
#   4. Show staged diff stat
#   5. git commit -F scripts\s70-commit-msg.txt
#   6. git push origin main
#   7. Log everything to scripts\s70-commit.log
#
# ASCII-only per Lesson #6.

$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"

$logFile = "scripts\s70-commit.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') S70 commit script start" | Out-File -FilePath $logFile -Encoding utf8

function Log {
    param([string]$msg)
    Write-Host $msg
    "$(Get-Date -Format 'HH:mm:ss') $msg" | Out-File -FilePath $logFile -Append -Encoding utf8
}

Log "==> Step 1: clear stale lock"
$lockFile = ".git\index.lock"
if (Test-Path $lockFile) {
    Remove-Item -Force $lockFile -ErrorAction SilentlyContinue
    Log "Removed .git/index.lock"
} else {
    Log "No stale lock found"
}

Log ""
Log "==> Step 2: verify HEAD and branch"
$head = & git rev-parse HEAD
$branch = & git branch --show-current
Log "HEAD: $head"
Log "Branch: $branch"
if ($branch -ne "main") {
    Log "ERROR: not on main branch (got: $branch). Aborting."
    exit 1
}

Log ""
Log "==> Step 3: stage S70 deliverable files"
$files = @(
    "CLAUDE.md",
    "PROJECT_HISTORY.md",
    "CONTRIBUTING.md",
    ".github/dependabot.yml",
    ".github/workflows/ci.yml",
    "docs/operations/runbooks/disaster-recovery.md",
    "docs/operations/runbooks/incident-response.md",
    "docs/operations/security/headers-audit.md",
    "docs/operations/security/secrets-rotation.md",
    "docs/process/branching-strategy.md",
    "scripts/s70-restore.ps1",
    "scripts/s70-commit-msg.txt",
    "scripts/s70-fase1-commit.ps1",
    "scripts/s70-fase1-commit.bat"
)

foreach ($f in $files) {
    if (Test-Path $f) {
        & git add -- $f
        if ($LASTEXITCODE -eq 0) {
            Log "Staged: $f"
        } else {
            Log "WARN: git add failed for $f (exit $LASTEXITCODE)"
        }
    } else {
        Log "SKIP: $f not found"
    }
}

Log ""
Log "==> Step 4: staged diff stat"
$stagedStat = & git diff --cached --stat
Log $stagedStat

Log ""
Log "==> Step 5: commit"
& git commit -F scripts\s70-commit-msg.txt
$commitExit = $LASTEXITCODE
if ($commitExit -ne 0) {
    Log "ERROR: git commit failed (exit $commitExit). Likely pre-commit hook block."
    Log "Inspect output above. Use HUSKY=0 only as last resort."
    exit $commitExit
}
Log "Commit OK"

$newCommit = & git rev-parse HEAD
Log "New HEAD: $newCommit"

Log ""
Log "==> Step 6: push"
& git push origin main
$pushExit = $LASTEXITCODE
if ($pushExit -ne 0) {
    Log "ERROR: git push failed (exit $pushExit). Inspect output above."
    exit $pushExit
}
Log "Push OK"

Log ""
Log "==> S70 Phase 1 commit complete."
Log "GitHub Actions will trigger CI on push. Monitor at:"
Log "  https://github.com/pedro-leme-perin/saas-ai-sales-assistant/actions"
Log ""
Log "Press any key to exit (window stays so you can read output)..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
