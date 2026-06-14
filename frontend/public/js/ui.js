// HUD overlay: oversized hero typography (left), live date/clock, a rotating
// poetic caption, the telemetry deck (charts) and station card (right).

import { UNITS } from './condition.js';
import { createCharts } from './charts.js';

const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '--');

export function createHUD() {
  const $ = (id) => document.getElementById(id);
  const els = {
    temp: $('temp'), emoji: $('condEmoji'), label: $('condLabel'), mascot: $('mascot'),
    caption: $('caption'), statusDot: $('statusDot'), statusText: $('statusText'),
    updated: $('updated'), date: $('date'), clock: $('clock'), station: $('station'),
  };

  const charts = createCharts($('charts'));

  // live IST date + clock
  function tickClock() {
    const n = new Date(Date.now() + 330 * 60000);
    els.clock.textContent = `${String(n.getUTCHours()).padStart(2,'0')}:${String(n.getUTCMinutes()).padStart(2,'0')}:${String(n.getUTCSeconds()).padStart(2,'0')}`;
    els.date.textContent = n.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
  }
  tickClock(); setInterval(tickClock, 1000);

  // rotating caption (decoupled from camera)
  const CAPS = ['the world', 'the sky', 'the land & air', 'right now'];
  let ci = 0;
  setInterval(() => { ci = (ci + 1) % CAPS.length; els.caption.textContent = CAPS[ci]; document.body.dataset.focus = CAPS[ci]; }, 8000);

  function update(cond, snap) {
    const v = cond.values;
    els.temp.textContent = fmt(v.temp);
    els.emoji.textContent = cond.emoji;
    els.label.textContent = cond.label;
    els.mascot.textContent = cond.mascot;

    charts.update(snap.series);

    const m = snap.machine || {};
    els.station.innerHTML = `
      ${kv('Station', m.machine_id || '--')}
      ${kv('Model', m.model || '--')}
      ${kv('Location', m.location_name || 'Kopargaon')}
      ${kv('Coordinates', `${m.latitude || '--'}, ${m.longitude || '--'}`)}
      ${kv('Wind', `${fmt(v.wind,1)} ${UNITS.wind_speed} ${cond.windDir}`)}
      ${kv('Battery', fmt(v.battery,0) + '%')}
      ${kv('Status', m.status || '--')}`;

    if (snap.lastUpdated) {
      const age = Math.round((snap.serverTime - snap.lastUpdated) / 1000);
      els.updated.textContent = age < 120 ? '· live feed' : `· updated ${age}s ago`;
    }
  }

  function setStatus(ok, text) {
    els.statusDot.classList.toggle('ok', ok);
    els.statusDot.classList.toggle('bad', !ok);
    els.statusText.textContent = text;
  }

  return { update, setStatus };
}

function kv(k, v) { return `<div class="kv"><span class="kv-k">${k}</span><span class="kv-v">${v}</span></div>`; }
