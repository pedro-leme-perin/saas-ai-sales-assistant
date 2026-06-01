@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0s79-postcnpj-retry2.ps1" > "%~dp0s79-postcnpj-retry2.log" 2>&1
type "%~dp0s79-postcnpj-retry2.log"
pause
