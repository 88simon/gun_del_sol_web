@echo off
title Gun Del Sol - Frontend
REM ============================================================================
REM Gun Del Sol - Frontend Launcher
REM ============================================================================
REM Starts the Next.js development server on http://localhost:3000
REM ============================================================================

set SCRIPT_DIR=%~dp0

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "%SCRIPT_DIR%node_modules" (
    echo Installing dependencies...
    echo.
    cd /d "%SCRIPT_DIR%"
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERROR: Failed to install dependencies
        echo.
        pause
        exit /b 1
    )
)

REM Start the Next.js development server
echo.
echo Starting Gun Del Sol Frontend...
echo.
echo Backend API: http://localhost:5001
echo Frontend:    http://localhost:3000
echo.
cd /d "%SCRIPT_DIR%"
title Gun Del Sol - Frontend
call npm run dev
title Gun Del Sol - Frontend

REM If we get here, the server was stopped
echo.
echo Frontend stopped.
pause
