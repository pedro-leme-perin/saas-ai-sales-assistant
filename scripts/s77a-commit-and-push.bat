@echo off
REM S77-A wrapper - invokes PowerShell PS1 with bypass policy
REM Dispatched via File Explorer double-click
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0s77a-commit-and-push.ps1"
echo.
echo === DONE ===
echo Press any key to close window...
pause >nul
