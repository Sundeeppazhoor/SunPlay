@echo off
setlocal
echo ===================================================
echo   SunPlay IPK Packaging
echo ===================================================

cd /d "%~dp0"

if not exist dist mkdir dist

echo Packaging app directory into webOS IPK...
call ares-package app -o dist

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] ares-package failed!
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] Package created in dist\
dir dist\*.ipk
echo ===================================================
echo To install on your LG TV:
echo   ares-install dist\com.sunplay.native_1.0.0_all.ipk -d ^<device_name^>
echo To launch:
echo   ares-launch com.sunplay.native -d ^<device_name^>
echo ===================================================
pause
