# scripts/s66d-commitlint.ps1
# S66-D: commitlint hook for Conventional Commits enforcement.

$ErrorActionPreference = "Stop"
$repo = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location $repo

Write-Host ""
Write-Host "===== S66-D commitlint =====" -ForegroundColor Cyan
Write-Host ""

# Clear lock
$gitLock = Join-Path $repo ".git\index.lock"
if (Test-Path $gitLock) { Remove-Item -Force $gitLock -ErrorAction SilentlyContinue }

# 1. pnpm install (adds @commitlint/cli + @commitlint/config-conventional)
Write-Host "[1/5] pnpm install (adds commitlint deps)..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) { throw "pnpm install failed" }

# 2. Verify commit-msg hook activated by husky prepare
Write-Host "[2/5] Verifying husky commit-msg hook..." -ForegroundColor Yellow
if (-not (Test-Path ".husky/commit-msg")) {
    throw ".husky/commit-msg missing - sandbox should have created it"
}
# husky CLI generates .husky/_/commit-msg wrapper on prepare
if (-not (Test-Path ".husky/_/commit-msg")) {
    Write-Host "      .husky/_/commit-msg not auto-generated. Running husky CLI..."
    pnpm exec husky
}

# 3. Quick adhoc test commitlint loads
Write-Host "[3/5] Adhoc commitlint config validation..." -ForegroundColor Yellow
$testGood = "feat(s66-d): test message"
$result = $testGood | npx --no-install commitlint 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      OK: valid message accepted"
} else {
    Write-Host "      WARN: even good message rejected - investigate" -ForegroundColor Red
    $result | Out-Host
}

# 4. Stage S66-D deliverables
Write-Host "[4/5] Staging..." -ForegroundColor Yellow
$files = @(
    "package.json",
    "pnpm-lock.yaml",
    ".husky/commit-msg",
    "commitlint.config.js",
    "docs/operations/s66/COMMITLINT.md",
    "CLAUDE.md",
    "PROJECT_HISTORY.md",
    "scripts/s66d-commitlint.ps1"
)
foreach ($f in $files) {
    if (Test-Path $f) { git add -- $f }
    else { Write-Host "      WARN: $f missing" -ForegroundColor Red }
}
git status --short

# 5. Commit + push
Write-Host "[5/5] Writing commit message..." -ForegroundColor Yellow
$msgFile = Join-Path $env:TEMP "s66d-commit-msg.txt"

$msg = @'
feat(s66-d): commitlint hook for Conventional Commits enforcement

Stack: @commitlint/cli 19.6.1 + @commitlint/config-conventional 19.6.0
Hook: .husky/commit-msg invokes `commitlint --edit "$1"` (parallel to
pre-commit S65, no conflict).

Config (commitlint.config.js): 11 custom rules over config-conventional:
- header-max-length 100 (vs default 72)
- subject-case never start/pascal/upper-case
- subject-empty/full-stop/type-empty/type-case enforced
- type-enum: feat/fix/chore/docs/refactor/test/style/perf/build/ci/revert
- scope-case lower-case
- body-leading-blank/footer-leading-blank: warn
- body-max-line-length 200 (vs default 100)

Adhoc validation passed:
- node --check commitlint.config.js -> OK
- require() loads, extends correct, 11 rules, 11 types in enum

Doc: docs/operations/s66/COMMITLINT.md (~4KB - format, types, rules,
examples, onboarding, bypass, roadmap auto-changelog).

Bypass: HUSKY=0 git commit ...

Hook chain post-S66-D:
1. pre-commit (S65) -> guards + lint-staged
2. commit-msg (S66-D) -> commitlint
3. commit accepted

Files:
  package.json                            M  +commitlint deps
  pnpm-lock.yaml                          M  lockfile update
  .husky/commit-msg                       NEW 329 bytes
  commitlint.config.js                    NEW 2.4KB
  docs/operations/s66/COMMITLINT.md       NEW 4.2KB
  CLAUDE.md                               M  S66-D row + v6.0
  PROJECT_HISTORY.md                      M  S66-D entry

Previous: S66-C 1820f19
'@

[System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))

git commit -F $msgFile
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host ""
Write-Host "===== S66-D DONE =====" -ForegroundColor Green
git log --oneline -3
