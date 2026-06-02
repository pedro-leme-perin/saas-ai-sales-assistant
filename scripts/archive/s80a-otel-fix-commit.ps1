# S80-A: @opentelemetry/exporter-prometheus override commit + push
# ASCII-only + CRLF (lessons #6, #8)
# Uses cmd /c wrappers to avoid PowerShell+git stderr/exit quirks
# (lesson NEW: $args is reserved in PS; use cmd /c for clean integration)

$ErrorActionPreference = "Continue"
$env:GIT_TERMINAL_PROMPT = "0"

$repoRoot = "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
Set-Location -LiteralPath $repoRoot

$logPath = Join-Path $repoRoot "scripts\s80a-otel-fix.log"
$msgPath = Join-Path $repoRoot "scripts\s80a-otel-fix-commit-msg.txt"

# Init log (overwrite)
"=== S80-A commit script ===" | Out-File -FilePath $logPath -Encoding ASCII

function Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $logPath -Value $line -Encoding ASCII
}

function Run-Git {
    param([string]$cmdline, [bool]$critical = $false)
    Log "RUN: git $cmdline"
    $fullCmd = "git $cmdline >> `"$logPath`" 2>&1"
    cmd /c $fullCmd
    $exit = $LASTEXITCODE
    Log "  exit=$exit"
    if ($critical -and $exit -ne 0) {
        Log "CRITICAL FAILURE - aborting"
        Write-Host ""
        Write-Host "FAILED at: git $cmdline (exit=$exit). Check log."
        Write-Host "Press ENTER to close."
        Read-Host | Out-Null
        exit $exit
    }
    return $exit
}

Log "Starting S80-A commit + push"
Log "cwd: $(Get-Location)"

# Step 1: Cleanup locks
Log "Step 1: Cleanup stale git locks"
@(".git\index.lock", ".git\HEAD.lock", ".git\objects\pack\multi-pack-index") | ForEach-Object {
    if (Test-Path $_) {
        Log "  Removing $_"
        Remove-Item -LiteralPath $_ -Force -ErrorAction SilentlyContinue
    }
}

# Step 2: Fetch (not critical, just sync)
Log "Step 2: git fetch origin main"
Run-Git "fetch origin main" $false | Out-Null

# Step 3: Reset staging
Log "Step 3: git reset HEAD ."
Run-Git "reset HEAD ." $false | Out-Null

# Step 4: Pre-commit status
Log "Step 4: Pre-commit git status"
Run-Git "status -sb" $false | Out-Null

# Step 5: Stage selective files
Log "Step 5: Stage selective files for S80-A"
$filesToStage = @(
    "CLAUDE.md",
    "PROJECT_HISTORY.md"
)
foreach ($f in $filesToStage) {
    if (Test-Path $f) {
        Log "  Staging $f"
        Run-Git "add -- `"$f`"" $true | Out-Null
    } else {
        Log "  SKIP (not exist): $f"
    }
}

# Step 6: Diff cached
Log "Step 6: Show diff --stat of staged changes"
Run-Git "diff --cached --stat" $false | Out-Null

# Step 7: Commit (CRITICAL)
Log "Step 7: git commit -F"
if (-not (Test-Path $msgPath)) {
    Log "ERROR: commit message file missing: $msgPath"
    Write-Host "Press ENTER to close."
    Read-Host | Out-Null
    exit 1
}
Run-Git "commit -F `"$msgPath`"" $true | Out-Null

# Step 8: Verify HEAD
Log "Step 8: Verify HEAD post-commit"
Run-Git "log -1 --oneline" $false | Out-Null

# Step 9: Push (CRITICAL)
Log "Step 9: git push origin main"
Run-Git "push origin main" $true | Out-Null

# Step 10: Post-push state
Log "Step 10: Post-push verification"
Run-Git "status -sb" $false | Out-Null
Run-Git "log -1 --stat" $false | Out-Null

Log "=== S80-A commit + push completed SUCCESSFULLY ==="
Write-Host ""
Write-Host "SUCCESS. Press ENTER to close."
Read-Host | Out-Null
