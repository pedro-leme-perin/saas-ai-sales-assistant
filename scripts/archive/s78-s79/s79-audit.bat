@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0s79-audit.ps1" > "%~dp0s79-audit.log" 2>&1
type "%~dp0s79-audit.log"
pause
