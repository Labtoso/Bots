import { Events, MessageType } from 'discord.js';
import { buildMessage, guildVars, userVars } from '../render.js';
import { guildData, saveData } from '../store.js';

/* Server boosts: thank-you message, DM, extra roles for boosters, message when a boost ends. */

const BOOST_TYPES = new Set([MessageType.GuildBoost, MessageType.GuildBoostTier1, MessageType.GuildBoostTier2, MessageType.GuildBoostTier3]);
const recent = new Map(); // guild:user -> time of the last thank-you (a boost fires member update and system message)

/** Roles a booster gets: for everyone, for this person, and from a number of boosts on. */
export function boosterRoles(cfg, userId, count = 1) {
  const out = new Set(cfg.roles || []);
  for (const x of cfg.memberRoles || []) if (String(x.user) === String(userId)) (x.roles || []).forEach((r) => out.add(r));
  for (const x of cfg.countRoles || []) if ((Number(x.count) || 1) <= count) (x.roles || []).forEach((r) => out.add(r));
  return [...out];
}

export const boostData = (gid) => guildData(gid, 'boosts', () => ({ total: 0, users: {} }));

export function boostVars(guild, user, member) {
  const d = boostData(guild.id);
  return {
    ...guildVars(guild), ...userVars(user, member),
    boosts: guild.premiumSubscriptionCount || 0, tier: guild.premiumTier ?? 0,
    'user.boosts': d.users[user.id]?.count || 1,
    'boost.since': member?.premiumSinceTimestamp ? `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>` : '',
  };
}

/** Thank-you for a new boost. `test` sends it without counting (button in the panel). */
export async function onBoost(ctx, member, { test = false } = {}) {
  const g = member.guild;
  const all = ctx.cfg(g.id);
  const cfg = all.boost;
  if (!test) {
    if (!cfg.enabled) return false;
    const key = `${g.id}:${member.id}`;
    if (Date.now() - (recent.get(key) || 0) < 60_000) return false;
    recent.set(key, Date.now());
    const d = boostData(g.id);
    const u = d.users[member.id] || (d.users[member.id] = { count: 0, first: Date.now() });
    u.count += 1; u.last = Date.now(); u.active = true; d.total += 1;
    saveData(g.id, 'boosts');
  }
  const vars = boostVars(g, member.user, member);
  const roles = boosterRoles(cfg, member.id, vars['user.boosts']).filter((r) => g.roles.cache.has(r) && !member.roles?.cache?.has(r));
  if (roles.length && !test) await member.roles.add(roles, 'Server boost').catch((e) => ctx.log.warn('Booster role:', e.message));
  let sent = null;
  if (cfg.channel) sent = await ctx.sendMessage(cfg.channel, cfg.message, vars, g.id);
  if (cfg.dmEnabled) {
    const body = buildMessage(cfg.dm, vars, all);
    if (body) await member.send(body).catch(() => {});
  }
  if (cfg.logChannel && !test) {
    await ctx.logTo(g.id, cfg.logChannel, { title: 'Server-Boost', description: `<@${member.id}> hat den Server geboostet. Jetzt ${vars.boosts} Boosts (Level ${vars.tier}).`, color: '#f47fff' });
  }
  return { ok: true, channel: !!cfg.channel, url: sent?.url || null };
}

async function onUnboost(ctx, member) {
  const g = member.guild;
  const cfg = ctx.cfg(g.id).boost;
  if (!cfg.enabled) return;
  const d = boostData(g.id);
  if (d.users[member.id]) { d.users[member.id].active = false; d.users[member.id].ended = Date.now(); saveData(g.id, 'boosts'); }
  if (cfg.removeRoles) {
    const roles = boosterRoles(cfg, member.id, Infinity).filter((r) => member.roles?.cache?.has(r));
    if (roles.length) await member.roles.remove(roles, 'Boost ended').catch((e) => ctx.log.warn('Booster role:', e.message));
  }
  const vars = boostVars(g, member.user, member);
  if (cfg.endEnabled) await ctx.sendMessage(cfg.endChannel || cfg.channel, cfg.end, vars, g.id);
  if (cfg.logChannel) await ctx.logTo(g.id, cfg.logChannel, { title: 'Boost beendet', description: `<@${member.id}> boostet den Server nicht mehr. Jetzt ${vars.boosts} Boosts.`, color: '#94a3b8' });
}

/** Current boosters of a server (for the panel). */
export async function boosterList(g) {
  const d = boostData(g.id);
  const members = g.members.cache.filter((m) => m.premiumSinceTimestamp);
  return [...members.values()].sort((a, b) => a.premiumSinceTimestamp - b.premiumSinceTimestamp).map((m) => ({
    id: m.id, name: m.displayName, avatar: m.displayAvatarURL?.({ size: 64, extension: 'png' }) || null,
    since: m.premiumSinceTimestamp, count: d.users[m.id]?.count || null,
  }));
}

function init(client, ctx) {
  client.on(Events.GuildMemberUpdate, async (oldM, newM) => {
    if (oldM.partial) return; // without the old state we cannot tell
    const before = oldM.premiumSinceTimestamp || null;
    const after = newM.premiumSinceTimestamp || null;
    if (!before && after) await onBoost(ctx, newM).catch((e) => ctx.log.warn('Boost:', e.message));
    else if (before && !after) await onUnboost(ctx, newM).catch((e) => ctx.log.warn('Boost end:', e.message));
  });
  // a member who already boosts and boosts again only shows up as a system message
  client.on(Events.MessageCreate, async (msg) => {
    if (!msg.guild || !BOOST_TYPES.has(msg.type)) return;
    const member = msg.member || await msg.guild.members.fetch(msg.author.id).catch(() => null);
    if (member) await onBoost(ctx, member).catch((e) => ctx.log.warn('Boost:', e.message));
  });
}

export default { name: 'boost', init };
