// ============================================================
// FloodSense Server — auto-connect Arduino + WebSocket + site
// ============================================================
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const PORT = 3000;
const ARDUINO_BAUD = 9600;

let wsClients = new Set();
let currentReading = {
  distanceCm: null,
  waterHeightCm: null,
  waterLevelPct: null,
  timestamp: null
};

// ---- Express ----
const app = express();
app.use(express.static('public'));
app.get('/api/reading', (req, res) => {
  res.json(currentReading);
});

// ---- HTTP + WS ----
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  wsClients.add(ws);
  // send latest immediately on connect
  if (currentReading.timestamp) ws.send(JSON.stringify({ type: 'reading', data: currentReading }));
  ws.on('close', () => wsClients.delete(ws));
});

function broadcast(obj) {
  const payload = JSON.stringify(obj);
  wsClients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN) c.send(payload);
  });
}

// ---- Serial ----
let serialPort = null;
let parser = null;

function connectSerial() {
  SerialPort.list().then((ports) => {
    // pick first port whose path looks like a COM port (prefer explicitly USB/Arduino-ish names)
    const candidates = ports.filter((p) => /arduino|usb|ch340|cp210|ACM|COM/i.test((p.vendorId || '') + (p.product || '') + p.path));
    const chosen = candidates[0] || ports[0];

    if (!chosen) {
      console.log('[serial] No ports found. Waiting 2s and retrying...');
      setTimeout(connectSerial, 2000);
      return;
    }

    console.log(`[serial] Trying ${chosen.path} @ ${ARDUINO_BAUD}...`);
    serialPort = new SerialPort({ path: chosen.path, baudRate: ARDUINO_BAUD });
    parser = serialPort.pipe(new ReadlineParser({ delimiter: '\n' }));

    parser.on('data', (line) => {
      const raw = line.trim();
      if (!raw) return;

      const now = Date.now();

      // Distance: "Distance:     12.34 cm"
      const dm = raw.match(/Distance:\s+([\d.]+)\s*cm/i);
      // Water Height: "Water Height: 4.50 cm"
      const wm = raw.match(/Water\s+Height:\s+([\d.]+)\s*cm/i);
      // Water Level: "Water Level:  38 %"
      const pm = raw.match(/Water\s+Level:\s+([\d.]+)\s*%/i);

      if (dm) currentReading.distanceCm = parseFloat(dm[1]);
      if (wm) currentReading.waterHeightCm = parseFloat(wm[1]);
      if (pm) currentReading.waterLevelPct = parseFloat(pm[1]);

      // If we just got a percentage line, treat it as a full cycle complete
      if (pm) {
        currentReading.timestamp = now;
        broadcast({ type: 'reading', data: currentReading });
        console.log(`[serial] ${currentReading.waterLevelPct}%  (${currentReading.distanceCm} cm / ${currentReading.waterHeightCm} cm)`);
      }
    });

    serialPort.on('error', (err) => {
      console.log(`[serial] Error on ${chosen.path}: ${err.message}. Retrying in 3s...`);
      try { serialPort.close(); } catch {}
      setTimeout(connectSerial, 3000);
    });

    serialPort.on('close', () => {
      console.log(`[serial] ${chosen.path} closed. Reconnecting in 3s...`);
      setTimeout(connectSerial, 3000);
    });
  }).catch((err) => {
    console.log(`[serial] List error: ${err.message}. Retrying in 3s...`);
    setTimeout(connectSerial, 3000);
  });
}

connectSerial();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] FloodSense dashboard → http://localhost:${PORT}`);
  console.log(`[server] WebSocket available at ws://localhost:${PORT}`);
  console.log(`[server] Auto-detecting Arduino on serial ports...`);
});
