# scripts/s70a-commit.ps1 - S70-A fix commit + push (v2 fix)
$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$logFile = "scripts\s70a-commit.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') S70-A v2 start" | Out-File -FilePath $logFile -Encoding utf8
function Log {
    param([string]$msg)
    Write-Host $msg
    "$(Get-Date -Format 'HH:mm:ss') $msg" | Out-File -FilePath $logFile -Append -Encoding utf8
}
$lockFile = ".git\index.lock"
if (Test-Path $lockFile) { Remove-Item -Force $lockFile -ErrorAction SilentlyContinue }

Log "==> Stage existing files only"
$files = @(
    ".github/workflows/ci.yml",
    "scripts/s70a-commit-msg.txt",
    "scripts/s70a-commit.ps1",
    "scripts/s70a-commit.bat",
    "scripts/s70-audit-check.ps1",
    "scripts/s70-audit-check.bat"
)
foreach ($f in $files) {
    if (Test-Path $f) {
        $output = & git add -- $f 2>&1
        $exitCode = $LASTEXITCODE
        if ($exitCode -eq 0) {
            Log "Staged: $f"
        } else {
            Log "FAIL stage $f (exit $exitCode): $output"
        }
    } else {
        Log "SKIP not found: $f"
    }
}

Log "==> Diff stat"
$stat = & git diff --cached --stat 2>&1
Log $stat

Log "==> Commit"
$commitOutput = & git commit -F scripts\s70a-commit-msg.txt 2>&1
$exit = $LASTEXITCODE
foreach ($line in $commitOutput) {
    Log "  COMMIT: $line"
}
if ($exit -ne 0) {
    Log "ERROR: commit failed (exit $exit)"
    Log "Press any key to close..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit $exit
}
Log "Commit OK"
$head = & git rev-parse HEAD
Log "New HEAD: $head"

Log "==> Push"
$pushOutput = & git push origin main 2>&1
$pushExit = $LASTEXITCODE
foreach ($line in $pushOutput) {
    Log "  PUSH: $line"
}
if ($pushExit -ne 0) {
    Log "ERROR: push failed (exit $pushExit)"
    Log "Press any key to close..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit $pushExit
}
Log "Push OK"
Log "==> S70-A done. CI run will start. Monitor https://github.com/pedro-leme-perin/saas-ai-sales-assistant/actions"
Log "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
