## scripts/s69-final.ps1
## S69 monolithic deploy: clean state + ESLint v9 flat config + per-app eslint binary.
## Single PS1, single commit, no resume needed.

## Use "Continue" (not "Stop") because native commands (pnpm, git with
## hooks invoking npm/node) write deprecation warnings to stderr which
## PowerShell treats as RemoteException under Stop mode. We check
## $LASTEXITCODE explicitly after each native command instead.
$ErrorActionPreference = "Continue"
$repo = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location $repo

Write-Host ""
Write-Host "===== S69 FINAL =====" -ForegroundColor Cyan
Write-Host ""

# 0. Sanitize .git/config NUL bytes
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

# Clear any stuck lock
$gitLock = Join-Path $repo ".git\index.lock"
if (Test-Path $gitLock) { Remove-Item -Force $gitLock -ErrorAction SilentlyContinue }

# 1. Drop residual stashes from previous failed S69 attempts
Write-Host "[1/7] Dropping residual stashes..." -ForegroundColor Yellow
$stashes = git stash list 2>$null
if ($stashes) {
    git stash list | ForEach-Object { Write-Host "      $_" }
    Write-Host "      Dropping all stashes..."
    # PowerShell interprets stash@{0} as format string placeholder; must quote.
    $maxIter = 20
    while ((git stash list 2>$null) -and ($maxIter -gt 0)) {
        git stash drop "stash@{0}" 2>$null | Out-Null
        $maxIter--
    }
    Write-Host "      stash list now empty"
} else {
    Write-Host "      no stashes"
}

# 2. Delete legacy .eslintrc.json (sandbox writes don't propagate; we use git rm)
Write-Host "[2/7] Removing legacy apps/frontend/.eslintrc.json..." -ForegroundColor Yellow
$legacyConfig = Join-Path $repo "apps\frontend\.eslintrc.json"
if (Test-Path $legacyConfig) {
    git rm -- "apps/frontend/.eslintrc.json"
    if ($LASTEXITCODE -ne 0) { throw "git rm failed" }
} else {
    Write-Host "      already removed (or never existed)"
}

# 3. pnpm install (adds @eslint/eslintrc)
# Temporarily relax error action: pnpm prints warnings to stderr which
# PowerShell treats as RemoteException under "Stop" mode. Check exit
# code instead of trusting stderr.
Write-Host "[3/7] pnpm install..." -ForegroundColor Yellow
$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    pnpm install
    $pnpmResult = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $prevPref
}
if ($pnpmResult -ne 0) { throw "pnpm install failed (exit $pnpmResult)" }

# 4. ESLint sweep validation gate (frontend)
# Same stderr-vs-Stop issue as step 3.
Write-Host "[4/7] ESLint sweep validation..." -ForegroundColor Yellow
$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
Push-Location "apps\frontend"
try {
    & pnpm exec eslint src --max-warnings 0
    $sweepResult = $LASTEXITCODE
} finally {
    Pop-Location
    $ErrorActionPreference = $prevPref
}

if ($sweepResult -eq 0) {
    Write-Host "      OK: ESLint sweep clean (zero warnings)" -ForegroundColor Green
} else {
    Write-Host "      FAIL: warnings remain. Review output above and fix before re-running." -ForegroundColor Red
    throw "ESLint sweep failed (exit $sweepResult)"
}

# 5. Stage everything S69
Write-Host "[5/7] Staging all S69 deliverables..." -ForegroundColor Yellow
git add -A
git status --short

# 6. Commit (hook now uses --config flag for frontend eslint v9)
Write-Host "[6/7] Committing..." -ForegroundColor Yellow
$msgFile = Join-Path $env:TEMP "s69-final-msg.txt"

$msg = @'
fix(s69): frontend eslint v9 flat config + per-app eslint binary

Three critical bugs found during deploy iterations:

Bug 1: ESLint v9 dropped legacy .eslintrc.* default support.
Frontend had eslint v9.17.0 + .eslintrc.json (extends
next/core-web-vitals). Sweep failed:
  ESLint couldn't find an eslint.config.(js|mjs|cjs) file.

Bug 2: Monorepo dual-version pnpm hoisting resolved
npx --no-install eslint to backend v8.57.x (hoisted to root). v8
cannot read eslint.config.mjs (only v9 does), causing pre-commit
failure on frontend src files even after migration to flat config.

Bug 3: ESLint v9 flat config does NOT walk up from file path
arguments to find config. It searches from CWD only. Lint-staged
runs from repo root, where there is no eslint.config.mjs. Even with
explicit per-app eslint binary (v9), v9 from repo root fails:
  ESLint couldn't find an eslint.config.(js|mjs|cjs) file.

Migration:
1. NEW apps/frontend/eslint.config.mjs (FlatCompat shim wrapping
   next/core-web-vitals, which is still legacy in v15)
2. apps/frontend/package.json devDeps +@eslint/eslintrc@^3.2.0
3. DELETED apps/frontend/.eslintrc.json
4. package.json lint-staged: replaced npx --no-install eslint with
   explicit per-app binary path PLUS config flags:
   - Backend: node apps/backend/node_modules/eslint/bin/eslint.js
              --resolve-plugins-relative-to apps/backend (v8 OK with
              .eslintrc.js up-walk; flag for plugin resolution)
   - Frontend: node apps/frontend/node_modules/eslint/bin/eslint.js
               --config apps/frontend/eslint.config.mjs (v9 needs
               explicit config in monorepo from non-app CWD)

Sweep validation revealed 3 real warnings missed by S67-B grep audit:
- audit-logs/page.tsx:241 unused `// eslint-disable-next-line no-console`
- csat/trends/error.tsx:22 same
- company-tab.tsx:159 <img> instead of next/image

Fixes:
- 1+2: removed unused directives (rule no-console not enabled in
  eslint-config-next default)
- 3: scoped suppress with multi-line justification (R2 dynamic logo
  URLs require remotePatterns + custom loader; deferred S70+)

Working tree corruption recovery:
- 6th occurrence: lint-staged stash apply abort during failed
  attempts revertedeslint.config.mjs creation, package.json fixes,
  3 src file fixes, restored from sandbox via Edit tool.
- apps/frontend/package.json corrupted with binary content (NUL
  bytes), restored via git show HEAD.

Lessons new (S69):
1. Lint-staged glob test required end-to-end (S67-B did not stage
   any frontend src; --max-warnings 0 was theoretical for 4 sessions).
2. Monorepo dual eslint version: explicit per-app binary path is
   the only portable solution for lint-staged.
3. ESLint v9 flat config does not walk up from file paths;
   explicit --config flag required when CWD differs from app root.
4. Grep `as any` audit insufficient. Real sweep validation catches
   unused-disable directives + framework-specific rules.
5. lint-staged automatic stash backup is destructive: failed task
   reverts staged files (incl. source fixes). PS1 must drop
   stashes between attempts.

Lacuna #35 (frontend full sweep) RESOLVED — sweep passes with zero
warnings.

Files:
  apps/frontend/eslint.config.mjs                                NEW 800B
  apps/frontend/package.json                                     M  +@eslint/eslintrc@^3.2.0
  apps/frontend/.eslintrc.json                                   DELETED
  apps/frontend/src/app/dashboard/audit-logs/page.tsx            M  -1 unused directive
  apps/frontend/src/app/dashboard/csat/trends/error.tsx          M  -1 unused directive
  apps/frontend/src/components/settings/tabs/company-tab.tsx     M  +scoped suppress with justification
  package.json                                                   M  per-app eslint binary + --config flag
  pnpm-lock.yaml                                                 M  lockfile update
  CLAUDE.md                                                      M  S69 row + header v6.5
  PROJECT_HISTORY.md                                             M  S69 entry
  scripts/s69-flat-config.ps1                                    NEW deploy script (failed attempt)
  scripts/s69-resume.ps1                                         NEW resume script (failed attempt)
  scripts/s69-final.ps1                                          NEW monolithic final deploy

Previous: S68 4a8b647
'@

[System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))

git commit -F $msgFile
if ($LASTEXITCODE -ne 0) { throw "git commit failed - check hook output" }

# 7. Push
Write-Host "[7/7] Pushing to origin/main..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host ""
Write-Host "===== S69 FINAL DONE =====" -ForegroundColor Green
git log --oneline -10
Write-Host ""
Write-Host "Watch CI: https://github.com/pedro-leme-perin/saas-ai-sales-assistant/actions"
