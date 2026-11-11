import { spawn } from 'node:child_process';
import { bins } from './binaries.js';
import { log } from './log.js';

/**
 * Starts a Cloudflare quick tunnel (no account needed) and resolves with its public https URL.
 * GitHub Pages is served over https, so the dashboard can only talk to an https API.
 */
export function startTunnel(port) {
  return new Promise((resolve, reject) => {
    const p = spawn(bins.cloudflared, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], { windowsHide: true });
    let done = false;
    const timer = setTimeout(() => { if (!done) reject(new Error('Tunnel startet nicht (Zeitüberschreitung)')); }, 60_000);
    const onData = (d) => {
      const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && !done) {
        done = true;
        clearTimeout(timer);
        resolve(m[0]);
      }
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('exit', (code) => {
      if (!done) { clearTimeout(timer); reject(new Error(`cloudflared beendet (${code})`)); } else log.warn('Tunnel wurde beendet.');
    });
    process.on('exit', () => p.kill());
  });
}
