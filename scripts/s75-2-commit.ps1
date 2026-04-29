$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$LogFile = "scripts\s75-2-commit.log"
"=== S75-2 commit start: $(Get-Date) ===" | Tee-Object -FilePath $LogFile

Write-Host "[1/5] Cleanup untracked audit JSON + stale .git/index.lock..."
Remove-Item -Force audit-critical.json,audit-high.json -ErrorAction SilentlyContinue
Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue

Write-Host "[2/5] pnpm install (refresh lockfile com novo override lodash ^4.18.0)..."
pnpm install 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) { "FAIL pnpm install exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append; Write-Host "ERRO pnpm install. Log: $LogFile"; pause; exit 1 }

Write-Host "[3/5] git add..."
Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue
git add package.json pnpm-lock.yaml CHANGELOG.md PROJECT_HISTORY.md CLAUDE.md scripts/s75-2-commit.ps1 scripts/s75-2-commit.bat scripts/s75-2-commit-msg.txt 2>&1 | Tee-Object -FilePath $LogFile -Append

Write-Host "[4/5] git commit (HUSKY=1 pre-commit + commit-msg)..."
git commit -F scripts\s75-2-commit-msg.txt 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) { "FAIL git commit exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append; Write-Host "ERRO commit. Log: $LogFile"; pause; exit 1 }

Write-Host "[5/5] git push (HUSKY=1 pre-push dual type-check)..."
git push origin main 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) { "FAIL git push exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append; Write-Host "ERRO push. Log: $LogFile"; pause; exit 1 }

"=== S75-2 commit done: $(Get-Date) ===" | Tee-Object -FilePath $LogFile -Append
Write-Host "DONE. Log: $LogFile"
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
