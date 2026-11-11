import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, config } from './config.js';
import { log } from './log.js';
import { flushAll } from './store.js';

/*
 * Windows: checks GitHub every 15 minutes and updates itself (Linux does this with the systemd timer).
 * After an update the process ends, the launcher window (AIO.cmd) starts it again within seconds.
 */
const KEEP = new Set(['.env', 'data', 'logs', 'node', 'node_modules', 'bin', '.version', 'AIO.cmd', 'Uninstall.bat']);
const versionFile = path.join(ROOT, '.version');

async function latest() {
  const res = await fetch(`https://api.github.com/repos/Labtoso/Bots/commits/${config.branch}`, {
    headers: { Accept: 'application/vnd.github.sha', 'User-Agent': 'aio-updater' }, signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return (await res.text()).trim();
}

function copyDir(from, to) {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name); const b = path.join(to, e.name);
    if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copyDir(a, b); } else fs.copyFileSync(a, b);
  }
}

async function check() {
  const have = fs.existsSync(versionFile) ? fs.readFileSync(versionFile, 'utf8').trim() : '';
  const sha = await latest();
  if (!/^[0-9a-f]{40}$/.test(sha) || sha === have) return;
  log.info(`Update gefunden (${sha.slice(0, 7)}), wird installiert ...`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aio-update-'));
  try {
    const zip = path.join(tmp, 'aio.zip');
    const res = await fetch(`https://github.com/Labtoso/Bots/archive/${sha}.zip`, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Download ${res.status}`);
    fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    const r = spawnSync('tar', ['-xf', zip, '-C', tmp], { windowsHide: true, timeout: 120_000 });
    if (r.status !== 0) throw new Error('Entpacken fehlgeschlagen');
    const src = fs.readdirSync(tmp, { withFileTypes: true }).find((e) => e.isDirectory())?.name;
    if (!src) throw new Error('Leeres Archiv');
    const base = path.join(tmp, src);
    const oldLock = fs.existsSync(path.join(ROOT, 'package-lock.json')) ? fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8') : '';
    for (const e of fs.readdirSync(base, { withFileTypes: true })) {
      if (KEEP.has(e.name)) continue;
      const a = path.join(base, e.name); const b = path.join(ROOT, e.name);
      if (e.isDirectory()) { fs.mkdirSync(b, { recursive: true }); copyDir(a, b); } else fs.copyFileSync(a, b);
    }
    if (oldLock !== fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')) {
      const npm = path.join(ROOT, 'node', 'npm.cmd');
      spawnSync(fs.existsSync(npm) ? npm : 'npm', ['ci', '--omit=dev', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: ROOT, shell: true, windowsHide: true, stdio: 'ignore', timeout: 600_000 });
    }
    fs.writeFileSync(versionFile, sha);
    log.info('Update installiert, starte neu ...');
    flushAll();
    setTimeout(() => process.exit(0), 500);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function startUpdater() {
  if (process.platform !== 'win32' || !config.autoUpdate || !fs.existsSync(versionFile)) return;
  const run = () => check().catch((e) => log.warn('Update-Prüfung:', e.message));
  setTimeout(run, 2 * 60_000);
  setInterval(run, 15 * 60_000);
  log.info('Automatische Updates: an (alle 15 Minuten)');
}
