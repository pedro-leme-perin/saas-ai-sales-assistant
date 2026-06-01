@echo off
REM S79 push only — commit fd3143d already exists locally
cd /d "C:\Users\pedro\Dev\PROJETO SAAS IA OFICIAL"
set HUSKY=0
echo === Push start %DATE% %TIME% === > scripts\s79-push.log
git push origin main >> scripts\s79-push.log 2>&1
echo. >> scripts\s79-push.log
echo Exit code: %ERRORLEVEL% >> scripts\s79-push.log
echo === End === >> scripts\s79-push.log
set HUSKY=
