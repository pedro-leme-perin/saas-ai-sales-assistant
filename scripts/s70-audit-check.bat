@echo off
cd /d "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\s70-audit-check.ps1"
echo.
pause >nul
