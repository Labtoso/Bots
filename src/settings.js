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

export const settings = {
  get(guildId) { return { channelId: null, ...(data[guildId] || {}) }; },
  set(guildId, patch) {
    data[guildId] = { ...settings.get(guildId), ...patch };
    save();
    return data[guildId];
  },
};
