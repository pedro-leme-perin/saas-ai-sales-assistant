# S79-PostCNPJ commit + push da identidade juridica THEIADVISOR SAAS TECNOLOGIA LTDA
# Output captured by parent .bat redirect (> ...log 2>&1).
# ASCII-only (licao #6).

$ErrorActionPreference = "Stop"
$repoPath = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
$msgPath = Join-Path $repoPath "scripts\s79-postcnpj-msg.txt"

function Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts] $msg"
}

try {
    Set-Location $repoPath
    Log "Working directory: $repoPath"

    # Cleanup git lock (S62 / licao #2)
    $lockPath = Join-Path $repoPath ".git\index.lock"
    if (Test-Path $lockPath) {
        Remove-Item $lockPath -Force
        Log "Removed stale .git/index.lock"
    }

    # Reset stale staging (licao #28)
    Log "git reset HEAD . (clear staged area)"
    & git reset HEAD . 2>&1 | ForEach-Object { Log "  reset: $_" }

    # Files to stage
    $files = @(
        "CHANGELOG.md",
        "CLAUDE.md",
        "PROJECT_HISTORY.md",
        "apps/backend/.env.example",
        "apps/backend/src/config/env.validation.ts",
        "apps/frontend/src/app/help/page.tsx",
        "apps/frontend/src/app/page.tsx",
        "apps/frontend/src/app/pricing/page.tsx",
        "apps/frontend/src/app/privacy/page.tsx",
        "apps/frontend/src/app/terms/page.tsx",
        "apps/frontend/src/i18n/dictionaries/en.json",
        "apps/frontend/src/i18n/dictionaries/pt-BR.json"
    )

    Log "Staging $($files.Count) files..."
    foreach ($f in $files) {
        $full = Join-Path $repoPath $f
        if (-not (Test-Path $full)) {
            Log "ERROR: file missing: $f"
            exit 1
        }
        & git add -- $f 2>&1 | ForEach-Object { Log "  add: $_" }
        Log "  + $f"
    }

    Log "git status -sb (post-stage):"
    & git status -sb 2>&1 | ForEach-Object { Log "  $_" }

    Log "git commit -F scripts/s79-postcnpj-msg.txt"
    & git commit -F $msgPath 2>&1 | ForEach-Object { Log "  commit: $_" }
    if ($LASTEXITCODE -ne 0) {
        Log "ERROR: git commit failed (exit $LASTEXITCODE)"
        exit $LASTEXITCODE
    }

    $commitSha = & git rev-parse HEAD
    Log "Commit SHA: $commitSha"

    Log "git show $commitSha --stat:"
    & git show $commitSha --stat 2>&1 | ForEach-Object { Log "  $_" }

    Log "git push origin main"
    & git push origin main 2>&1 | ForEach-Object { Log "  push: $_" }
    if ($LASTEXITCODE -ne 0) {
        Log "ERROR: git push failed (exit $LASTEXITCODE)"
        exit $LASTEXITCODE
    }

    Log "SUCCESS - pushed $commitSha to origin/main"
    Log "==> Now monitor CI via curl GitHub API"
}
catch {
    Log "EXCEPTION: $($_.Exception.Message)"
    exit 1
}
