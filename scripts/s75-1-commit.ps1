$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$LogFile = "scripts\s75-1-commit.log"
"=== S75-1 commit start: $(Get-Date) ===" | Tee-Object -FilePath $LogFile

Write-Host ""
Write-Host "[1/5] Removing untracked audit JSON files (Pedro local audit, not for repo)..."
Remove-Item -Force audit-critical.json,audit-high.json -ErrorAction SilentlyContinue
"removed audit JSON files" | Tee-Object -FilePath $LogFile -Append

Write-Host ""
Write-Host "[2/5] pnpm install (refresh lockfile com novo override multer ~2.1.1)..."
pnpm install 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) {
    "FAIL pnpm install exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append
    Write-Host ""
    Write-Host "ERRO em pnpm install. Veja log: $LogFile"
    Write-Host "Pressione qualquer tecla para fechar..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

Write-Host ""
Write-Host "[3/5] git add (5 files: package.json + lockfile + 3 docs + script files)..."
git add package.json pnpm-lock.yaml CHANGELOG.md PROJECT_HISTORY.md CLAUDE.md scripts/s75-1-commit.ps1 scripts/s75-1-commit.bat scripts/s75-1-commit-msg.txt 2>&1 | Tee-Object -FilePath $LogFile -Append

Write-Host ""
Write-Host "[4/5] git commit (HUSKY=1, hooks vao rodar pre-commit + commit-msg)..."
git commit -F scripts\s75-1-commit-msg.txt 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) {
    "FAIL git commit exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append
    Write-Host ""
    Write-Host "ERRO em git commit. Veja log: $LogFile"
    Write-Host "Pressione qualquer tecla para fechar..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

Write-Host ""
Write-Host "[5/5] git push origin main (HUSKY=1, pre-push vai rodar dual type-check)..."
git push origin main 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) {
    "FAIL git push exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append
    Write-Host ""
    Write-Host "ERRO em git push. Veja log: $LogFile"
    Write-Host "Pressione qualquer tecla para fechar..."
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

"=== S75-1 commit done: $(Get-Date) ===" | Tee-Object -FilePath $LogFile -Append
Write-Host ""
Write-Host "DONE. Log completo: $LogFile"
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
