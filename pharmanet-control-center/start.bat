@echo off
REM ===================================================================
REM  PharmaNET Control Center - one-click local launcher (Windows)
REM
REM  Double-click this file to start the app on your own PC.
REM  It installs dependencies the first time, starts the local server,
REM  and opens the app in your browser. Close this window to stop.
REM ===================================================================

cd /d "%~dp0"
title PharmaNET Control Center

REM --- Check that Node.js is installed ---
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed or not on your PATH.
  echo  Install the LTS version from https://nodejs.org then run this again.
  echo.
  pause
  exit /b 1
)

REM --- Install dependencies the first time only ---
if not exist "node_modules" (
  echo.
  echo  First run: installing dependencies, please wait...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  npm install failed. See the messages above.
    echo.
    pause
    exit /b 1
  )
)

REM --- Open the browser shortly after the server starts ---
start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:8788"

echo.
echo  Starting PharmaNET Control Center...
echo  When it says "running locally", your browser will open automatically.
echo  Keep this window open while you use the app. Close it to stop.
echo.

REM --- Start the local server (blocks until you close the window) ---
node server.mjs

echo.
echo  Server stopped.
pause
