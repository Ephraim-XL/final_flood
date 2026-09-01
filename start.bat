@echo off
:: FloodSense — one-click start (FastAPI + WebSocket)
:: Opens the dashboard locally and in your default browser.
::
:: First run:
::   python -m venv .venv
::   .venv\Scripts\activate
::   pip install -r requirements.txt
::

set PROJECT=C:\Users\ephra\OneDrive\Desktop\flood

echo.
echo   FloodSense  ^|  http://localhost:3000
echo.
echo   Phone access: http://192.168.137.140:3000
echo   (Make sure your phone is on the same WiFi)
echo.

cd /d "%PROJECT%"
start http://localhost:3000
.venv\Scripts\activate && python server.py
