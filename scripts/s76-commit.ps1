$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$LogFile = "scripts\s76-commit.log"
"=== S76 commit start: $(Get-Date) ===" | Tee-Object -FilePath $LogFile

Write-Host "[1/4] Cleanup index.lock..."
Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue

Write-Host "[2/4] git add..."
git add `
  .github/workflows/ci.yml `
  CHANGELOG.md `
  PROJECT_HISTORY.md `
  CLAUDE.md `
  scripts/s76-commit.ps1 `
  scripts/s76-commit.bat `
  scripts/s76-commit-msg.txt 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) { "FAIL git add exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append; pause; exit 1 }

Write-Host "[3/4] git commit..."
git commit -F scripts\s76-commit-msg.txt 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) { "FAIL git commit exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append; pause; exit 1 }

Write-Host "[4/4] git push..."
git push origin main 2>&1 | Tee-Object -FilePath $LogFile -Append
if ($LASTEXITCODE -ne 0) { "FAIL git push exit=$LASTEXITCODE" | Tee-Object -FilePath $LogFile -Append; pause; exit 1 }

"=== S76 commit done: $(Get-Date) ===" | Tee-Object -FilePath $LogFile -Append
git log --oneline -1 | Tee-Object -FilePath $LogFile -Append
Write-Host "DONE."
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
