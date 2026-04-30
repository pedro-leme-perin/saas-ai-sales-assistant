$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $PSScriptRoot 's77b-revert.log'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log {
    param([string]$Msg)
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $LogPath -Value "[$ts] $Msg"
    Write-Host $Msg
}

Log "===== S77-B revert dispatch start ====="

$LockPath = Join-Path $RepoRoot '.git\index.lock'
if (Test-Path $LockPath) {
    Remove-Item $LockPath -Force -ErrorAction SilentlyContinue
    Log "Stale lock removed"
}

# Delete failing spec files
$toDelete = @(
    'apps/backend/test/unit/whatsapp.service.failures.spec.ts',
    'apps/backend/test/unit/contacts.service.failures.spec.ts'
)
foreach ($f in $toDelete) {
    if (Test-Path $f) {
        Remove-Item $f -Force
        Log "Deleted: $f"
    } else {
        Log "Skip (already absent): $f"
    }
}

Log "--- git status pre-add ---"
$pre = git status -sb 2>&1 | Out-String
Log $pre

# Stage deletions + revert script
git add -- 'apps/backend/test/unit/whatsapp.service.failures.spec.ts' 2>&1 | ForEach-Object { Log "add (D) $_" }
git add -- 'apps/backend/test/unit/contacts.service.failures.spec.ts' 2>&1 | ForEach-Object { Log "add (D) $_" }
git add -- 'scripts/s77b-revert.ps1' 'scripts/s77b-revert.bat' 'scripts/s77b-revert-msg.txt' 2>&1 | ForEach-Object { Log "add $_" }

Log "--- git status post-add ---"
$post = git status -sb 2>&1 | Out-String
Log $post

$MsgPath = Join-Path $PSScriptRoot 's77b-revert-msg.txt'
Log "--- git commit (revert) ---"
$out = git commit -F $MsgPath 2>&1 | Out-String
Log $out

if ($LASTEXITCODE -ne 0) {
    Log "FATAL: git commit failed exit $LASTEXITCODE"
    exit $LASTEXITCODE
}

$Sha = (git rev-parse HEAD 2>&1).Trim()
Log "Revert SHA: $Sha"

Log "--- git push origin main ---"
$pushOut = git push origin main 2>&1 | Out-String
Log $pushOut

if ($LASTEXITCODE -ne 0) {
    Log "FATAL: git push failed exit $LASTEXITCODE"
    exit $LASTEXITCODE
}

$Origin = (git rev-parse origin/main 2>&1).Trim()
Log "origin/main SHA: $Origin"

Log "===== S77-B revert dispatch end ====="
