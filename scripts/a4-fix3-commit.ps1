$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $PSScriptRoot 'a4-fix3.log'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log {
    param([string]$Msg)
    $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    Add-Content -Path $LogPath -Value "[$ts] $Msg"
    Write-Host $Msg
}

Log "===== A4 fix #3 dispatch start ====="

$LockPath = Join-Path $RepoRoot '.git\index.lock'
if (Test-Path $LockPath) {
    Remove-Item $LockPath -Force -ErrorAction SilentlyContinue
    Log "Stale lock removed"
}

Log "--- type-check backend ---"
$tc = pnpm --filter=@saas/backend type-check 2>&1 | Out-String
Log $tc
if ($LASTEXITCODE -ne 0) {
    Log "FATAL: type-check failed exit $LASTEXITCODE"
    exit $LASTEXITCODE
}

Log "--- git add ---"
git add -- apps/backend/src/modules/billing/billing.controller.ts 2>&1 | ForEach-Object { Log "add: $_" }
git add -- scripts/a4-fix3-msg.txt scripts/a4-fix3-commit.ps1 scripts/a4-fix3-commit.bat 2>&1 | ForEach-Object { Log "add: $_" }

Log "--- git status post-add ---"
$post = git status -sb 2>&1 | Out-String
Log $post

$MsgPath = Join-Path $PSScriptRoot 'a4-fix3-msg.txt'
Log "--- git commit ---"
$out = git commit -F $MsgPath 2>&1 | Out-String
Log $out

if ($LASTEXITCODE -ne 0) {
    Log "FATAL: git commit failed exit $LASTEXITCODE"
    exit $LASTEXITCODE
}

$Sha = (git rev-parse HEAD 2>&1).Trim()
Log "Commit SHA: $Sha"

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

Log "===== A4 fix #3 dispatch end ====="
