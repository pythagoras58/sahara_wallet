@echo off
setlocal enabledelayedexpansion
set ROOT=%~dp0
set ROOT=%ROOT:~0,-1%

echo ============================================
echo   Starting Sahara Wallet
echo ============================================
echo.

echo [1/3] Checking local database (PostgreSQL)...
set PGSERVICE=
for /f "tokens=2" %%s in ('sc query state^= all ^| findstr /C:"SERVICE_NAME: postgresql-"') do set PGSERVICE=%%s
if "!PGSERVICE!"=="" (
    echo   No postgresql-x64-* Windows service found. Is PostgreSQL installed?
    echo   See FRIEND_SETUP.md for install steps.
    pause
    exit /b 1
)
sc query "!PGSERVICE!" | findstr "RUNNING" >nul
if errorlevel 1 (
    echo   Service !PGSERVICE! is not running -- attempting to start it...
    net start "!PGSERVICE!" >nul 2>&1
    if errorlevel 1 (
        echo   Could not start it automatically ^(needs an admin prompt^).
        echo   Open Services, start "!PGSERVICE!", then re-run this script.
        pause
        exit /b 1
    )
) else (
    echo   !PGSERVICE! already running.
)
echo.

echo [2/3] Starting API on http://localhost:3000 ...
start "Sahara API" cmd /k "cd /d "%ROOT%\apps\api" && npm run start:dev"
echo Waiting for the API to boot...
ping -n 13 127.0.0.1 >nul
echo.

echo [3/3] Starting Web app on http://localhost:3001 ...
start "Sahara Web" cmd /k "cd /d "%ROOT%\apps\web" && npm run dev -- -p 3001"
echo.

echo ============================================
echo   All services starting
echo.
echo   API:  http://localhost:3000
echo   Web:  http://localhost:3001
echo.
echo   Two new windows opened for the API and Web app -- check
echo   them if something doesn't come up (closing this window
echo   will NOT stop them).
echo.
echo   If the API window shows a database connection error, confirm
echo   PostgreSQL is running (Services) and that apps\api\.env has the
echo   right DATABASE_URL, then re-run this script.
echo.
echo   Run stop-sahara.bat to stop the API and Web app. PostgreSQL keeps
echo   running as a background Windows service -- that's expected.
echo ============================================
pause
