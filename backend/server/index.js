import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { resolveMachine, pullRows, getToken } from './upstream.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// In local dev the static frontend lives at ../../frontend/public.
const frontendDir = path.join(__dirname, '..', '..', 'frontend', 'public');
const serveStatic = fs.existsSync(frontendDir);

const app = express();
const server = http.createServer(app);

// ---- CORS (frontend on Vercel -> backend on Railway) --------------------
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ---- shared state -------------------------------------------------------
let machine = null;       // resolved station metadata
let latest = null;        // latest reading row
let series = [];          // recent readings, oldest -> newest (for charts)
let lastError = null;     // last upstream error (string)
let lastUpdated = 0;      // ms timestamp of last successful pull

function snapshot() {
  return {
    type: 'weather',
    machine,
    reading: latest,
    series,
    lastUpdated,
    serverTime: Date.now(),
    error: latest ? null : lastError,
  };
}

// ---- frontend WebSocket -------------------------------------------------
const wss = new WebSocketServer({ server, path: '/stream' });
wss.on('connection', (ws) => {
  ws.send(JSON.stringify(snapshot()));
});

function broadcast() {
  const payload = JSON.stringify(snapshot());
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

// ---- polling loop -------------------------------------------------------
async function refresh() {
  try {
    if (!machine) machine = await resolveMachine();
    const rows = await pullRows(machine.machine_id, 72); // newest first
    if (rows.length) {
      latest = rows[0];
      series = rows.slice().reverse(); // oldest -> newest for charts
      lastError = null;
      lastUpdated = Date.now();
    }
  } catch (e) {
    lastError = e.message || String(e);
    console.error('[refresh]', lastError);
  } finally {
    broadcast();
  }
}

// ---- REST ---------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({ ok: true, station: machine?.machine_id || null }));
app.get('/api/current', (_req, res) => res.json(snapshot()));

// ---- optional static serving for local dev ------------------------------
if (serveStatic) {
  app.use(express.static(frontendDir, { extensions: ['html'] }));
  app.get('*', (req, res) => {
    if (/\.[a-z0-9]+$/i.test(req.path)) return res.status(404).end();
    res.sendFile(path.join(frontendDir, 'index.html'));
  });
}

// ---- boot ---------------------------------------------------------------
server.listen(config.port, async () => {
  console.log(`\n  Weather Sanjivani API running on :${config.port}`);
  console.log(`  Static frontend: ${serveStatic ? 'served (local dev)' : 'disabled (deploy mode)'}\n`);
  try {
    await getToken();
    machine = await resolveMachine();
    console.log(`  Station: ${machine.machine_id} (${machine.location_name || 'unknown'})`);
  } catch (e) {
    console.error('  Startup warning:', e.message);
  }
  await refresh();
  setInterval(refresh, config.refreshMs);
});
