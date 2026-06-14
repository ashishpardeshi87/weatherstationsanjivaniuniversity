// Builds a sparkline line-chart per metric from the time series and keeps them
// updated. Uses Chart.js (loaded globally via CDN as window.Chart).

import { UNITS } from './condition.js';

const METRICS = [
  { id: 'temperature',      name: 'Temperature', icon: '🌡️', color: '#ff7a59', unit: UNITS.temperature, dp: 1 },
  { id: 'humidity',         name: 'Humidity',    icon: '💧', color: '#4cc9f0', unit: UNITS.humidity, dp: 0 },
  { id: 'wind_speed',       name: 'Wind',        icon: '🌬️', color: '#9b8cff', unit: UNITS.wind_speed, dp: 1 },
  { id: 'pressure',         name: 'Pressure',    icon: '🧭', color: '#ffd166', unit: UNITS.pressure, dp: 0 },
  { id: 'solar_irradiation',name: 'Solar',       icon: '🔆', color: '#ffb703', unit: UNITS.solar_irradiation, dp: 0 },
  { id: 'rain_in_last_day', name: 'Rain',        icon: '🌧️', color: '#56cfe1', unit: UNITS.rain_in_last_day, dp: 1 },
];

export function createCharts(root) {
  const hasChart = typeof window.Chart !== 'undefined';
  root.innerHTML = METRICS.map((m) => `
    <div class="chart-card" data-id="${m.id}">
      <div class="cc-head">
        <span class="cc-ic">${m.icon}</span>
        <span class="cc-name">${m.name}</span>
        <span class="cc-val" id="cv-${m.id}" style="color:${m.color}">--</span>
      </div>
      <div class="cc-canvas"><canvas id="cx-${m.id}"></canvas></div>
    </div>`).join('');

  const charts = {};
  if (hasChart) {
    for (const m of METRICS) {
      const cv = document.getElementById('cx-' + m.id).getContext('2d');
      const grad = cv.createLinearGradient(0, 0, 0, 70);
      grad.addColorStop(0, hexA(m.color, 0.45));
      grad.addColorStop(1, hexA(m.color, 0));
      charts[m.id] = new window.Chart(cv, {
        type: 'line',
        data: { labels: [], datasets: [{ data: [], borderColor: m.color, backgroundColor: grad, borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0 }] },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false, grace: '12%' } },
          elements: { line: { capBezierPoints: true } },
        },
      });
    }
  }

  function update(series) {
    if (!Array.isArray(series) || !series.length) return;
    const labels = series.map((r) => {
      const d = new Date(new Date(r.date_time).getTime() + 330 * 60000);
      return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
    });
    for (const m of METRICS) {
      const vals = series.map((r) => parseFloat(r[m.id])).map((v) => (Number.isFinite(v) ? v : null));
      const last = vals[vals.length - 1];
      const el = document.getElementById('cv-' + m.id);
      if (el) el.textContent = (Number.isFinite(last) ? last.toFixed(m.dp) : '--') + (m.unit ? ' ' + m.unit : '');
      const ch = charts[m.id];
      if (ch) { ch.data.labels = labels; ch.data.datasets[0].data = vals; ch.update('none'); }
    }
  }

  return { update };
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;
}
