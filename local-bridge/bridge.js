// ============================================================
// FloodSense Local Bridge — Arduino Serial → Cloud Relay
// ============================================================
// Reads sensor data from Arduino via serial port
// Forwards to the cloud relay server via WebSocket
// ============================================================

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');

// ---- Config ----
const RELAY_URL = process.env.RELAY_URL || 'ws://localhost:3000';
const ARDUINO_BAUD = 9600;

// ---- State ----
let ws = null;
let serialPort = null;
let parser = null;
let reconnectDelay = 2000;

let currentReading = {
  distanceCm: null,
  waterHeightCm: null,
  waterLevelPct: null,
  timestamp: null
};

// ---- WebSocket to relay ----
function connectRelay() {
  console.log(`[bridge] Connecting to relay: ${RELAY_URL}...`);
  ws = new WebSocket(RELAY_URL);

  ws.on('open', () => {
    console.log('[bridge] Connected to relay ✓');
    reconnectDelay = 2000;
    // Identify as sender
    ws.send(JSON.stringify({ type: 'hello', role: 'sender' }));
  });

  ws.on('close', () => {
    console.log(`[bridge] Relay disconnected. Retrying in ${reconnectDelay / 1000}s...`);
    setTimeout(connectRelay, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, 15000);
  });

  ws.on('error', (err) => {
    console.log(`[bridge] Relay error: ${err.message}`);
  });
}

// ---- Send reading to relay ----
function sendToRelay() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'reading', data: currentReading }));
  }
}

// ---- Serial: auto-detect Arduino ----
function connectSerial() {
  SerialPort.list().then((ports) => {
    const candidates = ports.filter((p) =>
      /arduino|usb|ch340|cp210|ACM|COM/i.test(
        (p.vendorId || '') + (p.product || '') + p.path
      )
    );
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

      const dm = raw.match(/Distance:\s+([\d.]+)\s*cm/i);
      const wm = raw.match(/Water\s+Height:\s+([\d.]+)\s*cm/i);
      const pm = raw.match(/Water\s+Level:\s+([\d.]+)\s*%/i);

      if (dm) currentReading.distanceCm = parseFloat(dm[1]);
      if (wm) currentReading.waterHeightCm = parseFloat(wm[1]);
      if (pm) currentReading.waterLevelPct = parseFloat(pm[1]);

      if (pm) {
        currentReading.timestamp = now;
        console.log(
          `[serial] ${currentReading.waterLevelPct}%  (${currentReading.distanceCm} cm / ${currentReading.waterHeightCm} cm)`
        );
        sendToRelay();
      }
    });

    serialPort.on('error', (err) => {
      console.log(`[serial] Error: ${err.message}. Retrying in 3s...`);
      try { serialPort.close(); } catch {}
      setTimeout(connectSerial, 3000);
    });

    serialPort.on('close', () => {
      console.log('[serial] Port closed. Reconnecting in 3s...');
      setTimeout(connectSerial, 3000);
    });
  }).catch((err) => {
    console.log(`[serial] List error: ${err.message}. Retrying in 3s...`);
    setTimeout(connectSerial, 3000);
  });
}

// ---- Start ----
console.log('═══════════════════════════════════════════');
console.log('  FloodSense Bridge — Local');
console.log(`  Relay: ${RELAY_URL}`);
console.log('═══════════════════════════════════════════');
console.log('');

connectRelay();
connectSerial();
