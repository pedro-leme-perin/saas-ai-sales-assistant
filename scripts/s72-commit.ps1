$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$logFile = "scripts\s72-commit.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') S72 start" | Out-File -FilePath $logFile -Encoding utf8
function Log {
    param([string]$msg)
    Write-Host $msg
    "$(Get-Date -Format 'HH:mm:ss') $msg" | Out-File -FilePath $logFile -Append -Encoding utf8
}
if (Test-Path ".git\index.lock") { Remove-Item -Force ".git\index.lock" -ErrorAction SilentlyContinue }

Log "==> Stage"
$files = @(
    "CHANGELOG.md",
    "CLAUDE.md",
    "PROJECT_HISTORY.md",
    "README.md",
    "docs/operations/security/headers-audit.md",
    "docs/operations/security/secrets-rotation.md",
    "docs/process/branching-strategy.md",
    "docs/process/release-cadence.md",
    "scripts/s72-commit-msg.txt",
    "scripts/s72-commit.ps1",
    "scripts/s72-commit.bat"
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
$out = & git commit -F scripts\s72-commit-msg.txt 2>&1
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
Log "==> S72 done"
Log "Press any key..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
