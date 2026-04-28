## scripts/s69a-doc-followup.ps1
## S69-A: doc-only follow-up. Stage + commit + push CLAUDE.md + PROJECT_HISTORY.md.
## Zero código de produção. Just docs explaining 44bce12 + lesson #7.

$ErrorActionPreference = "Continue"
$repo = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location $repo

Write-Host ""
Write-Host "===== S69-A doc followup =====" -ForegroundColor Cyan
Write-Host ""

# Sanitize .git/config NUL bytes (idempotent)
$cfgPath = Join-Path $repo ".git\config"
if (Test-Path $cfgPath) {
    $bytes = [System.IO.File]::ReadAllBytes($cfgPath)
    $nulCount = ($bytes | Where-Object { $_ -eq 0 }).Count
    if ($nulCount -gt 0) {
        $cleanBytes = $bytes | Where-Object { $_ -ne 0 }
        [System.IO.File]::WriteAllBytes($cfgPath, [byte[]]$cleanBytes)
        Write-Host "      .git/config sanitized ($nulCount NUL bytes)"
    }
}

$gitLock = Join-Path $repo ".git\index.lock"
if (Test-Path $gitLock) { Remove-Item -Force $gitLock -ErrorAction SilentlyContinue }

# Drop residual stashes (defensive)
Write-Host "[1/3] Dropping residual stashes (defensive)..." -ForegroundColor Yellow
$maxIter = 20
while ((git stash list 2>$null) -and ($maxIter -gt 0)) {
    git stash drop "stash@{0}" 2>$null | Out-Null
    $maxIter--
}

# 2. Stage S69-A deliverables
Write-Host "[2/3] Staging..." -ForegroundColor Yellow
$files = @(
    "CLAUDE.md",
    "PROJECT_HISTORY.md",
    "scripts/s69a-doc-followup.ps1"
)
foreach ($f in $files) {
    if (Test-Path $f) { git add -- $f }
}
git status --short

# 3. Commit + push
Write-Host "[3/3] Committing + pushing..." -ForegroundColor Yellow
$msgFile = Join-Path $env:TEMP "s69a-msg.txt"

$msg = @'
docs(s69-a): explain partial commit 44bce12 + lint-staged lesson #7

Pedro audited git log and asked origin of the two S69 commits with
identical message (44bce12 + b36143c).

Investigation:
  git show 44bce12 --stat reveals PARTIAL commit:
    PROJECT_HISTORY.md  +146 lines
    package.json        +/-2 lines
  Missing from 44bce12 (present in b36143c HEAD):
    apps/frontend/eslint.config.mjs (NEW)
    apps/frontend/.eslintrc.json (DELETED)
    apps/frontend/package.json (M)
    3 src fixes (audit-logs, csat error, company-tab)
    pnpm-lock.yaml (M)
    CLAUDE.md (M)

Root cause:
During one of the failed S69 attempts, lint-staged ran prettier
(passed on PROJECT_HISTORY.md + package.json) before eslint failed
on frontend src files. Stash apply revert had partial conflict.
git commit -F finalized with files that survived stage. Commit
message reused $msgFile from previous attempt.

Decision: leave 44bce12 in history. b36143c (HEAD) supersedes it
and contains all fixes correctly. CI #262 green confirms.

NOT force-pushing because:
1. Never force-push main is enterprise CI/CD principle.
2. ADRs 012/013 implicitly value traceability over aesthetics.
3. b36143c functionally correct; 44bce12 is forensic record.

Lesson #7 (S69 reinforced): lint-staged with parallel task fail
CAN leave partial commit even when hook reports "failed". Always
verify git log -1 + git status --short after each attempted commit.

Files:
  CLAUDE.md                       M  +S69-A row + header v6.6 + footer
  PROJECT_HISTORY.md              M  +S69-A entry + lesson #7
  scripts/s69a-doc-followup.ps1   NEW

Zero production code touched. Doc-only.

Previous: S69 b36143c
'@

[System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))

git commit -F $msgFile
if ($LASTEXITCODE -ne 0) { throw "git commit failed - check hook output" }

git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host ""
Write-Host "===== S69-A DONE =====" -ForegroundColor Green
git log --oneline -5
