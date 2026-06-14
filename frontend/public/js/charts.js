// Telemetry charts: one big "featured" chart that smoothly changes metric every
// scene, plus a grid of mini sparklines for every metric. Uses Chart.js (global).

import { UNITS } from './condition.js';

const METRICS = [
  { id: 'temperature',      name: 'Temperature', icon: '🌡️', color: '#ff7a59', unit: UNITS.temperature, dp: 1 },
  { id: 'humidity',         name: 'Humidity',    icon: '💧', color: '#4cc9f0', unit: UNITS.humidity, dp: 0 },
  { id: 'wind_speed',       name: 'Wind',        icon: '🌬️', color: '#9b8cff', unit: UNITS.wind_speed, dp: 1 },
  { id: 'pressure',         name: 'Pressure',    icon: '🧭', color: '#ffd166', unit: UNITS.pressure, dp: 0 },
  { id: 'solar_irradiation',name: 'Solar',       icon: '🔆', color: '#ffb703', unit: UNITS.solar_irradiation, dp: 0 },
  { id: 'rain_in_last_day', name: 'Rain',        icon: '🌧️', color: '#56cfe1', unit: UNITS.rain_in_last_day, dp: 1 },
];
const byId = Object.fromEntries(METRICS.map((m) => [m.id, m]));

export function createCharts(featuredRoot, miniRoot) {
  const hasChart = typeof window.Chart !== 'undefined';
  let series = [];
  let featuredId = 'temperature';

  // ---- featured (big) chart ----
  featuredRoot.innerHTML = `
    <div class="ft-head">
      <span class="ft-ic" id="ft-ic">🌡️</span>
      <span class="ft-name" id="ft-name">Temperature</span>
      <span class="ft-val" id="ft-val">--</span>
    </div>
    <div class="ft-canvas"><canvas id="ft-cx"></canvas></div>`;

  let featured = null;
  if (hasChart) {
    const cx = document.getElementById('ft-cx').getContext('2d');
    featured = new window.Chart(cx, {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: '#ff7a59', backgroundColor: grad(cx, '#ff7a59'), borderWidth: 2.5, fill: true, tension: 0.42, pointRadius: 0 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeInOutCubic' },
        interaction: { intersect: false },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, maxTicksLimit: 5, maxRotation: 0, autoSkip: true } },
          y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(255,255,255,0.45)', font: { size: 10 }, maxTicksLimit: 4 }, grace: 0, beginAtZero: false },
        },
        layout: { padding: { left: 2, right: 6, top: 2, bottom: 0 } },
      },
    });
  }

  // ---- mini sparklines ----
  miniRoot.innerHTML = METRICS.map((m) => `
    <div class="chart-card" data-id="${m.id}" id="mc-${m.id}">
      <div class="cc-head"><span class="cc-ic">${m.icon}</span><span class="cc-name">${m.name}</span><span class="cc-val" id="cv-${m.id}" style="color:${m.color}">--</span></div>
      <div class="cc-canvas"><canvas id="cx-${m.id}"></canvas></div>
    </div>`).join('');

  const minis = {};
  if (hasChart) {
    for (const m of METRICS) {
      const cx = document.getElementById('cx-' + m.id).getContext('2d');
      minis[m.id] = new window.Chart(cx, {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: m.color, backgroundColor: grad(cx, m.color, 60), borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false, grace: 0 } } },
      });
    }
  }

  function timeLabels(s) {
    return s.map((r) => { const d = new Date(new Date(r.date_time).getTime() + 330 * 60000);
      return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`; });
  }
  function valsOf(id) { return series.map((r) => { const v = parseFloat(r[id]); return Number.isFinite(v) ? v : null; }); }

  function refreshFeatured() {
    const m = byId[featuredId]; if (!m) return;
    document.getElementById('ft-ic').textContent = m.icon;
    document.getElementById('ft-name').textContent = m.name;
    const vals = valsOf(m.id); const last = vals[vals.length - 1];
    document.getElementById('ft-val').textContent = (Number.isFinite(last) ? last.toFixed(m.dp) : '--') + (m.unit ? ' ' + m.unit : '');
    document.getElementById('ft-val').style.color = m.color;
    if (featured) {
      const cx = featured.ctx;
      featured.data.labels = timeLabels(series);
      featured.data.datasets[0].data = vals;
      featured.data.datasets[0].borderColor = m.color;
      featured.data.datasets[0].backgroundColor = grad(cx, m.color);
      featured.update();
    }
  }

  function update(s) {
    if (!Array.isArray(s) || !s.length) return;
    series = s;
    const labels = timeLabels(series);
    for (const m of METRICS) {
      const vals = valsOf(m.id); const last = vals[vals.length - 1];
      const el = document.getElementById('cv-' + m.id);
      if (el) el.textContent = (Number.isFinite(last) ? last.toFixed(m.dp) : '--') + (m.unit ? ' ' + m.unit : '');
      const ch = minis[m.id];
      if (ch) { ch.data.labels = labels; ch.data.datasets[0].data = vals; ch.update('none'); }
    }
    refreshFeatured();
  }

  function setFeatured(id) {
    if (!byId[id] || id === featuredId) return;
    featuredId = id;
    miniRoot.querySelectorAll('.chart-card').forEach((c) => c.classList.toggle('active', c.dataset.id === id));
    refreshFeatured();
  }

  miniRoot.querySelectorAll('.chart-card').forEach((c) => c.classList.toggle('active', c.dataset.id === featuredId));
  return { update, setFeatured };
}

function grad(ctx, hex, h = 150) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, hexA(hex, 0.42)); g.addColorStop(1, hexA(hex, 0));
  return g;
}
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
