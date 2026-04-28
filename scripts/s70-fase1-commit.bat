@echo off
REM scripts/s70-fase1-commit.bat
REM
REM S70 Phase 1 launcher: invokes the PS1 commit script with ExecutionPolicy
REM bypass so it can run via double-click in File Explorer.
REM Window stays open at end (PS1 waits for keypress).

cd /d "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\s70-fase1-commit.ps1"
echo.
echo ==> Batch wrapper finished. Press any key to close window.
pause >nul
