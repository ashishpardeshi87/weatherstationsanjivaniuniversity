// Talks to the upstream VIYAT WeatherCast API:
//   - logs in (username/password -> JWT access token)
//   - lists the account's machines (weather stations)
//   - pulls the latest live reading over the upstream WebSocket
//
// All credentials stay on the server; the browser never sees them.

import WebSocket from 'ws';
import { config } from './config.js';

let tokenCache = { token: null, ts: 0 };

async function login() {
  const res = await fetch(config.apiBase + 'auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: config.username, password: config.password }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Login failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const token = json?.data?.accessToken;
  if (!token) throw new Error('Login response missing accessToken');
  tokenCache = { token, ts: Date.now() };
  return token;
}

export async function getToken(force = false) {
  const fresh = tokenCache.token && Date.now() - tokenCache.ts < config.tokenMaxAgeMs;
  if (!force && fresh) return tokenCache.token;
  return login();
}

// Returns array of machine objects for the logged-in user.
export async function getMachines() {
  const token = await getToken();
  const res = await fetch(config.apiBase + 'user/machines/0/50', {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (res.status === 401) {
    await getToken(true);
    return getMachines();
  }
  if (!res.ok) throw new Error(`getMachines failed (${res.status})`);
  const json = await res.json();
  return json?.data?.rows || [];
}

// Resolves the machine id to display (config override or first machine).
let resolvedMachine = null;
export async function resolveMachine() {
  if (resolvedMachine) return resolvedMachine;
  const machines = await getMachines();
  if (config.machineId) {
    resolvedMachine = machines.find((m) => m.machine_id === config.machineId) || {
      machine_id: config.machineId,
    };
  } else {
    if (!machines.length) throw new Error('No machines found on this account');
    resolvedMachine = machines[0];
  }
  return resolvedMachine;
}

// Opens a short-lived upstream WebSocket and resolves with the array of recent
// live_data rows (newest first). Auto-retries once on auth failure.
export function pullRows(machineId, rows = 1, attempt = 0) {
  return new Promise(async (resolve, reject) => {
    let token;
    try {
      token = await getToken(attempt > 0);
    } catch (e) {
      return reject(e);
    }

    const url =
      `${config.wsBase}?token=${encodeURIComponent(token)}` +
      `&machine_id=${encodeURIComponent(machineId)}&rows=${rows}&page=0&type=live_data`;

    let settled = false;
    const ws = new WebSocket(url);
    const done = (fn, val) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch {}
      fn(val);
    };

    const timer = setTimeout(() => done(reject, new Error('Upstream WS timeout')), 14000);

    ws.on('message', (buf) => {
      clearTimeout(timer);
      try {
        const msg = JSON.parse(buf.toString());
        const list = msg?.data?.rows;
        if (Array.isArray(list) && list.length) return done(resolve, list);
        done(reject, new Error('No rows in upstream message'));
      } catch (e) {
        done(reject, e);
      }
    });
    ws.on('error', (e) => { clearTimeout(timer); done(reject, e); });
    ws.on('close', (code) => {
      clearTimeout(timer);
      if (!settled && code === 4001 && attempt === 0) {
        settled = true;
        pullRows(machineId, rows, 1).then(resolve, reject);
      } else if (!settled) {
        done(reject, new Error('Upstream WS closed (' + code + ')'));
      }
    });
  });
}

// Convenience: latest single reading.
export async function pullLatest(machineId, attempt = 0) {
  const rows = await pullRows(machineId, 1, attempt);
  return rows[0];
}
