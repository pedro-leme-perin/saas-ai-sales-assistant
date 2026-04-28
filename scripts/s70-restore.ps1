# scripts/s70-restore.ps1
#
# Utility: restore CLAUDE.md and PROJECT_HISTORY.md from HEAD when working tree
# corruption pattern (Lesson #5) truncates them. Used during S70 Fase 1; kept
# as reference for future sessions.
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File scripts\s70-restore.ps1
#
# What it does:
#   1. Removes stale .git/index.lock if present
#   2. git checkout HEAD -- CLAUDE.md PROJECT_HISTORY.md
#   3. Reports line counts post-restore
#
# Prefer the sandbox approach when available:
#   git show HEAD:<file> > /sessions/.../tmp/<file>
#   cp /sessions/.../tmp/<file> /sessions/.../mnt/PROJETO SAAS IA OFICIAL/<file>
#
# ASCII-only per Lesson #6 (PowerShell CP1252 default, no accents/em-dashes/quotes).

$ErrorActionPreference = "Continue"
Set-Location "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"

Write-Host "==> Restore corrupted CLAUDE.md and PROJECT_HISTORY.md from HEAD"
Write-Host ""

$lockFile = ".git\index.lock"
if (Test-Path $lockFile) {
    Write-Host "Removing stale .git/index.lock"
    Remove-Item -Force $lockFile -ErrorAction SilentlyContinue
}

Write-Host "HEAD before restore:"
& git log -1 --oneline
Write-Host ""

Write-Host "Status before restore:"
& git status -s
Write-Host ""

Write-Host "Restoring CLAUDE.md and PROJECT_HISTORY.md..."
& git checkout HEAD -- CLAUDE.md PROJECT_HISTORY.md
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: git checkout failed (exit $LASTEXITCODE)"
    exit 1
}

$claudeLines = (Get-Content -LiteralPath "CLAUDE.md" | Measure-Object -Line).Lines
$historyLines = (Get-Content -LiteralPath "PROJECT_HISTORY.md" | Measure-Object -Line).Lines
Write-Host ""
Write-Host "Post-restore line counts:"
Write-Host "  CLAUDE.md:          $claudeLines lines"
Write-Host "  PROJECT_HISTORY.md: $historyLines lines"
Write-Host ""

Write-Host "Status after restore:"
& git status -s
Write-Host ""

Write-Host "==> Restore complete."
exit 0
