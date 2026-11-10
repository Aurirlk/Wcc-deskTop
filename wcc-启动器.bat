@echo off
chcp 65001 >nul
title WCC Launcher
rem --- Locate node: prefer system PATH, then fall back to bundled WorkBuddy node ---
rem --- No machine-specific user path is hard-coded; portable across computers ---
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" (
    set "PATH=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-6;%PATH%"
  ) else (
    echo [ERROR] Node.js not found. Please install Node.js 20+ first.
    pause
    exit /b 1
  )
)
cd /d "%~dp0"
:menu
cls
echo ========================================
echo   WCC - Warcraft Campaign Craft (WuJingTu)
echo ========================================
echo  [1] Start Sidecar  (Agent Loop, http://localhost:47840)
echo  [2] Lua static check  (npm run check)
echo  [3] Run unit tests   (npm test)
echo  [4] Start Desktop UI (needs Electron installed)
echo  [5] Harness demo / selftest (offline, no API key)
echo  [0] Exit
echo.
set /p c=Choose:
if "%c%"=="1" (echo. & call npm run sidecar & pause & goto menu)
if "%c%"=="2" (echo. & call npm run check & pause & goto menu)
if "%c%"=="3" (echo. & call npm test & pause & goto menu)
if "%c%"=="4" (echo. & call npm run dev:desktop & pause & goto menu)
if "%c%"=="5" (echo. & node harness\bin\wcc-harness.mjs demo & echo. & node --test harness\test\harness.test.js & pause & goto menu)
if "%c%"=="0" (exit /b)
goto menu
