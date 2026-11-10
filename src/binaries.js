import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpegStatic from 'ffmpeg-static';
import { config } from './config.js';
import { log } from './log.js';

const isWin = process.platform === 'win32';

function onPath(cmd) {
  const r = spawnSync(isWin ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null;
}

async function download(url, target) {
  log.info(`Lade ${path.basename(target)} herunter ...`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status}): ${url}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
  if (!isWin) fs.chmodSync(target, 0o755);
}

export const bins = { ffmpeg: null, ytdlp: null, cloudflared: null };

function ytdlpAsset() {
  if (isWin) return 'yt-dlp.exe';
  if (process.platform === 'darwin') return 'yt-dlp_macos';
  return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
}

function cloudflaredAsset() {
  if (isWin) return 'cloudflared-windows-amd64.exe';
  if (process.platform === 'darwin') return null; // macOS ships as .tgz, use brew instead
  return process.arch === 'arm64' ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64';
}

/* The one-file yt-dlp unpacks itself on every start (about 2 s on Windows). The folder build
   (Windows) or the Python zipapp (Linux with Python 3.10+) starts in a fraction of that. */
async function fastYtdlp() {
  try {
    if (isWin) {
      const dir = path.join(config.binDir, 'yt-dlp_win');
      const exe = path.join(dir, 'yt-dlp.exe');
      if (!fs.existsSync(exe)) {
        const zip = path.join(config.binDir, 'yt-dlp_win.zip');
        await download('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_win.zip', zip);
        fs.mkdirSync(dir, { recursive: true });
        const r = spawnSync('tar', ['-xf', zip, '-C', dir], { windowsHide: true, timeout: 120_000 });
        fs.rmSync(zip, { force: true });
        if (r.status !== 0 || !fs.existsSync(exe)) { fs.rmSync(dir, { recursive: true, force: true }); return null; }
      } else selfUpdate(exe);
      return exe;
    }
    if (process.platform === 'linux') {
      const py = spawnSync('python3', ['-c', 'import sys; print(sys.version_info >= (3, 10))'], { encoding: 'utf8' });
      if (py.status !== 0 || !py.stdout.includes('True')) return null;
      const app = path.join(config.binDir, 'yt-dlp.pyz');
      if (!fs.existsSync(app)) await download('https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp', app);
      else selfUpdate(app);
      return unpackedYtdlp(app) || app;
    }
  } catch (e) {
    log.warn('Schnelles yt-dlp nicht verfügbar:', e.message);
  }
  return null;
}

/* Python cannot cache compiled code inside the yt-dlp zip, so every call compiles it again (about
   0.4 s or more on small CPUs). Unpacked once and precompiled, each call starts much faster. */
function unpackedYtdlp(app) {
  try {
    const dir = path.join(config.binDir, 'yt-dlp_py');
    const stamp = path.join(dir, '.from');
    const want = String(fs.statSync(app).mtimeMs);
    if (!fs.existsSync(stamp) || fs.readFileSync(stamp, 'utf8') !== want) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const py = 'import sys, zipfile, compileall; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2]); compileall.compile_dir(sys.argv[2], quiet=1)';
      const r = spawnSync('python3', ['-c', py, app, dir], { stdio: 'ignore', timeout: 120_000 });
      if (r.status !== 0) { fs.rmSync(dir, { recursive: true, force: true }); return null; }
      fs.writeFileSync(stamp, want);
    }
    const run = path.join(config.binDir, 'yt-dlp-fast');
    const script = `#!/bin/sh\nexec python3 '${dir.replace(/'/g, "'\\''")}' "$@"\n`;
    if (!fs.existsSync(run) || fs.readFileSync(run, 'utf8') !== script) { fs.writeFileSync(run, script); fs.chmodSync(run, 0o755); }
    return run;
  } catch (e) {
    log.warn('yt-dlp entpacken:', e.message);
    return null;
  }
}

async function singleYtdlp() {
  const local = path.join(config.binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp');
  const found = fs.existsSync(local) ? local : onPath('yt-dlp');
  if (found) { if (found === local) selfUpdate(local); return found; }
  await download(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytdlpAsset()}`, local);
  return local;
}

// keep yt-dlp current, YouTube changes often
function selfUpdate(bin) {
  spawnSync(bin, ['-U'], { stdio: 'ignore', timeout: 60_000, windowsHide: true });
}

export async function ensureBinaries({ tunnel }) {
  bins.ffmpeg = process.env.FFMPEG_PATH || onPath('ffmpeg') || ffmpegStatic;

  bins.ytdlp = process.env.YTDLP_PATH || await fastYtdlp() || await singleYtdlp();
  if (tunnel) {
    const cfLocal = path.join(config.binDir, isWin ? 'cloudflared.exe' : 'cloudflared');
    bins.cloudflared = process.env.CLOUDFLARED_PATH || (fs.existsSync(cfLocal) ? cfLocal : onPath('cloudflared'));
    if (!bins.cloudflared) {
      const asset = cloudflaredAsset();
      if (!asset) throw new Error('cloudflared fehlt. Bitte installieren oder PUBLIC_URL setzen.');
      await download(`https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`, cfLocal);
      bins.cloudflared = cfLocal;
    }
  }
  log.info(`ffmpeg: ${bins.ffmpeg}`);
  log.info(`yt-dlp: ${bins.ytdlp}`);
}
