import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config } from './config.js';
import { log } from './log.js';

const isWin = process.platform === 'win32';
export const bins = { cloudflared: null };

function onPath(cmd) {
  const r = spawnSync(isWin ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null;
}

function asset() {
  if (isWin) return 'cloudflared-windows-amd64.exe';
  if (process.platform === 'darwin') return null;
  return process.arch === 'arm64' ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64';
}

/** Makes sure cloudflared exists (only needed without PUBLIC_URL). */
export async function ensureTunnelBinary() {
  const local = path.join(config.binDir, isWin ? 'cloudflared.exe' : 'cloudflared');
  bins.cloudflared = process.env.CLOUDFLARED_PATH || (fs.existsSync(local) ? local : onPath('cloudflared'));
  if (bins.cloudflared) return;
  const a = asset();
  if (!a) throw new Error('cloudflared fehlt. Bitte installieren oder PUBLIC_URL setzen.');
  log.info('Lade cloudflared herunter ...');
  const res = await fetch(`https://github.com/cloudflare/cloudflared/releases/latest/download/${a}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status})`);
  fs.mkdirSync(config.binDir, { recursive: true });
  fs.writeFileSync(local, Buffer.from(await res.arrayBuffer()));
  if (!isWin) fs.chmodSync(local, 0o755);
  bins.cloudflared = local;
}
