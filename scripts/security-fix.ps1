$ErrorActionPreference = 'Continue'
$LogPath = Join-Path $PSScriptRoot 'security-fix.log'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Log { param([string]$M); $ts=(Get-Date).ToString('HH:mm:ss'); Add-Content -Path $LogPath -Value "[$ts] $M"; Write-Host $M }

Log "===== security-fix dispatch ====="

# 1. Cleanup lock
$Lock = Join-Path $RepoRoot '.git\index.lock'
if (Test-Path $Lock) { Remove-Item $Lock -Force -ErrorAction SilentlyContinue; Log "lock removed" }

# 2. Restore corrupted billing.controller.ts from HEAD (Edit tool truncated post 9d795b8)
Log "--- restore billing.controller.ts from HEAD ---"
git checkout HEAD -- apps/backend/src/modules/billing/billing.controller.ts 2>&1 | ForEach-Object { Log "checkout: $_" }

# 3. Cleanup audit.json (local-only artifact)
if (Test-Path 'audit.json') {
    Remove-Item 'audit.json' -Force
    Log "deleted audit.json"
}

# 4. Add audit.json + .audit*.json to .gitignore (defensive)
$GitIgnore = '.gitignore'
if (Test-Path $GitIgnore) {
    $content = Get-Content $GitIgnore -Raw
    if ($content -notmatch '(?m)^audit\.json') {
        Add-Content -Path $GitIgnore -Value "`n# pnpm audit local artifacts`naudit.json`n.audit*.json"
        Log "appended audit.json to .gitignore"
    }
}

# 5. pnpm install to update lockfile with new overrides
Log "--- pnpm install (lockfile update) ---"
$piOut = pnpm install --no-frozen-lockfile 2>&1 | Out-String
Log $piOut.Substring(0, [Math]::Min(2000, $piOut.Length))
if ($LASTEXITCODE -ne 0) { Log "pnpm install FAILED $LASTEXITCODE"; exit $LASTEXITCODE }

# 6. Verify HIGH count == 0 post-install
Log "--- audit re-check ---"
$auditOut = pnpm audit --prod --audit-level=high --json 2>&1 | Out-String
# Save temp for grep
$auditOut | Out-File -FilePath '/tmp/audit-check.json' -Encoding utf8 -ErrorAction SilentlyContinue
try {
    $audit = $auditOut | ConvertFrom-Json
    $count = ($audit.metadata.vulnerabilities.high + $audit.metadata.vulnerabilities.critical)
    Log "HIGH+CRITICAL count post-fix: $count"
    if ($count -gt 0) { Log "WARN: still $count remaining" }
} catch { Log "audit parse note: $_" }

# 7. git status pre-add
Log "--- git status pre-add ---"
$pre = git status -sb 2>&1 | Out-String
Log $pre

# 8. Stage
git add -- package.json pnpm-lock.yaml .gitignore 2>&1 | ForEach-Object { Log "add: $_" }
git add -- scripts/security-fix-msg.txt scripts/security-fix.ps1 scripts/security-fix.bat 2>&1 | ForEach-Object { Log "add: $_" }
git add -- scripts/stripe-webhook-test.ps1 2>&1 | ForEach-Object { Log "add: $_" }

# 9. git commit
$Msg = Join-Path $PSScriptRoot 'security-fix-msg.txt'
$out = git commit -F $Msg 2>&1 | Out-String
Log $out
if ($LASTEXITCODE -ne 0) { Log "commit FAILED $LASTEXITCODE"; exit $LASTEXITCODE }

# 10. push
$Sha = (git rev-parse HEAD 2>&1).Trim()
Log "SHA: $Sha"
$pushOut = git push origin main 2>&1 | Out-String
Log $pushOut
if ($LASTEXITCODE -ne 0) { Log "push FAILED $LASTEXITCODE"; exit $LASTEXITCODE }

Log "===== done ====="
