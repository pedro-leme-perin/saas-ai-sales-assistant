# ====================================================================
# scripts/s66a-coverage-ratchet.ps1
# ====================================================================
# S66-A - Coverage ratchet round 3: 3 controller specs + functions
# floor 60 -> 62. Pedro-side wrapper.
#
# Lessons applied (S62/S63/S64/S65):
# - ASCII only (no em-dash, no accented chars)
# - single-quote here-string for commit msg (no var expansion)
# - git commit -F (not -m)
# - git checkout HEAD -- restores corrupted working tree files
# - Hook S65 will validate the commit automatically
# ====================================================================

$ErrorActionPreference = "Stop"
$repo = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location $repo

Write-Host ""
Write-Host "===== S66-A coverage ratchet =====" -ForegroundColor Cyan
Write-Host ""

# --- 1. Clear git lock if any ---
Write-Host "[1/8] Clearing git locks..." -ForegroundColor Yellow
$gitLock = Join-Path $repo ".git\index.lock"
if (Test-Path $gitLock) {
    Remove-Item -Force $gitLock -ErrorAction SilentlyContinue
    Write-Host "      removed .git/index.lock"
}

# --- 2. Restore working tree files corrupted post-S65 (from HEAD) ---
Write-Host "[2/8] Restoring corrupted working tree files from HEAD..." -ForegroundColor Yellow
$toRestore = @(
    "apps/backend/test/unit/api-key.guard.spec.ts",
    "scripts/s64a-add-apikey-spec.ps1",
    "scripts/s64a-amend-fix.ps1",
    "pnpm-lock.yaml",
    "docs/operations/s65/PRE_COMMIT_HOOKS.md"
)
foreach ($f in $toRestore) {
    if (Test-Path $f) {
        $diff = git diff --shortstat -- $f 2>$null
        if ($diff) {
            Write-Host "      restoring: $f"
            git checkout HEAD -- $f
        }
    }
}

# --- 3. Clean phantom D+?? entries (Windows file-mode flicker) ---
Write-Host "[3/8] Cleaning phantom D+?? entries..." -ForegroundColor Yellow
$phantomFiles = git status --short | Where-Object { $_ -match "^D " } | ForEach-Object { ($_ -split "\s+", 2)[1] }
foreach ($pf in $phantomFiles) {
    # If file exists on disk and is also "??" untracked, the phantom is just a permission flicker.
    # `git add -- <file>` will normalize the index entry.
    if (Test-Path $pf) {
        Write-Host "      normalizing: $pf"
        git add -- $pf 2>$null | Out-Null
    }
}

# --- 4. Verify hook is active ---
Write-Host "[4/8] Verifying husky hook active..." -ForegroundColor Yellow
if (-not (Test-Path ".husky/_/")) {
    throw ".husky/_/ missing. Run scripts/s65-pre-commit-setup.ps1 first."
}
Write-Host "      OK"

# --- 5. Stage S66-A files ---
Write-Host "[5/8] Staging S66-A changes..." -ForegroundColor Yellow
$s66Files = @(
    "apps/backend/test/unit/tags.controller.spec.ts",
    "apps/backend/test/unit/csat.controller.spec.ts",
    "apps/backend/test/unit/agent-skills.controller.spec.ts",
    "apps/backend/package.json",
    "CLAUDE.md",
    "PROJECT_HISTORY.md",
    "scripts/s66a-coverage-ratchet.ps1"
)
foreach ($f in $s66Files) {
    if (Test-Path $f) {
        git add -- $f
    } else {
        Write-Host "      WARN: $f not found, skipping" -ForegroundColor Red
    }
}

git status --short

# --- 6. Write commit message file (UTF-8 no BOM) ---
Write-Host "[6/8] Writing commit message..." -ForegroundColor Yellow
$msgFile = Join-Path $env:TEMP "s66a-commit-msg.txt"

$msg = @'
feat(s66-a): coverage ratchet round 3 (3 controller specs + functions floor 60 -> 62)

Trigger: close S64-C debt (functions floor relax 65 -> 60 due to flake -0.96pct).
Goal: re-raise floor with defensive headroom.

Gap analysis: 118 prod files vs 81 specs = 40 prod files without dedicated
spec. Cross-reference (filename + classname grep across all specs) reduced
to 10 thin controllers with zero coverage.

Picks (LoC desc + domain density):
- tags.controller.ts          (154L, cross-channel CallTag/ChatTag joins)
- csat.controller.ts          (128L, public token + analytics window)
- agent-skills.controller.ts  (126L, ALL-semantics skill filter, bulk replace)

Specs added:
- tags.controller.spec.ts          (~16 tests, 12 describes, 6.9KB)
- csat.controller.spec.ts          (~13 tests,  7 describes, 6.5KB)
- agent-skills.controller.spec.ts  (~13 tests,  7 describes, 6.3KB)

Total: ~553 lines, ~42 tests, ~26 functions newly covered.

Pattern: jest.Mocked<Partial<Service>> + Test.createTestingModule (identical
to existing analytics.controller.spec.ts). AuthenticatedUser shape verified
via grep src/common/decorators/index.ts (id, clerkId, email, name, role,
companyId, permissions).

Edge cases covered:
- TagsController: empty tagIds, tenant propagation, search query variants
- CsatController: invalid date BadRequestException x2, NaN parseInt fallback,
  Public() lookup/submit bypass auth
- AgentSkillsController: ParseBoolPipe optional false explicit, bulkReplace
  path/body userId mismatch, empty skill set (full clear)

Floor ratchet (conservative):
  global.functions: 60 -> 62 (+2pct)
  Rationale: 3 thin controllers add ~26 functions. Estimated bump
  65.69 -> ~67-68%. Floor 62 keeps ~5pct headroom vs flake CI ~1pct.
  Stmt/branches/lines unchanged (already 4.48-9.26pct headroom).

Next ratchet (S66-B candidate): 62 -> 65 once functions real >=67
confirmed in 2 consecutive PRs.

Working tree recovery: CLAUDE.md (49L vs 719L HEAD) + PROJECT_HISTORY.md
(3592L vs 3794L) + pnpm-lock.yaml (13872L vs 14281L) corrupted post-S65
push (likely lint-staged stash + Windows file watcher race). Bypass:
git show HEAD:<file> > /tmp + python3 patch (lesson S62 #3).

Files:
  apps/backend/test/unit/tags.controller.spec.ts          NEW 6.9KB
  apps/backend/test/unit/csat.controller.spec.ts          NEW 6.5KB
  apps/backend/test/unit/agent-skills.controller.spec.ts  NEW 6.3KB
  apps/backend/package.json                               M  threshold
  CLAUDE.md                                               M  S66 row + section 13 + footer 5.7
  PROJECT_HISTORY.md                                      M  S66-A entry
  scripts/s66a-coverage-ratchet.ps1                       NEW wrapper

Previous: S65 8f522b9
'@

[System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))
Write-Host "      msg file: $msgFile"

# --- 7. Commit (hook will run) ---
Write-Host "[7/8] Committing (hook auto-runs)..." -ForegroundColor Yellow
git commit -F $msgFile
if ($LASTEXITCODE -ne 0) {
    throw "git commit failed (exit $LASTEXITCODE) - check hook output"
}

# --- 8. Push ---
Write-Host "[8/8] Pushing to origin/main..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    throw "git push failed (exit $LASTEXITCODE)"
}

Write-Host ""
Write-Host "===== S66-A DONE =====" -ForegroundColor Green
Write-Host ""
git log --oneline -3
Write-Host ""
Write-Host "Watch CI: https://github.com/pedro-leme-perin/saas-ai-sales-assistant/actions"
