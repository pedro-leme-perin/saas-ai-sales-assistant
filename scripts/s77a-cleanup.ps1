# S77-A post-commit cleanup: restore working tree files corrupted by Windows-side process
$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $PSScriptRoot 's77a-cleanup.log'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log {
    param([string]$Msg)
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $LogPath -Value "[$ts] $Msg"
    Write-Host $Msg
}

Log "===== S77-A cleanup start ====="

# Cleanup .git/index.lock if stale
$LockPath = Join-Path $RepoRoot '.git\index.lock'
if (Test-Path $LockPath) {
    try {
        Remove-Item $LockPath -Force -ErrorAction Stop
        Log "Stale lock removed"
    } catch {
        Log "Lock remove FAILED: $_"
    }
}

# Restore corrupted files to HEAD content
$paths = @(
    'CLAUDE.md',
    'PROJECT_HISTORY.md',
    'apps/backend/test/unit/email.service.spec.ts'
)
Log "--- git checkout HEAD -- <files> ---"
foreach ($p in $paths) {
    $out = git checkout HEAD -- $p 2>&1 | Out-String
    Log "checkout $p : $out"
}

Log "--- git status post-restore ---"
$st = git status -sb 2>&1 | Out-String
Log $st

Log "===== S77-A cleanup end ====="
