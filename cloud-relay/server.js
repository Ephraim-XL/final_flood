// ============================================================
// FloodSense Cloud Relay — Render-ready
// ============================================================
// This server runs in the cloud (Render) and acts as a relay:
//   - Local bridge (your PC) connects as "sender" → pushes sensor data
//   - Browsers connect as "viewer" → receive sensor data
// ============================================================

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ---- Track connections ----
let senderWs = null;          // the local bridge (your PC)
const viewers = new Set();    // browsers watching the dashboard

// ---- Latest reading cache ----
let latestReading = {
  distanceCm: null,
  waterHeightCm: null,
  waterLevelPct: null,
  timestamp: null
};

// ---- Express ----
const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check (for Render + monitoring)
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    status: senderWs ? 'bridge-connected' : 'waiting-for-bridge',
    viewers: viewers.size,
    latest: latestReading
  });
});

// ---- HTTP + WS ----
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  let role = null; // 'sender' or 'viewer'

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ---- Handshake: identify role ----
    if (msg.type === 'hello') {
      role = msg.role;

      if (role === 'sender') {
        // Only one sender allowed — kick previous
        if (senderWs && senderWs !== ws) {
          try { senderWs.close(1000, 'replaced'); } catch {}
        }
        senderWs = ws;
        console.log('[relay] Bridge (sender) connected');
      }

      if (role === 'viewer') {
        viewers.add(ws);
        console.log(`[relay] Viewer connected (${viewers.size} total)`);
        // Send cached reading immediately
        if (latestReading.timestamp) {
          ws.send(JSON.stringify({ type: 'reading', data: latestReading }));
        }
      }
      return;
    }

    // ---- Sender → relay → all viewers ----
    if (role === 'sender' && msg.type === 'reading') {
      latestReading = msg.data;
      const payload = JSON.stringify({ type: 'reading', data: msg.data });
      let sent = 0;
      viewers.forEach((v) => {
        if (v.readyState === WebSocket.OPEN) {
          v.send(payload);
          sent++;
        }
      });
      console.log(`[relay] ${msg.data.waterLevelPct}% → ${sent} viewer(s)`);
    }
  });

  ws.on('close', () => {
    if (role === 'sender') {
      senderWs = null;
      console.log('[relay] Bridge (sender) disconnected');
    }
    if (role === 'viewer') {
      viewers.delete(ws);
      console.log(`[relay] Viewer left (${viewers.size} total)`);
    }
  });

  ws.on('error', () => {});
});

server.listen(PORT, () => {
  console.log(`[relay] FloodSense cloud relay → port ${PORT}`);
  console.log(`[relay] Dashboard: http://localhost:${PORT}`);
  console.log(`[relay] Waiting for bridge connection...`);
});
