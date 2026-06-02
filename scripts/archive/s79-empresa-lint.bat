@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0s79-empresa-lint.ps1" > "%~dp0s79-empresa-lint.log" 2>&1
type "%~dp0s79-empresa-lint.log"
pause
