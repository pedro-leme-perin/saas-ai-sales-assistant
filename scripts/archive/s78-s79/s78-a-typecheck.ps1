$ErrorActionPreference = 'Continue'
$repo = 'C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL'
Set-Location $repo

Write-Host "--- Running frontend type-check ---"
pnpm --filter=@saas/frontend run type-check 2>&1 | Out-String -Stream
Write-Host "--- Exit code: $LASTEXITCODE ---"
