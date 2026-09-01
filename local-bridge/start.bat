@echo off
:: FloodSense — One-click start for Local Bridge
:: Reads Arduino serial and forwards to cloud relay
::
:: Before first run: npm install
::

set PROJECT=C:\Users\ephra\OneDrive\Desktop\flood\local-bridge
set RELAY_URL=wss://floodsense.onrender.com

echo.
echo   FloodSense Bridge
echo   Relay: %RELAY_URL%
echo   (Press Ctrl+C to stop)
echo.

cd /d "%PROJECT%"
set RELAY_URL=%RELAY_URL%
node bridge.js
