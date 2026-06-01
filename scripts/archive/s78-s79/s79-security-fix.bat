@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0s79-security-fix.ps1" > "%~dp0s79-security-fix.log" 2>&1
type "%~dp0s79-security-fix.log"
pause
