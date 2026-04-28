# scripts/s71-commit.ps1 - S71 commit + push (with pnpm install for protobufjs override)
$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$logFile = "scripts\s71-commit.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') S71 commit start" | Out-File -FilePath $logFile -Encoding utf8
function Log {
    param([string]$msg)
    Write-Host $msg
    "$(Get-Date -Format 'HH:mm:ss') $msg" | Out-File -FilePath $logFile -Append -Encoding utf8
}

$lockFile = ".git\index.lock"
if (Test-Path $lockFile) { Remove-Item -Force $lockFile -ErrorAction SilentlyContinue }

Log "==> Step 1: pnpm install (apply pnpm.overrides for protobufjs)"
& pnpm install --no-frozen-lockfile 2>&1 | ForEach-Object { Log "  pnpm: $_" }
$pnpmExit = $LASTEXITCODE
if ($pnpmExit -ne 0) {
    Log "ERROR: pnpm install failed (exit $pnpmExit)"
    Log "Press any key..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit $pnpmExit
}

Log "==> Step 2: verify protobufjs upgrade in lock"
$lockProto = Select-String -LiteralPath "pnpm-lock.yaml" -Pattern "^  protobufjs@" | Select-Object -First 1
if ($lockProto) {
    Log "Lock has: $($lockProto.Line.Trim())"
    if ($lockProto.Line -match "protobufjs@7\.5\.[5-9]" -or $lockProto.Line -match "protobufjs@[8-9]\." -or $lockProto.Line -match "protobufjs@\d{2,}\.") {
        Log "OK: protobufjs upgraded"
    } else {
        Log "WARN: protobufjs version doesn't match expected >=7.5.5"
    }
}

Log "==> Step 3: stage files"
$files = @(
    "package.json",
    "pnpm-lock.yaml",
    "CLAUDE.md",
    "PROJECT_HISTORY.md",
    "CHANGELOG.md",
    "LICENSE",
    ".github/workflows/ci.yml",
    ".github/workflows/backup-postgres.yml",
    "apps/frontend/next.config.js",
    "apps/backend/src/main.ts",
    "docs/operations/observability/logs-retention.md",
    "scripts/s71-commit-msg.txt",
    "scripts/s71-commit.ps1",
    "scripts/s71-commit.bat"
)
foreach ($f in $files) {
    if (Test-Path $f) {
        $output = & git add -- $f 2>&1
        if ($LASTEXITCODE -eq 0) {
            Log "Staged: $f"
        } else {
            Log "FAIL: $f - $output"
        }
    } else {
        Log "SKIP: $f not found"
    }
}

Log "==> Step 4: diff stat"
$stat = & git diff --cached --stat 2>&1
Log $stat

Log "==> Step 5: commit"
$out = & git commit -F scripts\s71-commit-msg.txt 2>&1
$exit = $LASTEXITCODE
foreach ($l in $out) { Log "  C: $l" }
if ($exit -ne 0) {
    Log "ERROR commit exit $exit"
    Log "Press any key..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit $exit
}
Log "Commit OK: $(& git rev-parse HEAD)"

Log "==> Step 6: push"
$pout = & git push origin main 2>&1
$pexit = $LASTEXITCODE
foreach ($l in $pout) { Log "  P: $l" }
if ($pexit -ne 0) {
    Log "ERROR push exit $pexit"
    Log "Press any key..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit $pexit
}
Log "Push OK"
Log "==> S71 done"
Log "Press any key..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
