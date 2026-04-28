$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$logFile = "scripts\s71c-commit.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') S71-1C start" | Out-File -FilePath $logFile -Encoding utf8
function Log {
    param([string]$msg)
    Write-Host $msg
    "$(Get-Date -Format 'HH:mm:ss') $msg" | Out-File -FilePath $logFile -Append -Encoding utf8
}
if (Test-Path ".git\index.lock") { Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue }

Log "==> Stage (revert files restaurados via sandbox)"
$files = @(
    "package.json",
    "pnpm-lock.yaml",
    "apps/frontend/package.json",
    ".github/workflows/ci.yml",
    "scripts/s71c-commit-msg.txt",
    "scripts/s71c-commit.ps1",
    "scripts/s71c-commit.bat"
)
foreach ($f in $files) {
    if (Test-Path $f) {
        & git add -- $f 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { Log "Staged: $f" } else { Log "FAIL: $f" }
    }
}

Log "==> Diff stat"
Log (& git diff --cached --stat 2>&1)

Log "==> Commit"
$out = & git commit -F scripts\s71c-commit-msg.txt 2>&1
foreach ($l in $out) { Log "  C: $l" }
if ($LASTEXITCODE -ne 0) {
    Log "ERROR commit"
    Log "Press any key..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
Log "Commit OK: $(& git rev-parse HEAD)"

Log "==> Push"
$pout = & git push origin main 2>&1
foreach ($l in $pout) { Log "  P: $l" }
if ($LASTEXITCODE -ne 0) {
    Log "ERROR push"
    Log "Press any key..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
Log "Push OK"
Log "==> S71-1C done"
Log "Press any key..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
