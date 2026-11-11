import { Events, MessageFlags, PermissionFlagsBits as P, SlashCommandBuilder } from 'discord.js';
import { guildData, saveData } from '../store.js';
import { buildMessage, guildVars, userVars } from '../render.js';

/** XP needed to get from level l to l + 1. */
export const need = (l) => 5 * l * l + 50 * l + 100;
export function levelOf(xp) {
  let l = 0;
  while (xp >= need(l)) { xp -= need(l); l++; }
  return { level: l, into: xp, next: need(l) };
}
export const totalFor = (level) => { let t = 0; for (let l = 0; l < level; l++) t += need(l); return t; };

export const levelData = (gid) => guildData(gid, 'levels', () => ({ users: {} }));
const cooldown = new Map();

export function ranking(gid) {
  return Object.entries(levelData(gid).users).sort((a, b) => b[1].xp - a[1].xp);
}

function multiplier(cfg, member) {
  let f = 1;
  for (const m of cfg.multipliers) if (member?.roles?.cache?.has(m.role)) f = Math.max(f, Number(m.factor) || 1);
  return f;
}

async function applyRewards(ctx, guild, member, level) {
  const cfg = ctx.cfg(guild.id).levels;
  const rewards = cfg.rewards.filter((r) => r.role && guild.roles.cache.has(r.role)).sort((a, b) => a.level - b.level);
  if (!rewards.length || !member) return;
  const earned = rewards.filter((r) => Number(r.level) <= level);
  const keep = cfg.stackRewards ? earned : earned.slice(-1);
  const add = keep.map((r) => r.role).filter((r) => !member.roles.cache.has(r));
  const remove = rewards.filter((r) => !keep.includes(r)).map((r) => r.role).filter((r) => member.roles.cache.has(r));
  if (add.length) await member.roles.add(add, `Level ${level}`).catch((e) => ctx.log.warn('Level-Rolle:', e.message));
  if (remove.length) await member.roles.remove(remove, `Level ${level}`).catch(() => {});
}

/** Gives XP and handles level-ups. `channel` is where the user was active (for announcements). */
export async function giveXp(ctx, guild, member, amount, channel = null) {
  const all = ctx.cfg(guild.id);
  const cfg = all.levels;
  const d = levelData(guild.id);
  const u = d.users[member.id] || (d.users[member.id] = { xp: 0, msgs: 0 });
  const before = levelOf(u.xp).level;
  u.xp = Math.max(0, Math.round(u.xp + amount));
  u.name = member.displayName; u.avatar = member.displayAvatarURL({ size: 64, extension: 'png' });
  saveData(guild.id, 'levels');
  const after = levelOf(u.xp).level;
  if (after === before) return;
  await applyRewards(ctx, guild, member, after);
  if (after < before || cfg.announce === 'off') return;
  const vars = { ...guildVars(guild), ...userVars(member.user, member), level: after, xp: u.xp, rank: ranking(guild.id).findIndex(([id]) => id === member.id) + 1 };
  const body = buildMessage(cfg.levelUp, vars, all);
  if (!body) return;
  if (cfg.announce === 'dm') await member.send(body).catch(() => {});
  else {
    const ch = cfg.announce === 'channel' && cfg.announceChannel ? await ctx.channel(cfg.announceChannel) : channel;
    await ch?.send?.(body).catch(() => {});
  }
}

const commands = [
  new SlashCommandBuilder().setName('rank').setDescription('Zeigt Level und XP').setDMPermission(false)
    .addUserOption((o) => o.setName('user').setDescription('Von wem? (leer = du)')),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Die aktivsten Mitglieder').setDMPermission(false)
    .addIntegerOption((o) => o.setName('seite').setDescription('Seite').setMinValue(1)),
  new SlashCommandBuilder().setName('xp').setDescription('XP verwalten').setDefaultMemberPermissions(P.ManageGuild).setDMPermission(false)
    .addSubcommand((s) => s.setName('add').setDescription('XP geben oder abziehen').addUserOption((o) => o.setName('user').setDescription('Wer?').setRequired(true))
      .addIntegerOption((o) => o.setName('menge').setDescription('XP (negativ = abziehen)').setRequired(true)))
    .addSubcommand((s) => s.setName('level').setDescription('Level setzen').addUserOption((o) => o.setName('user').setDescription('Wer?').setRequired(true))
      .addIntegerOption((o) => o.setName('level').setDescription('Neues Level').setMinValue(0).setMaxValue(500).setRequired(true)))
    .addSubcommand((s) => s.setName('reset').setDescription('XP auf 0 setzen').addUserOption((o) => o.setName('user').setDescription('Wer?').setRequired(true))),
];

const bar = (a, b, n = 16) => { const f = Math.round((a / b) * n); return `${'▰'.repeat(f)}${'▱'.repeat(n - f)}`; };

async function command(i, ctx) {
  const cfg = ctx.cfg(i.guildId).levels;
  if (!cfg.enabled) return i.reply({ content: 'Das Level-System ist auf diesem Server aus (Panel: /aio).', flags: MessageFlags.Ephemeral });
  const d = levelData(i.guildId);
  if (i.commandName === 'rank') {
    const user = i.options.getUser('user') || i.user;
    const u = d.users[user.id] || { xp: 0 };
    const l = levelOf(u.xp);
    const rank = ranking(i.guildId).findIndex(([id]) => id === user.id) + 1;
    return i.reply({ embeds: [ctx.styled(i.guildId, {
      title: `${user.displayName || user.username}`, thumbnail: user.displayAvatarURL({ size: 128 }),
      description: `**Level ${l.level}** · Rang ${rank ? `#${rank}` : '-'}\n${bar(l.into, l.next)} ${l.into}/${l.next} XP\nGesamt: ${u.xp} XP`,
    })] });
  }
  if (i.commandName === 'leaderboard') {
    const page = (i.options.getInteger('seite') || 1) - 1;
    const list = ranking(i.guildId).slice(page * 10, page * 10 + 10);
    const text = list.map(([id, u], n) => `**${page * 10 + n + 1}.** <@${id}> · Level ${levelOf(u.xp).level} · ${u.xp} XP`).join('\n') || 'Noch niemand hat XP.';
    return i.reply({ embeds: [ctx.styled(i.guildId, { title: `Rangliste ${i.guild.name}`, description: text, footer: `Seite ${page + 1}` })], allowedMentions: { parse: [] } });
  }
  if (i.commandName === 'xp') {
    const user = i.options.getUser('user');
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    if (!member) return i.reply({ content: 'Mitglied nicht gefunden.', flags: MessageFlags.Ephemeral });
    const u = d.users[user.id] || { xp: 0 };
    const sub = i.options.getSubcommand();
    const target = sub === 'add' ? u.xp + i.options.getInteger('menge') : sub === 'level' ? totalFor(i.options.getInteger('level')) : 0;
    await giveXp(ctx, i.guild, member, target - u.xp, null);
    return i.reply({ content: `${user} hat jetzt ${levelData(i.guildId).users[user.id].xp} XP (Level ${levelOf(levelData(i.guildId).users[user.id].xp).level}).`, flags: MessageFlags.Ephemeral });
  }
  return undefined;
}

function init(client, ctx) {
  client.on(Events.MessageCreate, async (m) => {
    if (!m.guild || m.author.bot || m.webhookId) return;
    const cfg = ctx.cfg(m.guild.id).levels;
    if (!cfg.enabled || cfg.noXpChannels.includes(m.channelId) || cfg.noXpChannels.includes(m.channel?.parentId)) return;
    const key = `${m.guild.id}:${m.author.id}`;
    if (Date.now() - (cooldown.get(key) || 0) < cfg.cooldown * 1000) return;
    const member = m.member || await m.guild.members.fetch(m.author.id).catch(() => null);
    if (!member || cfg.noXpRoles.some((r) => member.roles.cache.has(r))) return;
    cooldown.set(key, Date.now());
    const lo = Math.min(cfg.xpMin, cfg.xpMax); const hi = Math.max(cfg.xpMin, cfg.xpMax);
    const amount = (lo + Math.floor(Math.random() * (hi - lo + 1))) * multiplier(cfg, member);
    const u = levelData(m.guild.id).users[m.author.id];
    if (u) u.msgs = (u.msgs || 0) + 1;
    await giveXp(ctx, m.guild, member, amount, m.channel);
  });
  client.on(Events.GuildMemberRemove, (m) => {
    if (!ctx.cfg(m.guild.id).levels.resetOnLeave) return;
    delete levelData(m.guild.id).users[m.id];
    saveData(m.guild.id, 'levels');
  });
}

function ready(ctx) {
  // voice XP: once a minute for everyone talking with at least one other person
  setInterval(() => {
    for (const g of ctx.client.guilds.cache.values()) {
      const cfg = ctx.cfg(g.id).levels;
      if (!cfg.enabled || !cfg.voiceXp) continue;
      for (const vs of g.voiceStates.cache.values()) {
        if (!vs.channel || vs.channelId === g.afkChannelId || vs.selfDeaf || vs.serverDeaf || !vs.member || vs.member.user.bot) continue;
        if (vs.channel.members.filter((x) => !x.user.bot).size < 2) continue;
        if (cfg.noXpChannels.includes(vs.channelId) || cfg.noXpRoles.some((r) => vs.member.roles.cache.has(r))) continue;
        giveXp(ctx, g, vs.member, cfg.voiceXpPerMinute * multiplier(cfg, vs.member), null).catch(() => {});
      }
    }
  }, 60_000);
}

export default { name: 'levels', commands, command, init, ready };
