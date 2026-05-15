@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul

echo ===================================================
echo        Faster-Whisper Subtitle Launcher
echo ===================================================
echo.

:: 1. 檢查虛擬環境是否存在
if not exist "venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment venv not found.
    echo Please run install.bat first.
    echo.
    pause
    exit /b
)

:: 2. 檢查本地便攜版 FFmpeg（拆開寫，避免 if else 巢狀語法崩潰）
if exist "ffmpeg\bin\ffmpeg.exe" (
    set "PATH=%~dp0ffmpeg\bin;%PATH%"
)

if exist "ffmpeg\ffmpeg.exe" (
    set "PATH=%~dp0ffmpeg;%PATH%"
)

:: 3. 激活虛擬環境
echo [INFO] Activating virtual environment...
call venv\Scripts\activate

:: 4. 執行 Python 字幕腳本
echo [INFO] Starting subtitle generation...
echo ---------------------------------------------------
python auto_subtitle.py
echo ---------------------------------------------------

echo.
echo [SUCCESS] Script finished execution.
echo.
pause