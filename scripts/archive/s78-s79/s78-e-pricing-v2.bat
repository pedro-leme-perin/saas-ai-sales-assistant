@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0s78-e-pricing-v2.ps1" > "%~dp0s78-e-pricing-v2.log" 2>&1
type "%~dp0s78-e-pricing-v2.log"
pause
