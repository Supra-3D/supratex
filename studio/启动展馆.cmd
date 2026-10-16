@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 (
    node "%~dp0start-studio.mjs" --open %*
) else if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "%~dp0start-studio.mjs" --open %*
) else (
    echo Node.js was not found. Please install Node.js, then run this file again.
    pause
    exit /b 1
)
if errorlevel 1 pause
