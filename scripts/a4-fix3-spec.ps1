$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $PSScriptRoot 'a4-fix3-spec.log'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log { param([string]$M); $ts=(Get-Date).ToString('HH:mm:ss'); Add-Content -Path $LogPath -Value "[$ts] $M"; Write-Host $M }

Log "===== fix3 spec dispatch ====="
$Lock = Join-Path $RepoRoot '.git\index.lock'
if (Test-Path $Lock) { Remove-Item $Lock -Force -ErrorAction SilentlyContinue; Log "lock removed" }

git add -- apps/backend/test/unit/billing.controller.spec.ts 2>&1 | ForEach-Object { Log "add: $_" }
git add -- scripts/a4-fix3-spec-msg.txt scripts/a4-fix3-spec.ps1 scripts/a4-fix3-spec.bat 2>&1 | ForEach-Object { Log "add: $_" }

$Msg = Join-Path $PSScriptRoot 'a4-fix3-spec-msg.txt'
$out = git commit -F $Msg 2>&1 | Out-String
Log $out
if ($LASTEXITCODE -ne 0) { Log "commit FAILED $LASTEXITCODE"; exit $LASTEXITCODE }

$Sha = (git rev-parse HEAD 2>&1).Trim()
Log "SHA: $Sha"

$pushOut = git push origin main 2>&1 | Out-String
Log $pushOut
if ($LASTEXITCODE -ne 0) { Log "push FAILED $LASTEXITCODE"; exit $LASTEXITCODE }

Log "===== done ====="
