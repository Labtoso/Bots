import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Also writes to logs/aio.log, so problems can be looked up after the fact.
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'logs');
const file = path.join(dir, 'aio.log');
let ok = !process.env.NO_LOG_FILE;
try {
  if (ok) {
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > 5 * 1024 * 1024) fs.renameSync(file, `${file}.1`);
  }
} catch { ok = false; }

const stamp = () => new Date().toLocaleTimeString('de-DE');
function write(level, a) {
  if (!ok) return;
  const line = a.map((x) => (x instanceof Error ? x.stack : typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  try { fs.appendFileSync(file, `${new Date().toISOString()} ${level} ${line}\n`); } catch { ok = false; }
}
export const log = {
  info: (...a) => { console.log(`[${stamp()}]`, ...a); write('INFO', a); },
  warn: (...a) => { console.warn(`[${stamp()}] WARN`, ...a); write('WARN', a); },
  error: (...a) => { console.error(`[${stamp()}] FEHLER`, ...a); write('FEHLER', a); },
};
