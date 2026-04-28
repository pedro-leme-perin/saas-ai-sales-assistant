# scripts/s70-audit-check.ps1
# Run pnpm audit locally to mirror what CI #264 saw.
# Output saved to scripts/s70-audit.log for inspection.

$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"

$logFile = "scripts\s70-audit.log"
"Audit at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -FilePath $logFile -Encoding utf8

Write-Host "==> Running pnpm audit --prod --audit-level=high"
& pnpm audit --prod --audit-level=high 2>&1 | Tee-Object -FilePath $logFile -Append
$prodExit = $LASTEXITCODE

"" | Out-File -FilePath $logFile -Append -Encoding utf8
"Exit code (high+): $prodExit" | Out-File -FilePath $logFile -Append -Encoding utf8
"" | Out-File -FilePath $logFile -Append -Encoding utf8

Write-Host ""
Write-Host "==> Running pnpm audit --audit-level=moderate (informational)"
& pnpm audit --audit-level=moderate 2>&1 | Tee-Object -FilePath $logFile -Append
$modExit = $LASTEXITCODE

"" | Out-File -FilePath $logFile -Append -Encoding utf8
"Exit code (moderate+): $modExit" | Out-File -FilePath $logFile -Append -Encoding utf8

Write-Host ""
Write-Host "==> Audit complete. See $logFile"
Write-Host "Press any key to close..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
