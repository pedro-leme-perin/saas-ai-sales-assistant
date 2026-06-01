@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0s78-a-push.ps1" > "%~dp0s78-a-push.log" 2>&1
type "%~dp0s78-a-push.log"
echo.
echo === DONE ===
pause
