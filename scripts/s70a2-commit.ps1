# scripts/s70a2-commit.ps1 - S70-A2 advisory mode commit + push
$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$logFile = "scripts\s70a2-commit.log"
"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') S70-A2 start" | Out-File -FilePath $logFile -Encoding utf8
function Log {
    param([string]$msg)
    Write-Host $msg
    "$(Get-Date -Format 'HH:mm:ss') $msg" | Out-File -FilePath $logFile -Append -Encoding utf8
}
$lockFile = ".git\index.lock"
if (Test-Path $lockFile) { Remove-Item -Force $lockFile -ErrorAction SilentlyContinue }

Log "==> Stage"
$files = @(".github/workflows/ci.yml", "scripts/s70a2-commit-msg.txt", "scripts/s70a2-commit.ps1", "scripts/s70a2-commit.bat")
foreach ($f in $files) {
    if (Test-Path $f) {
        $output = & git add -- $f 2>&1
        if ($LASTEXITCODE -eq 0) { Log "Staged: $f" } else { Log "FAIL: $f - $output" }
    }
}
Log "==> Commit"
$out = & git commit -F scripts\s70a2-commit-msg.txt 2>&1
$exit = $LASTEXITCODE
foreach ($l in $out) { Log "  C: $l" }
if ($exit -ne 0) {
    Log "ERROR commit exit $exit"
    Log "Press any key..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit $exit
}
Log "Commit OK: $(& git rev-parse HEAD)"

Log "==> Push"
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
Log "==> S70-A2 done"
Log "Press any key..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
exit 0
