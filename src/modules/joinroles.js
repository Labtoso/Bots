import { Events } from 'discord.js';
import { guildData, saveData } from '../store.js';

/*
 * Join roles: roles for new members by rules (humans/bots, delay, account age, after rule screening,
 * temporary roles) and giving back the roles someone had when they left and joined again.
 */

const data = (gid) => guildData(gid, 'joinroles', () => ({ left: {}, timed: [] }));
const DAY = 864e5;

function ruleFits(rule, m) {
  if (rule.on === false || !rule.roles?.length) return false;
  if (rule.who === 'humans' && m.user.bot) return false;
  if (rule.who === 'bots' && !m.user.bot) return false;
  const days = Number(rule.minAccountDays) || 0;
  if (days > 0 && Date.now() - (m.user.createdTimestamp || 0) < days * DAY) return false;
  return true;
}

async function give(ctx, m, rule) {
  const roles = rule.roles.filter((r) => m.guild.roles.cache.has(r) && !m.roles.cache.has(r));
  if (!roles.length) return;
  await m.roles.add(roles, `Join-Rolle: ${rule.name || 'Regel'}`).catch((e) => ctx.log.warn('Join-Rolle:', e.message));
  const mins = Number(rule.removeAfterMinutes) || 0;
  if (mins > 0) {
    const d = data(m.guild.id);
    d.timed.push({ user: m.id, roles, at: Date.now() + mins * 60_000 });
    saveData(m.guild.id, 'joinroles');
  }
}

/** Applies all rules to a member that just joined (or just passed the rule screening). */
export async function applyRules(ctx, m, { screening = false } = {}) {
  const cfg = ctx.cfg(m.guild.id).joinroles;
  if (!cfg.enabled) return 0;
  let n = 0;
  for (const rule of cfg.rules) {
    if (!ruleFits(rule, m)) continue;
    const waits = rule.afterScreening && !m.user.bot;
    if (waits && m.pending && !screening) continue; // comes again when the screening is done
    if (!waits && screening) continue; // already handled on join
    n += 1;
    const delay = Math.max(0, Number(rule.delay) || 0);
    if (delay) setTimeout(() => m.guild.members.fetch(m.id).then((x) => give(ctx, x, rule)).catch(() => {}), delay * 1000);
    else await give(ctx, m, rule);
  }
  return n;
}

async function restore(ctx, m) {
  const cfg = ctx.cfg(m.guild.id).joinroles;
  if (!cfg.enabled || !cfg.restore) return;
  const d = data(m.guild.id);
  const prev = d.left[m.id];
  if (!prev) return;
  delete d.left[m.id];
  saveData(m.guild.id, 'joinroles');
  const top = m.guild.members.me?.roles?.highest?.position ?? 0;
  const roles = prev.roles.filter((r) => {
    const role = m.guild.roles.cache.get(r);
    return role && !role.managed && role.position < top && !cfg.restoreExclude.includes(r);
  });
  if (roles.length) await m.roles.add(roles, 'Rollen vom letzten Mal').catch((e) => ctx.log.warn('Rollen zurückgeben:', e.message));
}

function init(client, ctx) {
  client.on(Events.GuildMemberAdd, async (m) => {
    await applyRules(ctx, m).catch((e) => ctx.log.warn('Join-Rollen:', e.message));
    await restore(ctx, m).catch(() => {});
  });
  client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
    if (oldM.pending && !newM.pending) await applyRules(ctx, newM, { screening: true }).catch(() => {});
  });
  client.on(Events.GuildMemberRemove, (m) => {
    const cfg = ctx.cfg(m.guild.id).joinroles;
    if (!cfg.enabled || !cfg.restore || m.user?.bot) return;
    const roles = [...(m.roles?.cache?.keys?.() || [])].filter((r) => r !== m.guild.id);
    if (!roles.length) return;
    const d = data(m.guild.id);
    d.left[m.id] = { roles, at: Date.now() };
    // keep it small: forget people who left more than 180 days ago
    for (const [id, v] of Object.entries(d.left)) if (Date.now() - v.at > 180 * DAY) delete d.left[id];
    saveData(m.guild.id, 'joinroles');
  });
}

function ready(ctx) {
  setInterval(async () => {
    for (const g of ctx.client.guilds.cache.values()) {
      const d = data(g.id);
      if (!d.timed.length) continue;
      const due = d.timed.filter((t) => t.at <= Date.now());
      if (!due.length) continue;
      d.timed = d.timed.filter((t) => t.at > Date.now());
      saveData(g.id, 'joinroles');
      for (const t of due) {
        const m = await g.members.fetch(t.user).catch(() => null);
        if (m) await m.roles.remove(t.roles, 'Zeit-Rolle abgelaufen').catch(() => {});
      }
    }
  }, 60_000);
}

export default { name: 'joinroles', init, ready };
