# VIYAT · Sanjivani University Live Weather

An immersive, full-screen 3D weather experience for the VIYAT WeatherCast station
at Sanjivani University, Kopargaon. A living Three.js world (day/night sky, terrain,
grass, trees, a distant city skyline, a frog mascot and weather particles) reacts to
real-time readings, with a live telemetry deck charting every metric.

## Structure

```
backend/    Node + Express API and live-data WebSocket relay (deploy to Railway)
frontend/   Static Three.js + Chart.js site (deploy to Vercel)
```

The backend logs into the upstream VIYAT WeatherCast API, pulls the latest readings
and a recent time series, and relays them to the frontend over `/stream` (WebSocket)
with an `/api/current` REST fallback. Credentials never reach the browser.

## Local development

```bash
cd backend
npm install
# copy .env.example to .env and fill credentials
npm start          # http://localhost:4000  (also serves ../frontend/public)
```

## Deploy

### Backend → Railway
- Root directory: `backend`
- Start command: `node server/index.js` (Procfile/railway.json included)
- Environment variables: `WC_USERNAME`, `WC_PASSWORD`, optional `WC_MACHINE_ID`,
  `REFRESH_MS`. Railway provides `PORT` automatically.

### Frontend → Vercel
- Root directory: `frontend`
- Framework preset: Other (static). Output directory: `public`.
- After the backend is live, set the API base in `frontend/public/config.js`:
  ```js
  window.WEATHER_API = "https://<your-railway-app>.up.railway.app";
  ```

## Data fields

`temperature (°C)`, `humidity (%)`, `pressure (hPa)`, `wind_speed (km/h)`,
`wind_direction`, `precipitation (mm)`, `rain_in_last_day (mm)`,
`solar_irradiation (W/m²)`, `battery_life (%)`, `date_time`.

## Tech

Three.js (WebGL, bloom post-processing, GLTF), Chart.js, Express, ws.
The frog model was built in Blender and exported to `frontend/public/models/`.
