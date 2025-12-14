@echo off
REM ============================================
REM Autonim-Poker Development Setup Script
REM Creates symlink for rapid development
REM ============================================
REM 
REM This script creates a symbolic link from the Adobe CEP extensions
REM folder to your development folder, so you don't need to copy
REM files manually after each change.
REM
REM USAGE:
REM   1. Right-click this file
REM   2. Select "Run as administrator"
REM   3. That's it! Changes will be reflected immediately.
REM
REM To test changes:
REM   - Save your code
REM   - In AE: Close the panel (click X on panel tab)
REM   - Reopen: Window > Extensions > Autonim-Poker
REM
REM ============================================

echo.
echo ========================================
echo Autonim-Poker Development Setup
echo ========================================
echo.

REM Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please run this script as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Configuration
set "DEV_FOLDER=%~dp0"
set "CEP_FOLDER=C:\Program Files (x86)\Common Files\Adobe\CEP\extensions"
set "LINK_NAME=Autonim-Poker"

REM Remove trailing backslash from DEV_FOLDER
if "%DEV_FOLDER:~-1%"=="\" set "DEV_FOLDER=%DEV_FOLDER:~0,-1%"

echo Development folder: %DEV_FOLDER%
echo CEP Extensions folder: %CEP_FOLDER%
echo Link name: %LINK_NAME%
echo.

REM Check if CEP folder exists
if not exist "%CEP_FOLDER%" (
    echo Creating CEP extensions folder...
    mkdir "%CEP_FOLDER%"
)

REM Check if link already exists
if exist "%CEP_FOLDER%\%LINK_NAME%" (
    echo Existing link/folder found. Removing...
    rmdir "%CEP_FOLDER%\%LINK_NAME%" 2>nul
    if exist "%CEP_FOLDER%\%LINK_NAME%" (
        rmdir /s /q "%CEP_FOLDER%\%LINK_NAME%" 2>nul
    )
)

REM Create symbolic link
echo Creating symbolic link...
mklink /D "%CEP_FOLDER%\%LINK_NAME%" "%DEV_FOLDER%"

if %errorLevel% equ 0 (
    echo.
    echo ========================================
    echo SUCCESS! Symlink created.
    echo ========================================
    echo.
    echo Your development folder is now linked to:
    echo %CEP_FOLDER%\%LINK_NAME%
    echo.
    echo WORKFLOW:
    echo   1. Edit code in your dev folder
    echo   2. Save the file
    echo   3. In After Effects:
    echo      - Close the panel tab
    echo      - Window ^> Extensions ^> Autonim-Poker
    echo   4. Panel reloads with new code!
    echo.
    echo TIP: To debug, press Ctrl+Shift+J in the panel
    echo      to open Chrome DevTools.
    echo.
) else (
    echo.
    echo ERROR: Failed to create symlink.
    echo Make sure you're running as Administrator.
    echo.
)

pause
