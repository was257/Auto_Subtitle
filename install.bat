@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo        Faster-Whisper Subtitle Installer
echo ===================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed.
    echo Please install Python 3.8+ and check "Add Python to PATH".
    echo.
    pause
    exit /b
)
echo SUCCESS: Python is detected.

ffmpeg -version >nul 2>&1
if %errorlevel% equ 0 (
    echo SUCCESS: FFmpeg is already installed in system.
    goto VENV_SECTION
)

echo INFO: FFmpeg not found. Downloading portable version...

if not exist "ffmpeg" mkdir "ffmpeg"
if not exist "ffmpeg\bin\ffmpeg.exe" (
    echo INFO: Downloading FFmpeg zip from web...
    powershell -Command "& {Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' -OutFile 'ffmpeg\ffmpeg.zip'}"
    
    if !errorlevel! neq 0 (
        echo ERROR: Failed to download FFmpeg. Check internet.
        goto FFMPEG_FAIL
    )

    echo INFO: Extracting FFmpeg...
    powershell -Command "& {Expand-Archive -Path 'ffmpeg\ffmpeg.zip' -DestinationPath 'ffmpeg\temp' -Force}"
    
    for /d %%i in (ffmpeg\temp\*) do (
        move "%%i\bin\*" "ffmpeg\"
    )
    
    rmdir /s /q "ffmpeg\temp"
    del /q "ffmpeg\ffmpeg.zip"
    
    echo SUCCESS: FFmpeg installed in project folder.
) else (
    echo INFO: Portable FFmpeg already exists. Skipping download.
)

set "PATH=%~dp0ffmpeg;%PATH%"
goto VENV_SECTION

:FFMPEG_FAIL
echo WARNING: FFmpeg install failed. You must install it manually later.
pause

:VENV_SECTION
echo.
echo ===================================================
echo 配置 Python 虚拟环境...
echo ===================================================

if not exist "venv" (
    echo INFO: Creating venv...
    python -m venv venv
) else (
    echo INFO: venv already exists.
)

echo INFO: Activating venv and upgrading pip...
call venv\Scripts\activate

python -m pip install --upgrade pip

if exist "requirements.txt" (
    echo INFO: Installing Python dependencies...
    pip install -r requirements.txt
    echo SUCCESS: All dependencies installed.
) else (
    echo ERROR: requirements.txt not found.
)

echo.
echo ===================================================
echo Done. Please run: python auto_subtitle.py
echo ===================================================
echo.
pause