import 'dotenv/config';

export const config = {
  apiBase: 'https://api.weathercastsolutions.com/',
  wsBase: 'wss://api.weathercastsolutions.com/',
  username: process.env.WC_USERNAME || 'sanjivani_university',
  password: process.env.WC_PASSWORD || 'sanjivani_u@321',
  machineId: process.env.WC_MACHINE_ID || '', // empty -> auto-pick first machine
  port: Number(process.env.PORT || 4000),
  refreshMs: Number(process.env.REFRESH_MS || 15000),
  // Re-login when the cached token is older than this (tokens last ~24h).
  tokenMaxAgeMs: 12 * 60 * 60 * 1000,
};
