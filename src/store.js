import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { log } from './log.js';
import { DEFAULTS, merge } from './defaults.js';

/*
 * Small JSON storage. Every file is kept in memory and written shortly after a change
 * (atomic: temp file + rename). Enough for many servers and needs no database.
 */
const docs = new Map(); // file -> { data, timer }

function fileFor(name) { return path.join(config.dataDir, `${name}.json`); }

function writeNow(file, doc) {
  clearTimeout(doc.timer);
  doc.timer = null;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(doc.data));
    fs.renameSync(`${file}.tmp`, file);
  } catch (e) { log.warn('Speichern fehlgeschlagen:', file, e.message); }
}

/** Returns the stored object for `name` (e.g. "guilds/123"), created from `init()` when missing. */
export function doc(name, init = () => ({})) {
  const file = fileFor(name);
  let d = docs.get(file);
  if (!d) {
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = init(); }
    d = { data, timer: null };
    docs.set(file, d);
  }
  return d.data;
}

/** Marks a document as changed, it is written within a second. */
export function touch(name) {
  const file = fileFor(name);
  const d = docs.get(file);
  if (!d || d.timer) return;
  d.timer = setTimeout(() => writeNow(file, d), 800);
}

export function replace(name, data) {
  const file = fileFor(name);
  doc(name);
  docs.get(file).data = data;
  touch(name);
  return data;
}

export function flushAll() {
  for (const [file, d] of docs) if (d.timer) writeNow(file, d);
}
process.on('exit', flushAll);

/* ---------- per server ---------- */

/** Module settings of a server, always complete (missing keys come from the defaults). */
const normalized = new Set();
export function guildConfig(guildId) {
  const name = `guilds/${guildId}/config`;
  const raw = doc(name, () => ({}));
  if (normalized.has(raw)) return raw;
  normalized.add(raw);
  let changed = false;
  for (const mod of Object.keys(DEFAULTS)) {
    const full = merge(DEFAULTS[mod], raw[mod]);
    if (JSON.stringify(full) !== JSON.stringify(raw[mod])) { raw[mod] = full; changed = true; }
  }
  if (changed) touch(name);
  return raw;
}

export function saveModule(guildId, mod, value) {
  const name = `guilds/${guildId}/config`;
  const raw = guildConfig(guildId);
  raw[mod] = merge(DEFAULTS[mod], value);
  touch(name);
  return raw[mod];
}

/** Free-form data of a module on a server (XP, cases, history ...). */
export function guildData(guildId, kind, init = () => ({})) {
  return doc(`guilds/${guildId}/${kind}`, init);
}
export function saveData(guildId, kind) { touch(`guilds/${guildId}/${kind}`); }

/** Settings that belong to the whole bot (profile, status). */
export function botData() { return doc('bot', () => ({})); }
export function saveBot() { touch('bot'); }
