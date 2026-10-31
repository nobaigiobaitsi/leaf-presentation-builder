@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto missing
call npm ci
if errorlevel 1 goto failed
call npm run desktop:setup
if errorlevel 1 goto failed
call npm run desktop:make
if errorlevel 1 goto failed
explorer "desktop\out\make\squirrel.windows\x64"
echo Installer ready. Share LEAF-Presentations-Setup.exe with your colleagues.
pause
exit /b 0
:missing
echo Install Node.js 22.12+ first, then run this file again.
pause
exit /b 1
:failed
echo Build failed. Read the error above. No installer is ready yet.
pause
exit /b 1
