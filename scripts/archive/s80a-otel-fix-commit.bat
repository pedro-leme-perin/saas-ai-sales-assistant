@echo off
REM S80-A: @opentelemetry/exporter-prometheus override commit + push
REM Double-click via File Explorer (lesson #21)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0s80a-otel-fix-commit.ps1"
pause
