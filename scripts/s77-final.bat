@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0s77-final.ps1"
echo.
echo === DONE ===
pause >nul
