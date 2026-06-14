// HUD overlay: the big hero number shows the live metric that rotates every
// 10s (in sync with the deck's featured chart), plus condition, live clock,
// telemetry charts and station card.

import { UNITS } from './condition.js';
import { createCharts } from './charts.js';

const fmt = (v, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '--');

const HERO = {
  temperature:       { name: 'Temperature', unit: UNITS.temperature,       dp: 1, get: (v) => v.temp },
  humidity:          { name: 'Humidity',    unit: UNITS.humidity,          dp: 0, get: (v) => v.humidity },
  wind_speed:        { name: 'Wind',        unit: UNITS.wind_speed,        dp: 1, get: (v) => v.wind },
  pressure:          { name: 'Pressure',    unit: UNITS.pressure,          dp: 0, get: (v) => v.pressure },
  solar_irradiation: { name: 'Solar',       unit: UNITS.solar_irradiation, dp: 0, get: (v) => v.solar },
  rain_in_last_day:  { name: 'Rain',        unit: UNITS.rain_in_last_day,  dp: 1, get: (v) => v.rainDay },
};

export function createHUD() {
  const $ = (id) => document.getElementById(id);
  const els = {
    heroVal: $('heroVal'), heroUnit: $('heroUnit'), caption: $('caption'),
    emoji: $('condEmoji'), label: $('condLabel'), mascot: $('mascot'),
    statusDot: $('statusDot'), statusText: $('statusText'), updated: $('updated'),
    date: $('date'), clock: $('clock'), station: $('station'),
  };
  const charts = createCharts($('featured'), $('charts'));

  let featured = 'temperature';
  let cond = null;

  function tickClock() {
    const n = new Date(Date.now() + 330 * 60000);
    els.clock.textContent = `${String(n.getUTCHours()).padStart(2,'0')}:${String(n.getUTCMinutes()).padStart(2,'0')}:${String(n.getUTCSeconds()).padStart(2,'0')}`;
    els.date.textContent = n.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' });
  }
  tickClock(); setInterval(tickClock, 1000);

  function renderHero() {
    if (!cond) return;
    const m = HERO[featured] || HERO.temperature;
    els.caption.textContent = m.name;
    els.heroVal.textContent = fmt(m.get(cond.values), m.dp);
    els.heroUnit.textContent = m.unit;
  }

  // scene director (every 10s) → rotate the featured metric everywhere
  function onScene(scene) {
    if (!scene) return;
    featured = scene.metric;
    document.body.dataset.focus = scene.caption;
    charts.setFeatured(scene.metric);
    renderHero();
  }

  function update(c, snap) {
    cond = c;
    els.emoji.textContent = c.emoji;
    els.label.textContent = c.label;
    els.mascot.textContent = c.mascot;
    renderHero();
    charts.update(snap.series);

    const v = c.values, m = snap.machine || {};
    els.station.innerHTML = `
      ${kv('Station', m.machine_id || '--')}
      ${kv('Model', m.model || '--')}
      ${kv('Location', m.location_name || 'Kopargaon')}
      ${kv('Coordinates', `${m.latitude || '--'}, ${m.longitude || '--'}`)}
      ${kv('Wind', `${fmt(v.wind,1)} ${UNITS.wind_speed} ${c.windDir}`)}
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

  return { update, setStatus, onScene };
}

function kv(k, v) { return `<div class="kv"><span class="kv-k">${k}</span><span class="kv-v">${v}</span></div>`; }
