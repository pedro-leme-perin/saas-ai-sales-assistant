$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$LogFile = "scripts\s75-4-commit.log"
"=== S75-4 commit start: $(Get-Date) ===" | Tee-Object -FilePath $LogFile

Write-Host "[1/5] Cleanup..."
Remove-Item -Force audit-critical.json,audit-high.json -ErrorAction SilentlyContinue
Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue

Write-Host "[2/5] pnpm install..."
pnpm install 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) { "FAIL pnpm install exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append; pause; exit 1 }

Write-Host "[3/5] git add..."
Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue
git add package.json pnpm-lock.yaml CHANGELOG.md PROJECT_HISTORY.md CLAUDE.md scripts/s75-4-commit.ps1 scripts/s75-4-commit.bat scripts/s75-4-commit-msg.txt 2>&1 | Tee-Object -FilePath $LogFile -Append

Write-Host "[4/5] git commit..."
git commit -F scripts\s75-4-commit-msg.txt 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) { "FAIL git commit exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append; pause; exit 1 }

Write-Host "[5/5] git push..."
git push origin main 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) { "FAIL git push exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append; pause; exit 1 }

"=== S75-4 commit done: $(Get-Date) ===" | Tee-Object -FilePath $LogFile -Append
Write-Host "DONE."
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
