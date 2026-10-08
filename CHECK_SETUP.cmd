@echo off
title Rustin website setup check
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\setup-check.ps1"
echo.
pause

