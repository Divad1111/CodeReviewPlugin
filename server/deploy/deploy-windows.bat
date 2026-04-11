@echo off
REM ==========================================
REM Code Review Server - Windows Deploy Script
REM ==========================================

echo ======================================
echo  Code Review Server - Windows Deployment
echo ======================================

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed.
    echo Please install Node.js 18+ from https://nodejs.org/
    exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
echo [OK] Node.js found

REM Check MongoDB
where mongod >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    where mongosh >nul 2>nul
    if %ERRORLEVEL% NEQ 0 (
        echo [WARN] MongoDB is not detected locally.
        echo Please install MongoDB before deployment.
        echo Winget example: winget install MongoDB.Server
        echo Chocolatey example: choco install mongodb
        echo Guide: https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows/
    )
)

REM Get server directory
set SCRIPT_DIR=%~dp0
set SERVER_DIR=%SCRIPT_DIR%..

REM Install dependencies
echo [*] Installing dependencies...
cd /d "%SERVER_DIR%"
call npm install

REM Build TypeScript
echo [*] Building TypeScript...
call npm run build

REM Create .env if not exists
if not exist "%SERVER_DIR%\.env" (
    echo [*] Creating .env from template...
    copy "%SERVER_DIR%\.env.example" "%SERVER_DIR%\.env"
    echo [!] Please update %SERVER_DIR%\.env with your settings
    echo [!] IMPORTANT: Change JWT_SECRET to a random value!
)

REM Install pm2 if not available
where pm2 >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [*] Installing pm2 globally...
    call npm install -g pm2
)

REM Start with pm2
echo [*] Starting server with pm2...
cd /d "%SERVER_DIR%"
call pm2 stop code-review-server 2>nul
call pm2 start dist\index.js --name code-review-server
call pm2 save

echo.
echo ======================================
echo  Deployment Complete!
echo ======================================
echo  Server: http://localhost:3000
echo  Health: http://localhost:3000/api/health
echo.
echo  Commands:
echo    pm2 status          - Check status
echo    pm2 logs            - View logs
echo    pm2 restart all     - Restart
echo    pm2 stop all        - Stop
echo ======================================
