$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL'
Set-Location $repo

$lock = Join-Path $repo '.git\index.lock'
if (Test-Path $lock) { Remove-Item -Force $lock }

Write-Host "--- Reset staged area ---"
git reset HEAD .

Write-Host "--- Restore unintended changes ---"
git checkout HEAD -- tsconfig.json 2>$null
git checkout HEAD -- scripts/stripe-webhook-test.ps1 2>$null
git checkout HEAD -- pnpm-lock.yaml 2>$null

Write-Host "--- Stage doc updates only ---"
git add CLAUDE.md PROJECT_HISTORY.md CHANGELOG.md

git diff --cached --stat

Write-Host "--- Commit (file-based message, lines <= 100 chars) ---"
git commit -F scripts/s78-z-msg.txt

git push origin main
Write-Host "Push complete"
git log -1 --pretty=oneline
git rev-parse origin/main
