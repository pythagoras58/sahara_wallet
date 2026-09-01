@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Stopping Sahara Wallet
echo ============================================
echo.

echo Stopping Web app (port 3001)...
set FOUND=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
    set FOUND=1
)
if !FOUND!==0 echo   (was not running)

echo Stopping API (port 3000)...
set FOUND=0
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
    set FOUND=1
)
if !FOUND!==0 echo   (was not running)

echo.
echo ============================================
echo   API and Web app stopped
echo   PostgreSQL keeps running as a background Windows
echo   service -- that's expected, it's not specific to
echo   Sahara Wallet.
echo ============================================
pause
