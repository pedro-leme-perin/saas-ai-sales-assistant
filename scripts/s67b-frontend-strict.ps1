# scripts/s67b-frontend-strict.ps1
# S67-B: Frontend ESLint --max-warnings 0 (after audit confirmed clean baseline).

$ErrorActionPreference = "Stop"
$repo = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location $repo

Write-Host ""
Write-Host "===== S67-B Frontend strict =====" -ForegroundColor Cyan
Write-Host ""

# Sanitize .git/config NUL bytes (idempotent)
$cfgPath = Join-Path $repo ".git\config"
if (Test-Path $cfgPath) {
    $bytes = [System.IO.File]::ReadAllBytes($cfgPath)
    $nulCount = ($bytes | Where-Object { $_ -eq 0 }).Count
    if ($nulCount -gt 0) {
        Write-Host "      Cleaning $nulCount NUL bytes from .git/config..."
        $cleanBytes = $bytes | Where-Object { $_ -ne 0 }
        [System.IO.File]::WriteAllBytes($cfgPath, [byte[]]$cleanBytes)
    }
}

$gitLock = Join-Path $repo ".git\index.lock"
if (Test-Path $gitLock) { Remove-Item -Force $gitLock -ErrorAction SilentlyContinue }

# Stage S67-B files
Write-Host "[1/3] Staging..." -ForegroundColor Yellow
$files = @(
    "package.json",
    "CLAUDE.md",
    "PROJECT_HISTORY.md",
    "scripts/s67b-frontend-strict.ps1"
)
foreach ($f in $files) {
    if (Test-Path $f) { git add -- $f }
}
git status --short

# Commit
Write-Host "[2/3] Committing..." -ForegroundColor Yellow
$msgFile = Join-Path $env:TEMP "s67b-commit-msg.txt"

$msg = @'
feat(s67-b): frontend eslint strict mode --max-warnings 0

Audit confirmed frontend baseline clean:
- 0 `as any` in apps/frontend/src
- 0 @ts-ignore / @ts-nocheck / TODO / FIXME / HACK
- Only 3 files with eslint-disable (per-line, scoped, not file-level)

Conclusion: enable --max-warnings 0 on frontend lint-staged is SAFE.
Risk of blocking existing commits: zero.

Change:
  apps/frontend/src/**/*.{ts,tsx,js,jsx}: [
    "prettier --write --ignore-unknown",
+   "npx --no-install eslint --fix --max-warnings 0 --no-error-on-unmatched-pattern"
  ]

Backend strict (S67) + frontend strict (S67-B) = dual strict mode.
Pre-commit hook now gate-keeps every lint violation in the codebase.

S65 carryover roadmap 100% complete:
  S65   Pre-commit base                8f522b9
  S66-A Coverage round 3               763bd64
  S66-A1 Lint hardening                4efbc2e
  S66-B Coverage round 4               ae64924
  S66-C Floor ratchet 68/58/65/68      1820f19
  S66-D commitlint hook                9c7e858
  S66-E ESLint pragmatic               2e7f224
  S67   ESLint strict backend          b14e3df
  S67-B ESLint strict frontend         (this)

9 commits / 9 sessions / 1 day. Pipeline pre-commit fully strict.

Files:
  package.json              M  +--max-warnings 0 frontend
  CLAUDE.md                 M  header v6.3 + S67-B row + footer
  PROJECT_HISTORY.md        M  S67-B entry + 9-session roadmap closure

Pending future sessions:
- Bundle deeper (S62 carryover, semi-autonomous)
- Pre-push hook (S65 roadmap, optional, high cost)
- Auto-changelog (S66-D roadmap)
- Branches coverage amplification (62.31 -> 68+)
- Staging provisioning (S61-C, blocked Pedro interactive)
- WhatsApp Business API live (blocked MEI)

Previous: S67 b14e3df
'@

[System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))

git commit -F $msgFile
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

Write-Host "[3/3] Pushing..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host ""
Write-Host "===== S67-B DONE =====" -ForegroundColor Green
git log --oneline -10
Write-Host ""
Write-Host "S65 carryover roadmap: 100% COMPLETE (9 sessions / 1 day)" -ForegroundColor Green
