@echo off
chcp 65001 > nul
title MebelCraft Demo Launcher
echo ====================================================
echo   MebelCraft: Демо-сайт мебели на заказ
echo ====================================================
echo.
echo Открытие сайта в браузере...

REM Try to launch python local server if python is installed, otherwise open file directly
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Обнаружен Python. Запуск локального HTTP-сервера...
    start "" http://localhost:8080/
    python -m http.server 8080
) else (
    echo [INFO] Запуск страницы напрямую через браузер...
    start "" "%~dp0index.html"
)
