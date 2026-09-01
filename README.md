# FloodSense — Cloud Sync Setup

Real-time flood monitoring with Arduino UNO + HC-SR04, synced to the cloud via WebSocket relay.

## Architecture

```
Arduino UNO → USB → Local Bridge (your PC) → WebSocket → Cloud Relay (Render) → Browser (anywhere)
```

## Quick Start

### 1. Install Dependencies

```bash
npm run install:all
```

This installs dependencies for both the local bridge and cloud relay.

### 2. Deploy Cloud Relay to Render

1. Push this project to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo
4. Set **Root Directory** to `cloud-relay`
5. Set **Start Command** to `node server.js`
6. Deploy — you'll get a URL like `https://floodsense.onrender.com`

### 3. Start Local Bridge

```bash
npm run start:bridge
```

Or double-click `local-bridge/start.bat`

The bridge will:
- Auto-detect your Arduino on serial port
- Connect to the cloud relay
- Forward sensor data in real-time

### 4. View Dashboard

Open your Render URL (e.g., `https://floodsense.onrender.com`) in any browser — phone, tablet, PC anywhere.

## Project Structure

```
flood/
├── flood.ino              # Arduino sketch (HC-SR04 sensor)
├── public/
│   └── index.html         # Dashboard (served by cloud relay)
├── cloud-relay/
│   ├── server.js          # Cloud relay server (deploy to Render)
│   └── package.json
├── local-bridge/
│   ├── bridge.js          # Local bridge (reads serial → relay)
│   ├── start.bat          # One-click start
│   └── package.json
└── package.json           # Root install script
```

## Configuration

Set a custom relay URL via environment variable:

```bash
set RELAY_URL=wss://your-custom-relay.com
npm run start:bridge
```

## How It Works

1. **Arduino** reads HC-SR04 sensor every second, prints distance/height/percentage to Serial
2. **Local Bridge** (your PC) reads serial, parses values, sends to cloud relay via WebSocket
3. **Cloud Relay** (Render) receives data, broadcasts to all connected browsers
4. **Browser** connects to relay as "viewer", receives real-time updates with auto-reconnect

## Features

- ✅ Real-time WebSocket streaming
- ✅ Auto-reconnect (bridge ↔ relay, browser ↔ relay)
- ✅ Works from anywhere (not just LAN)
- ✅ One-click start
- ✅ Siren alert at ≥80% water level
- ✅ Free hosting on Render
