# S77-B commit 2 dispatch
$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $PSScriptRoot 's77b-commit.log'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log {
    param([string]$Msg)
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $LogPath -Value "[$ts] $Msg"
    Write-Host $Msg
}

Log "===== S77-B commit dispatch start ====="
Log "Repo: $RepoRoot"

$LockPath = Join-Path $RepoRoot '.git\index.lock'
if (Test-Path $LockPath) {
    Remove-Item $LockPath -Force -ErrorAction SilentlyContinue
    Log "Stale lock removed"
}

Log "--- git status pre-add ---"
$pre = git status -sb 2>&1 | Out-String
Log $pre

$paths = @(
    'apps/backend/test/unit/whatsapp.service.failures.spec.ts',
    'apps/backend/test/unit/contacts.service.failures.spec.ts',
    'CHANGELOG.md',
    'PROJECT_HISTORY.md',
    'CLAUDE.md',
    'scripts/s77b-commit-msg.txt',
    'scripts/s77b-commit-and-push.ps1',
    'scripts/s77b-commit-and-push.bat',
    'scripts/s77a-cleanup.ps1',
    'scripts/s77a-cleanup.bat'
)

Log "--- git add ---"
foreach ($p in $paths) {
    if (Test-Path $p) {
        git add -- $p 2>&1 | ForEach-Object { Log "add $p : $_" }
    } else {
        Log "skip (missing): $p"
    }
}

Log "--- git status post-add ---"
$post = git status -sb 2>&1 | Out-String
Log $post

$MsgPath = Join-Path $PSScriptRoot 's77b-commit-msg.txt'
if (-not (Test-Path $MsgPath)) {
    Log "FATAL: commit message file missing: $MsgPath"
    exit 1
}

Log "--- git commit ---"
$out = git commit -F $MsgPath 2>&1 | Out-String
Log $out

if ($LASTEXITCODE -ne 0) {
    Log "FATAL: git commit failed with exit $LASTEXITCODE"
    exit $LASTEXITCODE
}

$Sha = (git rev-parse HEAD 2>&1).Trim()
Log "Commit SHA: $Sha"

Log "--- git push origin main ---"
$pushOut = git push origin main 2>&1 | Out-String
Log $pushOut

if ($LASTEXITCODE -ne 0) {
    Log "FATAL: git push failed with exit $LASTEXITCODE"
    exit $LASTEXITCODE
}

$Origin = (git rev-parse origin/main 2>&1).Trim()
Log "origin/main SHA: $Origin"
if ($Sha -eq $Origin) {
    Log "OK: HEAD == origin/main"
} else {
    Log "MISMATCH: local=$Sha origin=$Origin"
}

Log "===== S77-B commit dispatch end ====="
