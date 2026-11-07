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

export async function ensureBinaries({ tunnel }) {
  bins.ffmpeg = process.env.FFMPEG_PATH || onPath('ffmpeg') || ffmpegStatic;

  const ytLocal = path.join(config.binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp');
  bins.ytdlp = process.env.YTDLP_PATH || (fs.existsSync(ytLocal) ? ytLocal : onPath('yt-dlp'));
  if (!bins.ytdlp) {
    await download(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${ytdlpAsset()}`, ytLocal);
    bins.ytdlp = ytLocal;
  } else if (bins.ytdlp === ytLocal) {
    // keep yt-dlp current, YouTube changes often
    spawnSync(ytLocal, ['-U'], { stdio: 'ignore', timeout: 60_000 });
  }

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
