$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$LogFile = "scripts\s74-recover-push.log"
"=== S74 recover+push: $(Get-Date) ===" | Tee-Object -FilePath $LogFile

Write-Host "[1/3] git status pre-recover..."
git status --short 2>&1 | Tee-Object -FilePath $LogFile -Append

Write-Host ""
Write-Host "[2/3] Restoring corrupted files (CHANGELOG.md, CLAUDE.md, PROJECT_HISTORY.md, pnpm-lock.yaml) from HEAD..."
git checkout HEAD -- CHANGELOG.md CLAUDE.md PROJECT_HISTORY.md pnpm-lock.yaml 2>&1 | Tee-Object -FilePath $LogFile -Append

Write-Host ""
Write-Host "[3/3] git push origin main..."
git push origin main 2>&1 | Tee-Object -FilePath $LogFile -Append
$pushExit = $LASTEXITCODE

Write-Host ""
"--- final git status ---" | Tee-Object -FilePath $LogFile -Append
git status -sb 2>&1 | Tee-Object -FilePath $LogFile -Append
"--- last 3 commits ---" | Tee-Object -FilePath $LogFile -Append
git log --oneline -3 2>&1 | Tee-Object -FilePath $LogFile -Append

if ($pushExit -ne 0) {
    "FAIL push exit=$pushExit" | Tee-Object -FilePath $LogFile -Append
    Write-Host ""
    Write-Host "ERRO push. Log: $LogFile"
} else {
    "OK push complete" | Tee-Object -FilePath $LogFile -Append
    Write-Host ""
    Write-Host "DONE. Log: $LogFile"
}
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
