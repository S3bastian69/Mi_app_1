@echo off
setlocal
cd /d "%~dp0"

set "PYTHON=python"
if exist "..\.venv\Scripts\python.exe" set "PYTHON=..\.venv\Scripts\python.exe"

echo Iniciando App Converter en http://127.0.0.1:4174
start "Servidor App Converter" "%PYTHON%" server.py --port 4174
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4174"
endlocal
