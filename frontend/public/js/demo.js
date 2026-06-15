// LOCAL TEST ONLY — cycles through every weather condition every 10s so you can
// preview each look. Activate by adding ?demo to the URL. Not used in normal mode.

function mk(key, label, emoji, mascot, isDay, sun, v, flags = {}) {
  return {
    key, label, emoji, mascot, isDay, sun,
    isRaining: !!flags.rain, isWindy: !!flags.wind, isStormy: !!flags.storm,
    isHot: v.temp >= 33, isCold: v.temp <= 14, windDir: 'NW',
    values: {
      temp: v.temp, humidity: v.hum, wind: v.wind, precip: v.precip || 0,
      rainDay: v.rain || 0, solar: v.solar || 0, pressure: v.pres || 945, battery: 100,
    },
  };
}

const CONDS = [
  mk('sunny', 'Sunny', '☀️', 'Frog chilling on the beach with sunglasses', true, 0.92, { temp: 34, hum: 35, wind: 10, solar: 850 }),
  mk('partly', 'Partly Cloudy', '🌤️', 'Frog lounging under drifting clouds', true, 0.62, { temp: 31, hum: 52, wind: 14, solar: 320 }),
  mk('cloudy', 'Cloudy', '☁️', 'Frog relaxing in the cool shade', true, 0.42, { temp: 28, hum: 74, wind: 12, solar: 90 }),
  mk('rain', 'Rainy', '🌧️', 'Frog splashing happily in the rain', true, 0.35, { temp: 24, hum: 88, wind: 20, solar: 60, precip: 4, rain: 12 }, { rain: true }),
  mk('storm', 'Stormy', '⛈️', 'Frog huddled under a big umbrella', true, 0.2, { temp: 22, hum: 93, wind: 44, solar: 25, precip: 10, rain: 32 }, { rain: true, storm: true, wind: true }),
  mk('clear-night', 'Clear Night', '🌙', 'Frog stargazing on a lounger', false, 0, { temp: 21, hum: 45, wind: 8, solar: 0 }),
  mk('cloudy-night', 'Cloudy Night', '☁️', 'Frog cozy under moody night clouds', false, 0, { temp: 23, hum: 86, wind: 11, solar: 0 }),
];

// build a synthetic time-series around a condition's values so charts move too
function fakeSeries(cond, n = 48) {
  const v = cond.values, out = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const w = (Math.sin(i * 0.4) + Math.random() * 0.6 - 0.3);
    out.push({
      date_time: new Date(now - (n - i) * 15 * 60000).toISOString(),
      temperature: (v.temp + w * 1.5).toFixed(2),
      humidity: Math.max(0, v.humidity + w * 6).toFixed(2),
      wind_speed: Math.max(0, v.wind + w * 5).toFixed(2),
      pressure: (v.pressure + w * 2).toFixed(1),
      solar_irradiation: Math.max(0, v.solar + w * 40).toFixed(2),
      rain_in_last_day: v.rainDay.toFixed(2),
    });
  }
  return out;
}

export function runDemo({ world, hud }) {
  const machine = { machine_id: 'WC2504002', model: 'VIYAT-X', location_name: 'Kopargaon', latitude: '19.90', longitude: '74.49', status: 'DEMO' };
  let i = 0;
  function show() {
    const cond = CONDS[i];
    const snap = { machine, reading: {}, series: fakeSeries(cond), lastUpdated: Date.now(), serverTime: Date.now() };
    document.body.dataset.cond = cond.key;
    document.body.classList.toggle('is-night', !cond.isDay);
    world.applyCondition(cond);
    hud.update(cond, snap);
    hud.setStatus(true, `DEMO ${i + 1}/${CONDS.length} · ${cond.label}`);
    i = (i + 1) % CONDS.length;
  }
  show();
  setInterval(show, 10000);
  document.getElementById('splash')?.classList.add('hide');
  console.log('[DEMO] cycling all weather conditions every 10s');
}
