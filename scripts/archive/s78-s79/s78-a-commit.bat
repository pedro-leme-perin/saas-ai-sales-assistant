@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0s78-a-commit.ps1" > "%~dp0s78-a-commit.log" 2>&1
type "%~dp0s78-a-commit.log"
echo.
echo === DONE: log saved to %~dp0s78-a-commit.log ===
pause
