# S77-final: atomic doc reconciliation + working tree cleanup
$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $PSScriptRoot 's77-final.log'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log {
    param([string]$Msg)
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $LogPath -Value "[$ts] $Msg"
    Write-Host $Msg
}

Log "===== S77-final dispatch start ====="

# 1. Cleanup .git/index.lock if stale
$LockPath = Join-Path $RepoRoot '.git\index.lock'
if (Test-Path $LockPath) {
    Remove-Item $LockPath -Force -ErrorAction SilentlyContinue
    Log "Stale lock removed"
}

# 2. Restore corrupted whatsapp spec from HEAD
Log "--- restore whatsapp.service.spec.ts from HEAD ---"
git checkout HEAD -- apps/backend/test/unit/whatsapp.service.spec.ts 2>&1 | ForEach-Object { Log "checkout: $_" }

# 3. Move S77-B revert artifacts to archive
$ArchiveDir = Join-Path $RepoRoot 'scripts\archive'
if (-not (Test-Path $ArchiveDir)) {
    New-Item -ItemType Directory -Path $ArchiveDir -Force | Out-Null
    Log "Created archive dir: $ArchiveDir"
}
$revertArtifacts = @(
    'scripts\s77b-revert.ps1',
    'scripts\s77b-revert.bat',
    'scripts\s77b-revert-msg.txt'
)
foreach ($a in $revertArtifacts) {
    if (Test-Path $a) {
        Move-Item $a $ArchiveDir -Force
        Log "Archived: $a"
    }
}

# 4. Move s77-next-session-prompt.md to archive
$nextPrompt = 'docs\operations\s77-next-session-prompt.md'
if (Test-Path $nextPrompt) {
    Move-Item $nextPrompt $ArchiveDir -Force
    Log "Archived: $nextPrompt"
}

# 5. git status pre-add
Log "--- git status pre-add ---"
$pre = git status -sb 2>&1 | Out-String
Log $pre

# 6. Stage all relevant changes
$paths = @(
    'CHANGELOG.md',
    'PROJECT_HISTORY.md',
    'CLAUDE.md',
    'scripts/s77-final-msg.txt',
    'scripts/s77-final.ps1',
    'scripts/s77-final.bat',
    'scripts/archive/'
)
foreach ($p in $paths) {
    if (Test-Path $p) {
        git add -- $p 2>&1 | ForEach-Object { Log "add $p : $_" }
    }
}

# 7. git status post-add
Log "--- git status post-add ---"
$post = git status -sb 2>&1 | Out-String
Log $post

# 8. git commit
$MsgPath = Join-Path $PSScriptRoot 's77-final-msg.txt'
Log "--- git commit ---"
$out = git commit -F $MsgPath 2>&1 | Out-String
Log $out

if ($LASTEXITCODE -ne 0) {
    Log "FATAL: git commit failed exit $LASTEXITCODE"
    exit $LASTEXITCODE
}

$Sha = (git rev-parse HEAD 2>&1).Trim()
Log "Commit SHA: $Sha"

# 9. git push
Log "--- git push origin main ---"
$pushOut = git push origin main 2>&1 | Out-String
Log $pushOut

if ($LASTEXITCODE -ne 0) {
    Log "FATAL: git push failed exit $LASTEXITCODE"
    exit $LASTEXITCODE
}

$Origin = (git rev-parse origin/main 2>&1).Trim()
Log "origin/main SHA: $Origin"
if ($Sha -eq $Origin) { Log "OK: HEAD == origin/main" }

Log "===== S77-final dispatch end ====="
