# ====================================================================
# scripts/s65-resume-commit.ps1
# ====================================================================
# Resume S65 commit after the first attempt was blocked by the hook
# (auto-recursive secret leak in PROJECT_HISTORY.md adhoc test prose).
#
# After sandbox redaction (literals -> [REDACTED]), this re-stages
# PROJECT_HISTORY.md and commits using the same message file written
# in step 8 of s65-pre-commit-setup.ps1.
#
# If the msg file was deleted, this script recreates it inline.
# ====================================================================

$ErrorActionPreference = "Stop"
$repo = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location $repo

Write-Host ""
Write-Host "===== S65 resume commit =====" -ForegroundColor Cyan
Write-Host ""

# --- 1. Verify hook is active ---
if (-not (Test-Path ".husky/_/")) {
    throw ".husky/_/ missing. Run scripts/s65-pre-commit-setup.ps1 first."
}

# --- 2. Re-stage PROJECT_HISTORY.md (sandbox-side redacted) + new resume script ---
Write-Host "[1/4] Re-staging files..." -ForegroundColor Yellow
git add PROJECT_HISTORY.md
git add scripts/s65-resume-commit.ps1
git status --short

# --- 3. Verify or recreate msg file ---
Write-Host "[2/4] Verifying commit message file..." -ForegroundColor Yellow
$msgFile = Join-Path $env:TEMP "s65-commit-msg.txt"
if (-not (Test-Path $msgFile)) {
    Write-Host "      msg file missing, recreating..."
    $msg = @'
feat(s65): pre-commit hooks (husky + lint-staged + custom guards)

Diagnosis: 50%+ of CI round-trips in S60a-S64 (8+ iterations) were
preventable locally. Causes: Edit tool truncation (4x), Windows garbage
tracked (1x), Stripe-pattern test fixtures triggering GitHub push
protection (1x), malformed YAML/JSON (1x).

Stack:
- husky 9.1.7 + lint-staged 15.2.10
- 2 custom Node guards (no external deps)

Pipeline (.husky/pre-commit):
1. node scripts/git-hooks/check-windows-garbage.js  HARD FAIL
2. node scripts/git-hooks/check-secrets.js          HARD FAIL
3. npx --no-install lint-staged                     auto-fix prettier

Guards:
- check-windows-garbage.js: Novo*.txt, New File*, Untitled*,
  .DS_Store, Thumbs.db, desktop.ini, MS Office locks, swap files,
  0-byte (allowlist .gitkeep/.keep)
- check-secrets.js: 13 ERROR patterns (Stripe live/test/restricted/
  webhook, Clerk, OpenAI legacy+project, Anthropic, AWS AKIA, GitHub
  PAT/ghs, npm, Slack bot/user) + 2 WARNING (Twilio, hex), allowlist
  line-level and path-level

Bypass: HUSKY=0 git commit ...

Meta-validation: hook BLOCKED its own deployment commit (PROJECT_HISTORY
adhoc test prose contained literal Stripe/OpenAI patterns). Redacted
to [REDACTED] placeholders; ROI proven before merge.

Files:
  .husky/pre-commit                          NEW 1.0KB
  .prettierrc                                NEW root canonical
  .prettierignore                            NEW ~30 entries
  scripts/git-hooks/check-windows-garbage.js NEW 3.4KB
  scripts/git-hooks/check-secrets.js         NEW 6.8KB
  docs/operations/s65/PRE_COMMIT_HOOKS.md    NEW 6KB
  scripts/s65-pre-commit-setup.ps1           NEW 7KB
  scripts/s65-resume-commit.ps1              NEW 2KB
  package.json                               +husky +lint-staged +prepare +config
  CLAUDE.md                                  +S65 row +checklist +v5.6
  PROJECT_HISTORY.md                         +S65 entry (redacted)

Previous: S64-C c00ae5a
'@
    [System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))
    Write-Host "      created: $msgFile"
} else {
    Write-Host "      OK: $msgFile exists"
}

# --- 4. Commit (hook will re-validate) ---
Write-Host "[3/4] Committing..." -ForegroundColor Yellow
git commit -F $msgFile
if ($LASTEXITCODE -ne 0) {
    throw "git commit failed (exit $LASTEXITCODE) - check hook output above"
}

# --- 5. Push ---
Write-Host "[4/4] Pushing to origin/main..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    throw "git push failed (exit $LASTEXITCODE)"
}

Write-Host ""
Write-Host "===== S65 DONE =====" -ForegroundColor Green
Write-Host ""
git log --oneline -3
Write-Host ""
Write-Host "Watch CI: https://github.com/pedro-leme-perin/saas-ai-sales-assistant/actions"
