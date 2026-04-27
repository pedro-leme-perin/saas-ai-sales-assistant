# scripts/s67-resume.ps1
# Resume S67 after eslint failure on .eslintrc.js (root config matched glob).
# Fix: glob narrowed to {src,test}/ subdirectories only.

$ErrorActionPreference = "Stop"
$repo = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location $repo

Write-Host ""
Write-Host "===== S67 resume =====" -ForegroundColor Cyan
Write-Host ""

# Clear lock if any
$gitLock = Join-Path $repo ".git\index.lock"
if (Test-Path $gitLock) { Remove-Item -Force $gitLock -ErrorAction SilentlyContinue }

# Re-stage all S67 files (package.json was updated by sandbox to fix glob)
Write-Host "[1/3] Re-staging..." -ForegroundColor Yellow
$files = @(
    "apps/backend/.eslintrc.js",
    "package.json",
    "CLAUDE.md",
    "PROJECT_HISTORY.md",
    "scripts/s67-eslint-strict.ps1",
    "scripts/s67-resume.ps1"
)
foreach ($f in $files) {
    if (Test-Path $f) { git add -- $f }
}
git status --short

# Commit (hook re-runs with corrected glob)
Write-Host "[2/3] Committing..." -ForegroundColor Yellow
$msgFile = Join-Path $env:TEMP "s67-commit-msg.txt"

$msg = @'
feat(s67): eslint strict mode (backend) + frontend lint integration

Continuation of S66-E (pragmatic mode). Refined diagnosis confirmed
ALL 17 existing `as any` casts in backend are suppressed (5 per-line
+ 12 file-level + 1 false positive). Convert warn -> error is SAFE.

Changes:
1. apps/backend/.eslintrc.js:
   - no-explicit-any:  warn -> error
   - no-unused-vars:   warn -> error
2. package.json lint-staged:
   - Backend glob: apps/backend/{src,test}/**/*.{ts,js}
     (narrowed from apps/backend/**/*.{ts,js} to exclude root configs
     like .eslintrc.js which ESLint ignores by default and was failing
     hook with "File ignored by default" warning under --max-warnings 0)
   - Backend command: +--max-warnings 0 (strict)
   - Frontend (NEW): apps/frontend/src/**/*.{ts,tsx,js,jsx}
                     +eslint --fix (pragmatic, no --max-warnings 0)
                     baseline not audited, deferred S67-B candidate

Strict mode dual layer (backend):
- error rule + --max-warnings 0
- IDE catches on save
- Hook catches on commit

Hook chain post-S67:
  pre-commit -> guards + prettier + eslint --fix --max-warnings 0 (backend)
                                  + eslint --fix (frontend pragmatic)
  commit-msg -> commitlint
  commit accepted

Sandbox issues handled:
- .git/config NUL bytes (lesson #5) -> auto-sanitize in step 0
- working tree truncation (5th occurrence) -> rebuild from raw GitHub
- glob too broad caught .eslintrc.js (this PS1 fix)

Files:
  apps/backend/.eslintrc.js   M  no-explicit-any/no-unused-vars: error
  package.json                M  lint-staged narrowed globs + strict
  CLAUDE.md                   M  header v6.2 + S67 row + footer
  PROJECT_HISTORY.md          M  S67 entry

Pending S67-B: frontend strict mode (audit + remediate ~50 files).

Previous: S66-E 2e7f224
'@

[System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))

git commit -F $msgFile
if ($LASTEXITCODE -ne 0) { throw "git commit failed - check hook output" }

Write-Host "[3/3] Pushing..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host ""
Write-Host "===== S67 DONE =====" -ForegroundColor Green
git log --oneline -5
