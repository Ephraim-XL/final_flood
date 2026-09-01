"""
FloodSense Server — FastAPI + WebSocket + Serial
Reads Arduino HC-SR04 sensor data and streams to browsers in real-time.
"""
import re
import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

import serial
import serial.tools.list_ports
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from starlette.websockets import WebSocketState

# ---- Config ----
BAUD_RATE = 9600
SERIAL_TIMEOUT = 1

# ---- State ----
latest_reading: dict = {
    "distanceCm": None,
    "waterHeightCm": None,
    "waterLevelPct": None,
    "timestamp": None,
}
clients: set[WebSocket] = set()
serial_task: Optional[asyncio.Task] = None


# ---- Serial Reader ----
def find_arduino_port() -> Optional[str]:
    """Auto-detect Arduino serial port."""
    ports = serial.tools.list_ports.comports()
    arduino_keywords = ["arduino", "ch340", "cp210", "usb serial", "acm"]
    for port in ports:
        desc = f"{port.description} {port.device} {port.hwid}".lower()
        if any(k in desc for k in arduino_keywords):
            return port.device
    return ports[0].device if ports else None


def read_serial_line(ser: serial.Serial) -> Optional[str]:
    """Blocking read from serial — run in thread."""
    try:
        line = ser.readline().decode("utf-8", errors="replace").strip()
        return line if line else None
    except Exception:
        return None


async def read_serial():
    """Background task: read from serial and broadcast to all WebSocket clients."""
    ser = None

    while True:
        try:
            if ser is None:
                port = find_arduino_port()
                if port is None:
                    print("[serial] No port found. Retrying in 2s...")
                    await asyncio.sleep(2)
                    continue
                print(f"[serial] Opening {port} @ {BAUD_RATE}...")
                ser = serial.Serial(port, BAUD_RATE, timeout=SERIAL_TIMEOUT)
                await asyncio.sleep(2)  # Wait for Arduino reset

            # Read in thread to avoid blocking event loop
            line = await asyncio.to_thread(read_serial_line, ser)
            if line is None:
                continue

            # Parse: "Distance:     12.34 cm"
            dm = re.search(r"Distance:\s+([\d.]+)\s*cm", line, re.IGNORECASE)
            wm = re.search(r"Water\s+Height:\s+([\d.]+)\s*cm", line, re.IGNORECASE)
            pm = re.search(r"Water\s+Level:\s+([\d.]+)\s*%", line, re.IGNORECASE)

            now = int(datetime.now().timestamp() * 1000)
            if dm:
                latest_reading["distanceCm"] = float(dm.group(1))
            if wm:
                latest_reading["waterHeightCm"] = float(wm.group(1))
            if pm:
                latest_reading["waterLevelPct"] = float(pm.group(1))
                latest_reading["timestamp"] = now
                payload = json.dumps({"type": "reading", "data": latest_reading})
                disconnected = set()
                for ws in clients:
                    try:
                        if ws.client_state == WebSocketState.CONNECTED:
                            await ws.send_text(payload)
                    except Exception:
                        disconnected.add(ws)
                clients.difference_update(disconnected)
                if latest_reading["waterLevelPct"] is not None:
                    print(
                        f"[serial] {latest_reading['waterLevelPct']}%  "
                        f"({latest_reading['distanceCm']} cm / "
                        f"{latest_reading['waterHeightCm']} cm) → {len(clients)} viewer(s)"
                    )

        except serial.SerialException as e:
            print(f"[serial] Error: {e}. Reconnecting in 3s...")
            if ser:
                try:
                    ser.close()
                except Exception:
                    pass
                ser = None
            await asyncio.sleep(3)
        except Exception as e:
            print(f"[serial] Unexpected: {e}")
            await asyncio.sleep(1)


# ---- FastAPI App ----
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start serial reader on startup, cleanup on shutdown."""
    global serial_task
    serial_task = asyncio.create_task(read_serial())
    print("[server] FloodSense started")
    yield
    if serial_task:
        serial_task.cancel()
    print("[server] FloodSense stopped")


app = FastAPI(title="FloodSense", lifespan=lifespan)


@app.get("/")
async def index():
    """Serve the dashboard HTML."""
    with open("public/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "ok": True,
        "clients": len(clients),
        "reading": latest_reading,
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time data streaming."""
    await websocket.accept()
    clients.add(websocket)
    print(f"[ws] Client connected ({len(clients)} total)")
    if latest_reading["timestamp"]:
        await websocket.send_text(
            json.dumps({"type": "reading", "data": latest_reading})
        )
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        clients.discard(websocket)
        print(f"[ws] Client disconnected ({len(clients)} total)")
    except Exception:
        clients.discard(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
