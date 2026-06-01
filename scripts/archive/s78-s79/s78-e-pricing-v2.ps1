$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL'
Set-Location $repo

$lock = Join-Path $repo '.git\index.lock'
if (Test-Path $lock) { Remove-Item -Force $lock }

Write-Host "--- Reset staged area (drop polluted state from previous attempt) ---"
git reset HEAD .

Write-Host "--- Restore tsconfig.json (was inadvertently staged for deletion) ---"
git checkout HEAD -- tsconfig.json
git checkout HEAD -- scripts/stripe-webhook-test.ps1

Write-Host "--- Stage target files ---"
git add apps/frontend/src/app/pricing/page.tsx apps/frontend/src/middleware.ts

git diff --cached --stat

Write-Host "--- Commit with -F (file-based message, avoids PowerShell heredoc parse issues) ---"
git commit -F scripts/s78-e-msg.txt

git push origin main
Write-Host "Push complete"
git log -1 --pretty=oneline
