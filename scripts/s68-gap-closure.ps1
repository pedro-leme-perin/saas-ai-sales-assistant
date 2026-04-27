# scripts/s68-gap-closure.ps1
# S68: gap closure (4 lacunas: archive PS1s, doc s67, ADRs 012/013, per-path coverage).

$ErrorActionPreference = "Stop"
$repo = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location $repo

Write-Host ""
Write-Host "===== S68 gap closure =====" -ForegroundColor Cyan
Write-Host ""

# 0. Sanitize .git/config NUL bytes (idempotent)
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

# 1. Move 22 orphan PS1 scripts to scripts/archive/
Write-Host "[1/4] Moving 22 orphan PS1 scripts to scripts/archive/..." -ForegroundColor Yellow
$orphans = @(
    "s63-cleanup-and-commit.ps1",
    "s63-fetch-fail.ps1",
    "s63-verify-ci.ps1",
    "s63d-recommit.ps1",
    "s64a-add-apikey-spec.ps1",
    "s64a-amend-fix.ps1",
    "s64a-amend-fix2.ps1",
    "s64a-prettier-fix.ps1",
    "s64b-check-guards-coverage.ps1",
    "s64b-ratchet.ps1",
    "s64c-functions-relax.ps1",
    "s65-pre-commit-setup.ps1",
    "s65-resume-commit.ps1",
    "s66a-coverage-ratchet.ps1",
    "s66b-controllers-batch.ps1",
    "s66c-ratchet.ps1",
    "s66d-commitlint.ps1",
    "s66d-resume.ps1",
    "s66e-eslint-hook.ps1",
    "s67-eslint-strict.ps1",
    "s67-resume.ps1",
    "s67b-frontend-strict.ps1"
)
$moved = 0
foreach ($name in $orphans) {
    $src = Join-Path "scripts" $name
    $dst = Join-Path "scripts\archive" $name
    if (Test-Path $src) {
        Move-Item -Path $src -Destination $dst -Force
        Write-Host "      moved: $name"
        $moved++
    }
}
Write-Host "      total moved: $moved / 22"

# 2. Stage all S68 deliverables
Write-Host "[2/4] Staging..." -ForegroundColor Yellow
$files = @(
    "scripts/archive/.gitkeep",
    "scripts/archive/README.md",
    "docs/operations/s67/ESLINT_STRICT.md",
    "docs/adr/012-pre-commit-hooks.md",
    "docs/adr/013-conventional-commits.md",
    "docs/adr/README.md",
    "apps/backend/package.json",
    "CLAUDE.md",
    "PROJECT_HISTORY.md",
    "scripts/s68-gap-closure.ps1"
)
foreach ($f in $files) {
    if (Test-Path $f) { git add -- $f }
}
# Stage moves (deletes from old + adds to new)
git add -A scripts/

git status --short

# 3. Commit
Write-Host "[3/4] Committing..." -ForegroundColor Yellow
$msgFile = Join-Path $env:TEMP "s68-commit-msg.txt"

$msg = @'
chore(s68): gap closure - archive PS1s, ADR 012/013, doc s67, per-path coverage

Audit honesto post-S67-B encontrou 11 lacunas. S68 trata 4 concretas
(autonomas), defere 7 (escopo grande / Pedro-interativas).

Lacunas tratadas:

(A) scripts/archive/ - lacuna #6
    - 22 PS1 scripts orphan movidos de scripts/ para scripts/archive/
    - README.md (3.1KB) com index chronological + outcome commits
    - .gitkeep para safety

(B) docs/operations/s67/ESLINT_STRICT.md - lacuna #7
    - 8.7KB consolidando S67 + S67-B
    - Sections: audit, config diff, hook chain, troubleshooting, roadmap
    - Mantem convencao docs/operations/sXX/ ja em S65/S66

(C) ADR-012 + ADR-013 - lacuna #3 (prompt -16 obrigatorio)
    - 012-pre-commit-hooks.md (6.2KB) formaliza husky+lint-staged+guards
    - 013-conventional-commits.md (5.9KB) formaliza commitlint
    - Numeracao 012/013 (008-011 ja existentes)
    - README.md index atualizado

(D) Per-path coverage thresholds - lacuna #10
    - apps/backend/package.json + 7 paths criticos
    - Floor 60/50/60/60 (idem global pre-S66-A, testado em 6 PRs)
    - Modules: auth, billing, dsar, impersonation, api-keys, webhooks,
              infrastructure/database
    - Catches NEW uncovered files: 0% < 60% threshold blocks CI
    - Total: 12 thresholds enforced (1 global + 4 common + 7 modules)

Lacunas deferidas (escopo grande):
- Coverage 80% target (S69 dedicado, ~3-4h)
- Specs -2 strict (mesmo)
- Working tree corruption root cause (Pedro Sysinternals)
- .git/config NUL bytes prevention (mesmo)
- GitHub fine-grained token audit (Pedro screenshot)
- Eslint frontend full sweep (Pedro pnpm exec)

Files:
  scripts/archive/.gitkeep                     NEW
  scripts/archive/README.md                    NEW 3.1KB
  scripts/{22 PS1s}                            MOVED -> archive/
  docs/operations/s67/ESLINT_STRICT.md         NEW 8.7KB
  docs/adr/012-pre-commit-hooks.md             NEW 6.2KB
  docs/adr/013-conventional-commits.md         NEW 5.9KB
  docs/adr/README.md                           M (index +012, +013)
  apps/backend/package.json                    M (+7 path thresholds)
  CLAUDE.md                                    M (header v6.4, S68 row, footer)
  PROJECT_HISTORY.md                           M (S68 entry)

Previous: S67-B d8e3b21
'@

[System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))

git commit -F $msgFile
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

Write-Host "[4/4] Pushing..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host ""
Write-Host "===== S68 DONE =====" -ForegroundColor Green
git log --oneline -10
