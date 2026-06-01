@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0s78-a-fix.ps1" > "%~dp0s78-a-fix.log" 2>&1
type "%~dp0s78-a-fix.log"
pause
