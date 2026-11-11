import { guildData, saveData } from '../store.js';
import { guildVars } from '../render.js';

/* Scheduled messages: every X minutes, daily, on certain weekdays or once. Times use TZ (.env). */

const runs = (gid) => guildData(gid, 'timers', () => ({ last: {} }));
const today = () => new Date().toLocaleDateString('sv-SE');
const hhmm = () => new Date().toTimeString().slice(0, 5);

export function due(t, last, now = new Date()) {
  if (t.on === false || !t.channel) return false;
  const d = now.toLocaleDateString('sv-SE');
  const time = now.toTimeString().slice(0, 5);
  switch (t.mode) {
    case 'interval': return now - (last || 0) >= Math.max(1, Number(t.every) || 60) * 60_000;
    case 'daily': return time >= t.time && (!last || new Date(last).toLocaleDateString('sv-SE') !== d) && time < addMinutes(t.time, 10);
    case 'weekly': {
      const wd = now.getDay() || 7;
      return (t.days || []).map(Number).includes(wd) && time >= t.time && time < addMinutes(t.time, 10) && (!last || new Date(last).toLocaleDateString('sv-SE') !== d);
    }
    case 'once': return !last && t.date && now >= new Date(t.date);
    default: return false;
  }
}

function addMinutes(hm, m) {
  const [h, mi] = String(hm || '00:00').split(':').map(Number);
  const t = h * 60 + mi + m;
  return t >= 1440 ? '24:00' : `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function ready(ctx) {
  setInterval(async () => {
    for (const g of ctx.client.guilds.cache.values()) {
      const cfg = ctx.cfg(g.id).timers;
      if (!cfg.enabled || !cfg.messages.length) continue;
      const r = runs(g.id);
      for (const t of cfg.messages) {
        if (!due(t, r.last[t.id])) continue;
        r.last[t.id] = Date.now();
        saveData(g.id, 'timers');
        await ctx.sendMessage(t.channel, t.message, guildVars(g), g.id);
      }
    }
  }, 30_000);
}

export const timerInfo = { today, hhmm };
export default { name: 'timers', ready, runs };
