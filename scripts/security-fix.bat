@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0security-fix.ps1"
echo.
echo === DONE ===
pause >nul
