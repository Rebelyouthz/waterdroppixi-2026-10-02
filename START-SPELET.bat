@echo off
title Waterdrop Survivor
cd /d "%~dp0frontend"

echo.
echo   ============================================
echo    WATERDROP SURVIVOR
echo   ============================================
echo.

REM Is the dev server already listening? Starting a second one just fails on
REM the port and leaves you staring at an error, so check first.
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul 2>&1
if %errorlevel%==0 (
  echo   Servern kor redan pa port 3000.
) else (
  echo   Startar servern...
  start "Waterdrop server" cmd /c "npm start"
  REM CRA needs a few seconds before the port is up.
  timeout /t 12 /nobreak >nul
)

echo.
echo   PA DATORN:  http://localhost:3000
echo.

REM cloudflared is downloaded on first run and reused after that. It is far
REM more stable than the ssh tunnels — those dropped every few minutes.
set "CFD=%TEMP%\cloudflared.exe"
if not exist "%CFD%" (
  echo   Hamtar cloudflared en gang...
  curl -sL -o "%CFD%" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
)

echo   Startar tunneln for telefonen...
echo.
echo   Adressen dyker upp harunder som https://NAGOT.trycloudflare.com
echo   Oppna den i telefonens webblasare.
echo.
echo   Stang det har fonstret for att stanga tunneln.
echo   ============================================
echo.

"%CFD%" tunnel --url http://localhost:3000 --no-autoupdate
pause
