$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$logFile = "scripts\s73-commit.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') S73 start" | Out-File -FilePath $logFile -Encoding utf8
function Log {
    param([string]$msg)
    Write-Host $msg
    "$(Get-Date -Format 'HH:mm:ss') $msg" | Out-File -FilePath $logFile -Append -Encoding utf8
}
if (Test-Path ".git\index.lock") { Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue }

Log "==> Step 1: pnpm install (regenerate lock with conventional-changelog-cli)"
& pnpm install --no-frozen-lockfile 2>&1 | ForEach-Object { Log "  pnpm: $_" }
$pnpmExit = $LASTEXITCODE
if ($pnpmExit -ne 0) {
    Log "ERROR: pnpm install failed (exit $pnpmExit)"
    Log "Press any key..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit $pnpmExit
}

Log "==> Step 2: stage files"
$files = @(
    ".husky/pre-push",
    "CHANGELOG.md",
    "CLAUDE.md",
    "CONTRIBUTING.md",
    "PROJECT_HISTORY.md",
    "docs/process/release-cadence.md",
    "package.json",
    "pnpm-lock.yaml",
    "scripts/s73-commit-msg.txt",
    "scripts/s73-commit.ps1",
    "scripts/s73-commit.bat"
)
foreach ($f in $files) {
    if (Test-Path $f) {
        & git add -- $f 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Log "Staged: $f" } else { Log "FAIL: $f" }
    }
}

Log "==> Step 3: diff stat"
Log (& git diff --cached --stat 2>&1)

Log "==> Step 4: commit"
$out = & git commit -F scripts\s73-commit-msg.txt 2>&1
foreach ($l in $out) { Log "  C: $l" }
if ($LASTEXITCODE -ne 0) {
    Log "ERROR commit"
    Log "Press any key..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
Log "Commit OK: $(& git rev-parse HEAD)"

Log "==> Step 5: push"
$pout = & git push origin main 2>&1
foreach ($l in $pout) { Log "  P: $l" }
if ($LASTEXITCODE -ne 0) {
    Log "ERROR push"
    Log "Press any key..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
Log "Push OK"
Log "==> S73 done"
Log "Press any key..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
