$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$LogFile = "scripts\s75-1-recover.log"
"=== S75-1 recover start: $(Get-Date) ===" | Tee-Object -FilePath $LogFile

Write-Host ""
Write-Host "[1/4] Removing stale .git/index.lock if exists..."
Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue
"removed index.lock (if existed)" | Tee-Object -FilePath $LogFile -Append

Write-Host ""
Write-Host "[2/4] git add (5 files + 3 script files)..."
git add package.json pnpm-lock.yaml CHANGELOG.md PROJECT_HISTORY.md CLAUDE.md scripts/s75-1-commit.ps1 scripts/s75-1-commit.bat scripts/s75-1-commit-msg.txt scripts/s75-1-recover.ps1 scripts/s75-1-recover.bat 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) {
    "FAIL git add exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append
    Write-Host "ERRO em git add. Veja log: $LogFile"
    Write-Host "Pressione qualquer tecla para fechar..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

Write-Host ""
Write-Host "[3/4] git commit (HUSKY=1, hooks pre-commit + commit-msg)..."
git commit -F scripts\s75-1-commit-msg.txt 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) {
    "FAIL git commit exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append
    Write-Host "ERRO em git commit. Veja log: $LogFile"
    Write-Host "Pressione qualquer tecla para fechar..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

Write-Host ""
Write-Host "[4/4] git push origin main (HUSKY=1, pre-push dual type-check)..."
git push origin main 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) {
    "FAIL git push exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append
    Write-Host "ERRO em git push. Veja log: $LogFile"
    Write-Host "Pressione qualquer tecla para fechar..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

"=== S75-1 recover done: $(Get-Date) ===" | Tee-Object -FilePath $LogFile -Append
Write-Host ""
Write-Host "DONE. Log completo: $LogFile"
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
