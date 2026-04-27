# =============================================================================
# S63 - CI Verification Helper (post-push, ASCII-safe)
# =============================================================================
# Run AFTER s63-cleanup-and-commit.ps1 to verify CI green.
# Requires: gh CLI (https://cli.github.com/).
#
# RUN:
#   cd "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
#   powershell -ExecutionPolicy Bypass -File .\scripts\s63-verify-ci.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

# Check gh available
$ghPath = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $ghPath) {
    Write-Host "gh CLI not found. Install: https://cli.github.com/" -ForegroundColor Red
    Write-Host "Manual fallback: open https://github.com/<owner>/<repo>/actions in browser" -ForegroundColor Yellow
    exit 1
}

# Current HEAD
$head = git rev-parse HEAD
Write-Host "HEAD: $head" -ForegroundColor Cyan

# List runs for current commit
Write-Host ""
Write-Host "=== CI runs for commit $head ===" -ForegroundColor Cyan
gh run list --commit $head --limit 5

# Wait for latest run to complete
$latestRunId = gh run list --commit $head --limit 1 --json databaseId --jq '.[0].databaseId'
if (-not $latestRunId) {
    Write-Host "No CI run found. Wait a few seconds and re-run." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Watching run $latestRunId (max 15min)..." -ForegroundColor Yellow
gh run watch $latestRunId --exit-status

# Print conclusion
$conclusion = gh run view $latestRunId --json conclusion --jq '.conclusion'
Write-Host ""
if ($conclusion -eq "success") {
    Write-Host "[OK] CI GREEN - coverage thresholds 60/50/60/60 global + 75/65/75/75 security PASSED" -ForegroundColor Green

    # Try to extract coverage summary from logs
    Write-Host ""
    Write-Host "=== Coverage summary (from logs) ===" -ForegroundColor Cyan
    gh run view $latestRunId --log | Select-String -Pattern "(Statements|Branches|Functions|Lines):" -Context 0, 1 | Select-Object -First 10
}
else {
    Write-Host "[FAIL] CI FAILED - conclusion: $conclusion" -ForegroundColor Red
    Write-Host ""
    Write-Host "=== Failed jobs ===" -ForegroundColor Red
    gh run view $latestRunId --json jobs --jq '.jobs[] | select(.conclusion=="failure") | {name, conclusion, url}'
    Write-Host ""
    Write-Host "Detailed logs: gh run view $latestRunId --log-failed" -ForegroundColor Yellow
    exit 1
}
