# S81-T4a — Stage + Commit + Push calls.service.spec amplification
# ASCII only, CRLF EOL (lição #6, #8). Run via .bat wrapper or directly.

$ErrorActionPreference = 'Continue'
$repo = 'C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL'
$logFile = "$repo\scripts\s81-t4a-calls-spec-commit.log"
$msgFile = "$repo\scripts\s81-t4a-calls-spec-commit-msg.txt"

function Log {
    param([string]$text)
    Add-Content -Path $logFile -Value "[$(Get-Date -Format 'HH:mm:ss')] $text"
    Write-Host $text
}

function Run-Git {
    param([string]$gitArgs)
    Log "+ git $gitArgs"
    $out = cmd /c "git $gitArgs 2>&1"
    $exit = $LASTEXITCODE
    if ($out) { Log ($out | Out-String) }
    Log "  -> exit $exit"
    return $exit
}

Remove-Item $logFile -ErrorAction SilentlyContinue
Log "=== S81-T4a calls.service.spec commit ==="
Log "repo: $repo"

Set-Location -LiteralPath $repo

foreach ($f in @('.git\index.lock', '.git\HEAD.lock')) {
    if (Test-Path $f) {
        Log "removing lock: $f"
        Remove-Item $f -Force -ErrorAction SilentlyContinue
    }
}

Run-Git -gitArgs 'fetch origin main'
Run-Git -gitArgs 'reset HEAD .'
Run-Git -gitArgs 'add apps/backend/test/unit/calls.service.spec.ts'

Log '--- staged diff stat ---'
Run-Git -gitArgs 'diff --cached --stat'

$msgPath = $msgFile.Replace('\', '/')
Run-Git -gitArgs "commit -F `"$msgPath`""

Log '--- last commit ---'
Run-Git -gitArgs 'log -1 --stat --oneline'

Run-Git -gitArgs 'push origin main'

Log '--- final status ---'
Run-Git -gitArgs 'status -sb'

Log '=== done ==='
