import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env loader, so no extra dependency is needed.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trimStart().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

const env = process.env;
// times like "daily at 18:00" use this zone (a fresh Linux container is on UTC)
if (!env.TZ) env.TZ = 'Europe/Vienna';

export const config = {
  token: env.DISCORD_TOKEN || '',
  port: Number(env.PORT || 8090),
  // Public HTTPS address of the API. Empty = start a Cloudflare quick tunnel automatically.
  publicUrl: (env.PUBLIC_URL || '').replace(/\/+$/, ''),
  tunnel: (env.TUNNEL || 'auto').toLowerCase(),
  dashboardUrl: (env.DASHBOARD_URL || 'https://bot.labtoso.de/AIO/').replace(/\/?$/, '/'),
  allowedOrigins: (env.ALLOWED_ORIGINS || 'https://bot.labtoso.de,https://labtoso.github.io,http://localhost:5500,http://127.0.0.1:5500')
    .split(',').map((s) => s.trim()).filter(Boolean),
  secret: env.SESSION_SECRET || '',
  sessionHours: Number(env.SESSION_HOURS || 12),
  guildId: env.GUILD_ID || '', // optional: register the commands instantly on one server
  backendName: env.BACKEND_NAME || '',
  // The only Discord account that sees "Nur für dich" (fixed on purpose, not changeable through .env)
  rightsUser: '1073620742081617930',
  // Optional Twitch app for live alerts (without it the public channel page is checked)
  twitchId: env.TWITCH_CLIENT_ID || '',
  twitchSecret: env.TWITCH_CLIENT_SECRET || '',
  // Windows: the bot updates itself from GitHub (Linux uses the systemd timer)
  autoUpdate: env.AUTO_UPDATE !== '0',
  branch: env.AIO_BRANCH || 'AIO',
  mock: env.MOCK === '1',
  binDir: path.join(ROOT, 'bin'),
  dataDir: env.DATA_DIR || path.join(ROOT, 'data'),
};
