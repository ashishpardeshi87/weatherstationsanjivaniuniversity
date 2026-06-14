// Connects to the backend /stream WebSocket and keeps the latest snapshot.
// Auto-reconnects with backoff. Falls back to REST polling if WS dies.
// Backend base comes from window.WEATHER_API (set in /config.js) or same-origin.

export function createDataClient(onSnapshot) {
  let ws = null;
  let backoff = 1000;
  let pollTimer = null;

  const apiBase = (window.WEATHER_API || '').replace(/\/$/, '');
  const httpBase = apiBase || ''; // '' => same origin
  const wsBase = apiBase
    ? apiBase.replace(/^http/, 'ws')
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
  const wsUrl = `${wsBase}/stream`;

  function handle(payload) {
    try { onSnapshot(typeof payload === 'string' ? JSON.parse(payload) : payload); }
    catch (e) { console.warn('bad snapshot', e); }
  }

  async function pollOnce() {
    try {
      const res = await fetch(`${httpBase}/api/current`, { cache: 'no-store' });
      handle(await res.json());
    } catch {}
  }
  function startPolling() { if (!pollTimer) { pollOnce(); pollTimer = setInterval(pollOnce, 15000); } }
  function stopPolling() { clearInterval(pollTimer); pollTimer = null; }

  function connect() {
    try { ws = new WebSocket(wsUrl); } catch { startPolling(); return; }
    ws.onopen = () => { backoff = 1000; stopPolling(); };
    ws.onmessage = (ev) => handle(ev.data);
    ws.onerror = () => {};
    ws.onclose = () => { startPolling(); setTimeout(connect, backoff); backoff = Math.min(backoff * 1.6, 15000); };
  }

  connect();
  return { reconnect: connect };
}
