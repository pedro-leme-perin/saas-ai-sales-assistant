@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0s78-z-doc-closure.ps1" > "%~dp0s78-z-doc-closure.log" 2>&1
type "%~dp0s78-z-doc-closure.log"
pause
