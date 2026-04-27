# scripts/s66b-controllers-batch.ps1
# S66-B: 7 controllers thin specs batch deploy.
# After S66-A (3 specs) + S66-A1 (lint hardening), pick remaining 7
# controllers to push functions% from 67.7 to ~71%.

$ErrorActionPreference = "Stop"
$repo = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location $repo

Write-Host ""
Write-Host "===== S66-B controllers batch =====" -ForegroundColor Cyan
Write-Host ""

# 1. Clear lock
$gitLock = Join-Path $repo ".git\index.lock"
if (Test-Path $gitLock) { Remove-Item -Force $gitLock -ErrorAction SilentlyContinue }

# 2. Stage all 10 deliverables (7 specs + 2 docs + this PS1)
Write-Host "[1/4] Staging changes..." -ForegroundColor Yellow
$files = @(
    "apps/backend/test/unit/contacts.controller.spec.ts",
    "apps/backend/test/unit/announcements.controller.spec.ts",
    "apps/backend/test/unit/webhooks.controller.spec.ts",
    "apps/backend/test/unit/dsar.controller.spec.ts",
    "apps/backend/test/unit/reply-templates.controller.spec.ts",
    "apps/backend/test/unit/goals.controller.spec.ts",
    "apps/backend/test/unit/impersonation.controller.spec.ts",
    "CLAUDE.md",
    "PROJECT_HISTORY.md",
    "scripts/s66b-controllers-batch.ps1"
)
foreach ($f in $files) {
    if (Test-Path $f) { git add -- $f }
    else { Write-Host "      WARN: $f missing" -ForegroundColor Red }
}
git status --short

# 3. Commit message
Write-Host "[2/4] Writing commit message..." -ForegroundColor Yellow
$msgFile = Join-Path $env:TEMP "s66b-commit-msg.txt"

$msg = @'
feat(s66-b): coverage ratchet round 4 - 7 controllers thin specs

Continuation of S66-A: pick the remaining 7 thin controllers without
dedicated spec coverage. Total: 45 methods, ~758 LoC of production
code now covered.

7 specs added (~931 lines, ~60 tests in 45 describes):
- contacts.controller.spec.ts          (149L, 8 methods, NaN parseInt fallback)
- announcements.controller.spec.ts     (130L, 8 methods, listActive role-aware)
- webhooks.controller.spec.ts          (129L, 7 methods, default limit=50)
- dsar.controller.spec.ts              (133L, 6 methods, condensed actor shape)
- reply-templates.controller.spec.ts   (126L, 7 methods, markUsed zero-context)
- goals.controller.spec.ts             (112L, 5 methods, ?? WEEKLY default)
- impersonation.controller.spec.ts     (152L, 4 methods, 4 IP extraction paths)

Pattern consistent with S66-A + S66-A1:
- jest.Mocked<Partial<Service>> + Test.createTestingModule
- import type for DTOs (zero runtime cost)
- `dto as unknown as DtoClass` (no `as any`, ESLint-clean)
- AuthenticatedUser shape verified per docs/decorators

Edge cases highlighted:
- contacts.list: parseInt NaN -> undefined fallback
- webhooks.deliveries: Number(undefined) handling, default 50
- dsar: actor shape `{ id, role }` (defense in depth)
- reply-templates.markUsed: no auth context (intentional)
- goals: nullish coalescing `??` for period default
- impersonation.start: x-forwarded-for string form, array form,
  req.ip fallback, UA truncate to 500 chars

Coverage delta expected:
- Functions: 67.7% -> ~71% (+3.1pct from 45 new function coverages)
- Statements/branches/lines: also up proportionally

Floor unchanged (62). After S66-B confirms >=70% functions for 2nd
consecutive PR, S66-C will ratchet floor 62 -> 65.

Files:
  apps/backend/test/unit/contacts.controller.spec.ts          NEW 5.8KB
  apps/backend/test/unit/announcements.controller.spec.ts     NEW 4.8KB
  apps/backend/test/unit/webhooks.controller.spec.ts          NEW 4.8KB
  apps/backend/test/unit/dsar.controller.spec.ts              NEW 4.8KB
  apps/backend/test/unit/reply-templates.controller.spec.ts   NEW 5.1KB
  apps/backend/test/unit/goals.controller.spec.ts             NEW 4.4KB
  apps/backend/test/unit/impersonation.controller.spec.ts     NEW 5.8KB
  CLAUDE.md                                                   M S66-B + S66-A1 rows + v5.8
  PROJECT_HISTORY.md                                          M S66-A1 + S66-B entries

Previous: S66-A1 4efbc2e
'@

[System.IO.File]::WriteAllText($msgFile, $msg, [System.Text.UTF8Encoding]::new($false))

# 4. Commit + push
Write-Host "[3/4] Committing..." -ForegroundColor Yellow
git commit -F $msgFile
if ($LASTEXITCODE -ne 0) { throw "git commit failed" }

Write-Host "[4/4] Pushing..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

Write-Host ""
Write-Host "===== S66-B DONE =====" -ForegroundColor Green
git log --oneline -3
