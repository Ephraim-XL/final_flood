@echo off
:: FloodSense — One-click public access via localtunnel
:: Starts: relay server + bridge + public URL tunnel
::
:: First run: npm install -g localtunnel
::

set PROJECT=C:\Users\ephra\OneDrive\Desktop\flood
set RELAY_URL=ws://localhost:3000

echo.
echo   FloodSense — Starting public tunnel...
echo.

:: 1. Start relay server
start "FloodSense Relay" cmd /c "cd /d %PROJECT%\cloud-relay && node server.js"

:: 2. Wait for relay to be ready
timeout /t 3 /nobreak > nul

:: 3. Start bridge (pointing to local relay)
start "FloodSense Bridge" cmd /c "cd /d %PROJECT%\local-bridge && set RELAY_URL=%RELAY_URL% && node bridge.js"

:: 4. Wait a moment
timeout /t 2 /nobreak > nul

:: 5. Start tunnel
echo   Opening public tunnel...
echo.
lt --port 3000
