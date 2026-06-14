// Derives a human weather "mood" from the raw station reading.
// The station only reports numbers, so we infer condition + day/night here.

const IST_OFFSET_MIN = 330; // UTC+5:30 (Kopargaon, India)

export function istParts(isoUtc) {
  const d = isoUtc ? new Date(isoUtc) : new Date();
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60000);
  return {
    date: ist,
    hour: ist.getUTCHours() + ist.getUTCMinutes() / 60,
    hh: String(ist.getUTCHours()).padStart(2, '0'),
    mm: String(ist.getUTCMinutes()).padStart(2, '0'),
    label: ist.toLocaleString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC',
    }),
  };
}

const num = (v, d = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

// Sun elevation 0..1 (0 = horizon/night, 1 = noon) from local hour.
export function sunFactor(hour) {
  // Day roughly 6:00 -> 18:30. Smooth cosine arc.
  const t = (hour - 6) / 12.5; // 0 at sunrise, 1 at sunset
  if (t <= 0 || t >= 1) return 0;
  return Math.sin(t * Math.PI);
}

export function deriveCondition(reading) {
  const r = reading || {};
  const ist = istParts(); // live local time drives the day/night cycle
  const sun = sunFactor(ist.hour);
  const isDay = sun > 0.04;

  const temp = num(r.temperature);
  const humidity = num(r.humidity);
  const wind = num(r.wind_speed);
  const precip = num(r.precipitation);
  const rainDay = num(r.rain_in_last_day);
  const solar = num(r.solar_irradiation);

  const isRaining = precip > 0.05 || rainDay > 0.2;
  const isWindy = wind >= 28;
  const isStormy = isRaining && (wind >= 35 || precip > 5);
  const isHot = temp >= 33;
  const isCold = temp <= 14;

  let key, label, emoji, mascot;

  if (isStormy) {
    key = 'storm'; label = 'Stormy'; emoji = '⛈️';
    mascot = 'Frog huddled under a big umbrella';
  } else if (isRaining) {
    key = 'rain'; label = 'Rainy'; emoji = '🌧️';
    mascot = 'Frog splashing happily in the rain';
  } else if (!isDay) {
    key = humidity > 80 ? 'cloudy-night' : 'clear-night';
    label = humidity > 80 ? 'Cloudy Night' : 'Clear Night';
    emoji = humidity > 80 ? '☁️' : '🌙';
    mascot = 'Frog stargazing on a lounger';
  } else if (solar >= 450 || (sun > 0.55 && humidity < 55)) {
    key = 'sunny'; label = 'Sunny'; emoji = '☀️';
    mascot = 'Frog chilling on the beach with sunglasses';
  } else if (solar >= 180 || humidity < 70) {
    key = 'partly'; label = 'Partly Cloudy'; emoji = '🌤️';
    mascot = 'Frog lounging under drifting clouds';
  } else {
    key = 'cloudy'; label = 'Cloudy'; emoji = '☁️';
    mascot = 'Frog relaxing in the cool shade';
  }

  return {
    key, label, emoji, mascot,
    isDay, sun, isRaining, isWindy, isStormy, isHot, isCold,
    ist,
    values: { temp, humidity, wind, precip, rainDay, solar, pressure: num(r.pressure), battery: num(r.battery_life) },
    windDir: r.wind_direction || '--',
  };
}

export const UNITS = {
  temperature: '°C', pressure: 'hPa', humidity: '%', wind_speed: 'km/h',
  precipitation: 'mm', rain_in_last_day: 'mm', solar_irradiation: 'W/m²', battery_life: '%',
};
