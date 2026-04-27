# scripts/s66c-ratchet.ps1
# S66-C: defensive coverage ratchet 65/55/62/65 -> 68/58/65/68.
# Data-driven from CI #255 (S66-B) measured 73.09/62.31/71.45/73.60.

$ErrorActionPreference = "Stop"
$repo = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location $repo

Write-Host ""
Write-Host "===== S66-C ratchet =====" -ForegroundColor Cyan
Write-Host ""

# Clear lock
$gitLock = Join-Path $repo ".git\index.lock"
if (Test-Path $gitLock) { Remove-Item -Force $gitLock -ErrorAction SilentlyContinue }

# Stage 4 files
Write-Host "[1/4] Staging..." -ForegroundColor Yellow
$files = @(
    "apps/backend/package.json",
    "CLAUDE.md",
    "PROJECT_HISTORY.md",
    "scripts/s66c-ratchet.ps1"
)
foreach ($f in $files) { if (Test-Path $f) { git add -- $f } }
git status --short

# Commit message
Write-Host "[2/4] Writing commit message..." -ForegroundColor Yellow
$msgFile = Join-Path $env:TEMP "s66c-commit-msg.txt"

$msg = @'
feat(s66-c): coverage ratchet defensivo 65/55/62/65 -> 68/58/65/68

Data-driven from CI #255 (S66-B ae64924) measured:
- Statements 73.09% (covered 6112 / total 8362)
- Branches   62.31% (covered 2155 / total 3458)
- Functions  71.45% (covered 1029 / total 1440)
- Lines      73.60% (covered 5608 / total 7619)

Two PRs in a row with functions >=67% (S66-A 67.7%, S66-B 71.45%)
satisfy the ratchet rule defined in S66-A.

Defensive ratchet: each metric raised to (real_measured - >=4pct):
- Statements 65 -> 68 (headroom +5.09pct)
- Branches   55 -> 58 (headroom +4.31pct, the bottleneck)
- Functions  62 -> 65 (headroom +6.45pct)
- Lines      65 -> 68 (headroom +5.60pct)

Min headroom 4.31pct defensible vs CI flake ~1-2pct (S64-C lesson).

Security paths (common/{guards,filters,interceptors,resilience}/)
unchanged at 75/65/75/75 (real >= 97/85/93/97 -> ample 17+ pct
headroom; no urgency).

Estimative model calibrated:
- S66-A predicted +2.3pct -> real +2.0pct (CI #253)
- S66-B predicted +3.1pct -> real +3.75pct (CI #255)

Branches is the laggard metric (+0.46pct between S66-A and S66-B).
Next branches ratchet to wait for service specs (try/catch + DTO
validators) - estimated +10-15pct.

Files:
  apps/backend/package.json   M  coverageThreshold.global
  CLAUDE.md                   M  S66-C row + section 13 table + history + v5.9
  PROJECT_HISTORY.md          M  S66-C entry

Previous: S66-B ae64924
'@

[System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))

Write-Host "[3/4] Committing..." -ForegroundColor Yellow
git commit -F $msgFile
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

Write-Host "[4/4] Pushing..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host ""
Write-Host "===== S66-C DONE =====" -ForegroundColor Green
git log --oneline -3
