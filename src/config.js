import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env loader, so no extra dependency is needed.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trimStart().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const env = process.env;

export const config = {
  token: env.DISCORD_TOKEN || '',
  port: Number(env.PORT || 8080),
  // Public HTTPS address of the API. Empty = start a Cloudflare quick tunnel automatically.
  publicUrl: (env.PUBLIC_URL || '').replace(/\/+$/, ''),
  tunnel: (env.TUNNEL || 'auto').toLowerCase(),
  dashboardUrl: (env.DASHBOARD_URL || 'https://bot.labtoso.de/Msik/').replace(/\/?$/, '/'),
  allowedOrigins: (env.ALLOWED_ORIGINS || 'https://bot.labtoso.de,https://labtoso.github.io,http://localhost:5500,http://127.0.0.1:5500')
    .split(',').map((s) => s.trim()).filter(Boolean),
  secret: env.SESSION_SECRET || '',
  sessionHours: Number(env.SESSION_HOURS || 12),
  idleMinutes: Number(env.IDLE_MINUTES || 5),
  defaultVolume: Number(env.DEFAULT_VOLUME || 60),
  maxQueue: Number(env.MAX_QUEUE || 500),
  guildId: env.GUILD_ID || '', // optional: register /web instantly on one server
  // Name shown in the dashboard's backend list, e.g. "VPS" or "Home PC"
  backendName: env.BACKEND_NAME || '',
  // Spotify search switch: the Client ID of the Msik app is built in, only the secret goes into .env
  spotifyId: env.SPOTIFY_CLIENT_ID || '2944ab8e06ac4993a6d880f44d105870',
  spotifySecret: env.SPOTIFY_CLIENT_SECRET || '',
  // The only Discord account with the owner tools and pranks (fixed on purpose, not changeable through .env)
  ownerId: '1073620742081617930',
  mock: env.MOCK === '1',
  binDir: path.join(ROOT, 'bin'),
};
