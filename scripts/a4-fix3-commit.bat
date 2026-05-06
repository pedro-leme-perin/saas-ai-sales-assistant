@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0a4-fix3-commit.ps1"
echo.
echo === DONE ===
pause >nul
