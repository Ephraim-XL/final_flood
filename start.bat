@echo off
:: FloodSense — one-click start
:: Opens the dashboard locally and in your default browser.

set PROJECT=C:\Users\ephra\OneDrive\Desktop\flood

echo.
echo   FloodSense  ^|  http://localhost:3000
echo.
echo   Phone access: http://192.168.137.140:3000
echo   (Make sure your phone is on the same WiFi)
echo.

cd /d "%PROJECT%"
start http://localhost:3000
node server.js
