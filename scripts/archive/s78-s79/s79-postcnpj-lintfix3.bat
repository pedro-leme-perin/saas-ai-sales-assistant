@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0s79-postcnpj-lintfix3.ps1" > "%~dp0s79-postcnpj-lintfix3.log" 2>&1
type "%~dp0s79-postcnpj-lintfix3.log"
pause
