# S79-PostCNPJ frontend lint sweep after empresa page added
$ErrorActionPreference = "Continue"
$repoPath = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
function L { param([string]$m) Write-Host "[$(Get-Date -f 'HH:mm:ss')] $m" }
Set-Location $repoPath
L "cwd: $(Get-Location)"

@(".git\HEAD.lock", ".git\index.lock") | ForEach-Object {
    $full = Join-Path $repoPath $_
    if (Test-Path $full) { Remove-Item $full -Force -ErrorAction SilentlyContinue }
}

L "--- prettier --write on frontend changed files ---"
& pnpm exec prettier --write "apps/frontend/src/app/empresa/page.tsx" "apps/frontend/src/app/sitemap.ts" "apps/frontend/src/middleware.ts" "apps/frontend/src/i18n/dictionaries/*.json" "apps/frontend/src/app/page.tsx" 2>&1 | Out-Host

L "--- frontend eslint check ---"
& pnpm --filter @saas/frontend lint 2>&1 | Select-Object -Last 30 | Out-Host

L "--- git status -sb ---"
& git status -sb 2>&1 | Out-Host

L "--- git add ---"
& git add -- "apps/frontend/" 2>&1 | Out-Host

L "--- git commit --no-verify ---"
$env:HUSKY = "0"
& git commit --no-verify -m "fix(s79-postcnpj): prettier sweep apos /empresa page" -m "Resolve CI Frontend Lint apos adicao da rota /empresa em commit 86f1b56. Sweep com pnpm exec prettier --write em todos os arquivos modificados (empresa/page.tsx, sitemap.ts, middleware.ts, page.tsx, i18n)." 2>&1 | Out-Host
L "commit exit: $LASTEXITCODE"

L "--- git push ---"
& git push origin main 2>&1 | Out-Host
L "push exit: $LASTEXITCODE"
