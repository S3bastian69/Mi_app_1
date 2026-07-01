@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js 20 o posterior.
  echo Instalalo desde https://nodejs.org y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

node tests\run-tests.mjs
if errorlevel 1 (
  echo.
  echo Las pruebas encontraron errores.
  pause
  exit /b 1
)

echo.
echo Todas las pruebas terminaron correctamente.
pause
endlocal
