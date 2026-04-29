# S77 commit 1 - email.service.spec amplification + working tree restore + doc atomic
# Dispatched via File Explorer double-click on s77a-commit-and-push.bat

$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $PSScriptRoot 's77a-commit.log'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log {
    param([string]$Msg)
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $LogPath -Value "[$ts] $Msg"
    Write-Host $Msg
}

Log "===== S77-A commit dispatch start ====="
Log "Repo: $RepoRoot"
Log "PWD: $(Get-Location)"

# Step 1: cleanup .git/index.lock if present
$LockPath = Join-Path $RepoRoot '.git\index.lock'
if (Test-Path $LockPath) {
    Log "Lock exists at $LockPath - removing"
    try {
        Remove-Item $LockPath -Force -ErrorAction Stop
        Log "Lock removed OK"
    } catch {
        Log "Lock remove FAILED: $_"
        exit 1
    }
} else {
    Log "No lock present"
}

# Step 2: git status pre-add (forensic)
Log "--- git status pre-add ---"
$preStatus = git status -sb 2>&1 | Out-String
Log $preStatus

# Step 3: git add files
Log "--- git add scope ---"
$addPaths = @(
    'apps/backend/test/unit/email.service.spec.ts',
    'CHANGELOG.md',
    'PROJECT_HISTORY.md',
    'CLAUDE.md',
    'scripts/setup-sentry-alerts.sh',
    'scripts/setup-staging.sh',
    'tsconfig.json',
    'scripts/s77a-commit-msg.txt',
    'scripts/s77a-commit-and-push.ps1',
    'scripts/s77a-commit-and-push.bat'
)
foreach ($p in $addPaths) {
    if (Test-Path $p) {
        git add -- $p 2>&1 | ForEach-Object { Log "add $p : $_" }
    } else {
        Log "skip (missing): $p"
    }
}

# Step 4: git status post-add
Log "--- git status post-add ---"
$postStatus = git status -sb 2>&1 | Out-String
Log $postStatus

# Step 5: git commit
$MsgPath = Join-Path $PSScriptRoot 's77a-commit-msg.txt'
if (-not (Test-Path $MsgPath)) {
    Log "FATAL: commit message file missing: $MsgPath"
    exit 1
}
Log "--- git commit ---"
$commitOut = git commit -F $MsgPath 2>&1 | Out-String
Log $commitOut

if ($LASTEXITCODE -ne 0) {
    Log "FATAL: git commit failed with exit $LASTEXITCODE"
    exit $LASTEXITCODE
}

# Step 6: capture commit SHA
$Sha = (git rev-parse HEAD 2>&1).Trim()
Log "Commit SHA: $Sha"

# Step 7: git push origin main
Log "--- git push origin main ---"
$pushOut = git push origin main 2>&1 | Out-String
Log $pushOut

if ($LASTEXITCODE -ne 0) {
    Log "FATAL: git push failed with exit $LASTEXITCODE"
    exit $LASTEXITCODE
}

# Step 8: confirm origin/main aligned
$OriginSha = (git rev-parse origin/main 2>&1).Trim()
Log "origin/main SHA: $OriginSha"
if ($Sha -eq $OriginSha) {
    Log "OK: local HEAD == origin/main"
} else {
    Log "MISMATCH: local=$Sha origin=$OriginSha"
}

Log "===== S77-A commit dispatch end (exit 0) ====="
