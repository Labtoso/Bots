import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';
import { log } from './log.js';

/* Per-server settings (e.g. the voice channel the bot joins), kept in data/settings.json. */
const file = process.env.SETTINGS_FILE || path.join(ROOT, 'data', 'settings.json');
let data = {};
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = {}; }

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
      fs.renameSync(`${file}.tmp`, file);
    } catch (e) { log.warn('Einstellungen nicht gespeichert:', e.message); }
  }, 200);
}

const GLOBAL = '_all'; // settings for the whole bot, not one server

export const settings = {
  global() { return { blocked: [], hidden: false, ...(data[GLOBAL] || {}) }; },
  setGlobal(patch) {
    data[GLOBAL] = { ...settings.global(), ...patch };
    save();
    return data[GLOBAL];
  },
  /** Blocked by Discord ID or name (case does not matter). */
  isBlocked(userId, name) {
    const list = settings.global().blocked;
    if (!list.length) return false;
    const n = String(name || '').toLowerCase();
    return list.some((b) => (userId && b === String(userId)) || (n && b.toLowerCase() === n));
  },
  get(guildId) { return { channelId: null, npEnabled: false, npChannelId: null, webChannelId: null, guestEpoch: 0, ...(data[guildId] || {}) }; },
  set(guildId, patch) {
    data[guildId] = { ...settings.get(guildId), ...patch };
    save();
    return data[guildId];
  },
};
