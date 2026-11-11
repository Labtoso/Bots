import { MessageFlags, PermissionFlagsBits as P, SlashCommandBuilder } from 'discord.js';
import { guildData, saveData } from '../store.js';
import { buildMessage, duration, guildVars, parseDuration, userVars } from '../render.js';

const ACTIONS = { warn: 'Verwarnung', timeout: 'Timeout', untimeout: 'Timeout aufgehoben', kick: 'Kick', ban: 'Bann', tempban: 'Zeitbann', unban: 'Entbannt', softban: 'Softban', purge: 'Nachrichten gelöscht' };
const COLORS = { warn: '#f59e0b', timeout: '#f97316', kick: '#ef4444', ban: '#b91c1c', tempban: '#b91c1c', softban: '#ef4444', unban: '#22c55e', untimeout: '#22c55e' };

const cases = (gid) => guildData(gid, 'cases', () => ({ n: 0, list: [], tempbans: [] }));

const user = (n, d, req = true) => (o) => o.setName(n).setDescription(d).setRequired(req);
const reason = (o) => o.setName('grund').setDescription('Grund').setMaxLength(500);

const commands = [
  new SlashCommandBuilder().setName('ban').setDescription('Bannt ein Mitglied').setDefaultMemberPermissions(P.BanMembers).setDMPermission(false)
    .addUserOption(user('user', 'Wer?')).addStringOption(reason)
    .addStringOption((o) => o.setName('dauer').setDescription('Leer = für immer, sonst z. B. 1d, 12h'))
    .addIntegerOption((o) => o.setName('nachrichten').setDescription('Nachrichten löschen').addChoices(
      { name: 'Keine', value: 0 }, { name: 'Letzte Stunde', value: 3600 }, { name: 'Letzte 24 Stunden', value: 86400 }, { name: 'Letzte 7 Tage', value: 604800 })),
  new SlashCommandBuilder().setName('unban').setDescription('Hebt einen Bann auf').setDefaultMemberPermissions(P.BanMembers).setDMPermission(false)
    .addStringOption((o) => o.setName('user_id').setDescription('Discord-ID').setRequired(true)).addStringOption(reason),
  new SlashCommandBuilder().setName('kick').setDescription('Wirft ein Mitglied raus').setDefaultMemberPermissions(P.KickMembers).setDMPermission(false)
    .addUserOption(user('user', 'Wer?')).addStringOption(reason),
  new SlashCommandBuilder().setName('softban').setDescription('Bann + sofort entbannen (löscht Nachrichten der letzten Tage)').setDefaultMemberPermissions(P.BanMembers).setDMPermission(false)
    .addUserOption(user('user', 'Wer?')).addStringOption(reason),
  new SlashCommandBuilder().setName('timeout').setDescription('Schaltet ein Mitglied stumm').setDefaultMemberPermissions(P.ModerateMembers).setDMPermission(false)
    .addUserOption(user('user', 'Wer?')).addStringOption((o) => o.setName('dauer').setDescription('z. B. 10m, 2h, 1d (max. 28d)')).addStringOption(reason),
  new SlashCommandBuilder().setName('untimeout').setDescription('Hebt den Timeout auf').setDefaultMemberPermissions(P.ModerateMembers).setDMPermission(false)
    .addUserOption(user('user', 'Wer?')).addStringOption(reason),
  new SlashCommandBuilder().setName('warn').setDescription('Verwarnt ein Mitglied').setDefaultMemberPermissions(P.ModerateMembers).setDMPermission(false)
    .addUserOption(user('user', 'Wer?')).addStringOption(reason),
  new SlashCommandBuilder().setName('warnings').setDescription('Zeigt die Verwarnungen eines Mitglieds').setDefaultMemberPermissions(P.ModerateMembers).setDMPermission(false)
    .addUserOption(user('user', 'Wer?')),
  new SlashCommandBuilder().setName('delwarn').setDescription('Löscht eine Verwarnung').setDefaultMemberPermissions(P.ModerateMembers).setDMPermission(false)
    .addIntegerOption((o) => o.setName('fall').setDescription('Fall-Nummer').setRequired(true)),
  new SlashCommandBuilder().setName('clearwarns').setDescription('Löscht alle Verwarnungen eines Mitglieds').setDefaultMemberPermissions(P.ModerateMembers).setDMPermission(false)
    .addUserOption(user('user', 'Wer?')),
  new SlashCommandBuilder().setName('purge').setDescription('Löscht Nachrichten in diesem Kanal').setDefaultMemberPermissions(P.ManageMessages).setDMPermission(false)
    .addIntegerOption((o) => o.setName('anzahl').setDescription('1-100').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(user('user', 'Nur von diesem Mitglied', false))
    .addStringOption((o) => o.setName('enthält').setDescription('Nur Nachrichten mit diesem Text')),
  new SlashCommandBuilder().setName('slowmode').setDescription('Setzt den Slowmode dieses Kanals').setDefaultMemberPermissions(P.ManageChannels).setDMPermission(false)
    .addIntegerOption((o) => o.setName('sekunden').setDescription('0 = aus, max. 21600').setMinValue(0).setMaxValue(21600).setRequired(true)),
  new SlashCommandBuilder().setName('lock').setDescription('Sperrt diesen Kanal für @everyone').setDefaultMemberPermissions(P.ManageChannels).setDMPermission(false)
    .addStringOption(reason),
  new SlashCommandBuilder().setName('unlock').setDescription('Entsperrt diesen Kanal').setDefaultMemberPermissions(P.ManageChannels).setDMPermission(false),
];

/** Adds a case, posts it in the mod log and returns it. Used by commands, Auto-Mod and the panel. */
export async function addCase(ctx, guild, { type, target, mod, reason, ms = 0 }) {
  const d = cases(guild.id);
  const c = {
    n: ++d.n, type, user: target.id, userName: target.tag || target.username || target.id,
    mod: mod?.id || null, modName: mod ? (mod.tag || mod.username) : 'Auto-Mod', reason: reason || '', at: Date.now(), ms: ms || 0,
  };
  d.list.push(c);
  if (d.list.length > 5000) d.list.splice(0, d.list.length - 5000);
  saveData(guild.id, 'cases');
  const cfg = ctx.cfg(guild.id).moderation;
  const fields = [
    { name: 'Mitglied', value: `<@${c.user}> (${c.userName})`, inline: true },
    { name: 'Von', value: c.mod ? `<@${c.mod}>` : c.modName, inline: true },
  ];
  if (ms) fields.push({ name: 'Dauer', value: duration(ms), inline: true });
  if (reason) fields.push({ name: 'Grund', value: reason.slice(0, 1000) });
  await ctx.logTo(guild.id, cfg.logChannel, { title: `Fall #${c.n} · ${ACTIONS[type] || type}`, color: COLORS[type], fields });
  return c;
}

async function dm(ctx, guild, target, type, reason, ms) {
  const cfg = ctx.cfg(guild.id).moderation;
  if (!cfg.dmUser) return;
  const vars = { ...guildVars(guild), ...userVars(target), action: ACTIONS[type] || type, reason: reason || '-', duration: ms ? duration(ms) : '-' };
  const body = buildMessage(cfg.dmMessage, vars, ctx.cfg(guild.id));
  if (body) await target.send(body).catch(() => {});
}

/** Carries out one action. Throws with a readable message when it is not possible. */
export async function punish(ctx, guild, { type, target, member, mod, reason, ms, deleteSeconds = 0 }) {
  member = member || await guild.members.fetch(target.id).catch(() => null);
  const audit = `${mod ? (mod.tag || mod.username) : 'Auto-Mod'}: ${reason || 'kein Grund'}`.slice(0, 500);
  if (['kick', 'ban', 'tempban', 'softban', 'timeout'].includes(type) && member) {
    if (ctx.isOwner(member.id) && mod && !ctx.isOwner(mod.id)) throw new Error('Das geht bei diesem Mitglied nicht.');
    if (member.id === guild.ownerId) throw new Error('Den Serverbesitzer kann man nicht bestrafen.');
    const can = { kick: member.kickable, ban: member.bannable, tempban: member.bannable, softban: member.bannable, timeout: member.moderatable }[type];
    if (!can) throw new Error('Der Bot steht in der Rollenliste nicht über diesem Mitglied oder hat das Recht nicht.');
    if (mod) {
      const modMember = await guild.members.fetch(mod.id).catch(() => null);
      if (modMember && modMember.id !== guild.ownerId && modMember.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
        throw new Error('Du kannst niemanden bestrafen, der gleich hoch oder höher ist als du.');
      }
    }
  }
  if (['kick', 'ban', 'tempban', 'softban', 'warn', 'timeout'].includes(type)) await dm(ctx, guild, target, type, reason, ms);
  switch (type) {
    case 'warn': break;
    case 'timeout': await member.timeout(Math.min(ms || 600_000, 28 * 864e5), audit); break;
    case 'untimeout': await member?.timeout(null, audit); break;
    case 'kick': await member.kick(audit); break;
    case 'ban': case 'tempban': await guild.members.ban(target.id, { reason: audit, deleteMessageSeconds: deleteSeconds }); break;
    case 'softban':
      await guild.members.ban(target.id, { reason: audit, deleteMessageSeconds: 604800 });
      await guild.members.unban(target.id, 'Softban');
      break;
    case 'unban': await guild.members.unban(target.id, audit); break;
    default: throw new Error(`Unbekannte Aktion ${type}`);
  }
  if (type === 'tempban' && ms) {
    const d = cases(guild.id);
    d.tempbans = (d.tempbans || []).filter((t) => t.user !== target.id);
    d.tempbans.push({ user: target.id, until: Date.now() + ms });
  }
  const c = await addCase(ctx, guild, { type, target, mod, reason, ms });
  if (type === 'warn') await warnEscalation(ctx, guild, target, member);
  return c;
}

export function activeWarns(ctx, guildId, userId) {
  const days = ctx.cfg(guildId).moderation.warnExpireDays;
  const since = days > 0 ? Date.now() - days * 864e5 : 0;
  return cases(guildId).list.filter((c) => c.type === 'warn' && c.user === userId && !c.removed && c.at >= since);
}

async function warnEscalation(ctx, guild, target, member) {
  const n = activeWarns(ctx, guild.id, target.id).length;
  const step = ctx.cfg(guild.id).moderation.warnActions.find((a) => Number(a.count) === n);
  if (!step || !step.action || step.action === 'none') return;
  const ms = (Number(step.minutes) || 0) * 60000;
  const type = step.action === 'ban' && ms ? 'tempban' : step.action;
  await punish(ctx, guild, { type, target, member, mod: null, reason: `${n} Verwarnungen`, ms }).catch((e) => ctx.log.warn('Warn-Stufe:', e.message));
}

const ephemeral = (cfg) => (cfg.publicReply ? {} : { flags: MessageFlags.Ephemeral });

async function command(i, ctx) {
  const cfg = ctx.cfg(i.guildId).moderation;
  if (!cfg.enabled) return i.reply({ content: 'Das Moderations-Modul ist auf diesem Server aus (Panel: /aio).', flags: MessageFlags.Ephemeral });
  const g = i.guild;
  const target = i.options.getUser('user');
  const why = i.options.getString('grund') || '';
  if (cfg.requireReason && !why && ['ban', 'kick', 'softban', 'timeout', 'warn'].includes(i.commandName)) {
    return i.reply({ content: 'Bitte gib einen Grund an.', flags: MessageFlags.Ephemeral });
  }
  const ok = (text) => i.reply({ embeds: [ctx.styled(i.guildId, { description: text, color: '#22c55e' })], ...ephemeral(cfg) });
  const run = async (type, extra = {}) => {
    try {
      const c = await punish(ctx, g, { type, target: extra.target || target, mod: i.user, reason: why, ...extra });
      return c;
    } catch (e) {
      await i.reply({ content: `Nicht möglich: ${e.message}`, flags: MessageFlags.Ephemeral });
      return null;
    }
  };
  switch (i.commandName) {
    case 'ban': {
      const ms = parseDuration(i.options.getString('dauer'));
      const c = await run(ms ? 'tempban' : 'ban', { ms, deleteSeconds: i.options.getInteger('nachrichten') || 0 });
      if (c) await ok(`**${target.tag}** wurde ${ms ? `für ${duration(ms)} ` : ''}gebannt. (Fall #${c.n})`);
      return;
    }
    case 'unban': {
      const id = i.options.getString('user_id').replace(/\D/g, '');
      const u = await ctx.client.users.fetch(id).catch(() => null);
      if (!u) return i.reply({ content: 'Diese ID gibt es nicht.', flags: MessageFlags.Ephemeral });
      const c = await run('unban', { target: u });
      if (c) await ok(`**${u.tag}** ist entbannt. (Fall #${c.n})`);
      return;
    }
    case 'kick': { const c = await run('kick'); if (c) await ok(`**${target.tag}** wurde rausgeworfen. (Fall #${c.n})`); return; }
    case 'softban': { const c = await run('softban'); if (c) await ok(`**${target.tag}** wurde gesoftbannt. (Fall #${c.n})`); return; }
    case 'timeout': {
      const ms = parseDuration(i.options.getString('dauer')) || cfg.muteDefaultMinutes * 60000;
      const c = await run('timeout', { ms });
      if (c) await ok(`**${target.tag}** ist für ${duration(ms)} stumm. (Fall #${c.n})`);
      return;
    }
    case 'untimeout': { const c = await run('untimeout'); if (c) await ok(`Timeout von **${target.tag}** aufgehoben.`); return; }
    case 'warn': {
      const c = await run('warn');
      if (c) await ok(`**${target.tag}** wurde verwarnt (${activeWarns(ctx, g.id, target.id).length}. Verwarnung, Fall #${c.n}).`);
      return;
    }
    case 'warnings': {
      const list = activeWarns(ctx, g.id, target.id);
      const text = list.length
        ? list.slice(-15).map((c) => `**#${c.n}** · <t:${Math.floor(c.at / 1000)}:d> · ${c.reason || 'kein Grund'} (von ${c.modName})`).join('\n')
        : 'Keine Verwarnungen.';
      return i.reply({ embeds: [ctx.styled(g.id, { title: `Verwarnungen von ${target.tag}`, description: text })], flags: MessageFlags.Ephemeral });
    }
    case 'delwarn': {
      const c = cases(g.id).list.find((x) => x.n === i.options.getInteger('fall') && x.type === 'warn');
      if (!c) return i.reply({ content: 'Diese Verwarnung gibt es nicht.', flags: MessageFlags.Ephemeral });
      c.removed = true; saveData(g.id, 'cases');
      return ok(`Verwarnung #${c.n} gelöscht.`);
    }
    case 'clearwarns': {
      let n = 0;
      for (const c of cases(g.id).list) if (c.type === 'warn' && c.user === target.id && !c.removed) { c.removed = true; n++; }
      saveData(g.id, 'cases');
      return ok(`${n} Verwarnung(en) von **${target.tag}** gelöscht.`);
    }
    case 'purge': {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const n = i.options.getInteger('anzahl');
      const from = i.options.getUser('user');
      const text = (i.options.getString('enthält') || '').toLowerCase();
      let msgs = await i.channel.messages.fetch({ limit: 100 });
      msgs = msgs.filter((m) => (!from || m.author.id === from.id) && (!text || m.content.toLowerCase().includes(text)) && Date.now() - m.createdTimestamp < 14 * 864e5);
      const list = [...msgs.values()].slice(0, n);
      const done = list.length ? await i.channel.bulkDelete(list, true) : new Map();
      await ctx.logTo(g.id, cfg.logChannel, { title: 'Nachrichten gelöscht', description: `${done.size} Nachrichten in <#${i.channelId}> von <@${i.user.id}>`, color: '#64748b' });
      return i.editReply(`${done.size} Nachrichten gelöscht.`);
    }
    case 'slowmode': {
      const s = i.options.getInteger('sekunden');
      await i.channel.setRateLimitPerUser(s, `von ${i.user.tag}`);
      return ok(s ? `Slowmode: ${s} Sekunden.` : 'Slowmode aus.');
    }
    case 'lock': case 'unlock': {
      const lock = i.commandName === 'lock';
      await i.channel.permissionOverwrites.edit(g.roles.everyone, { SendMessages: lock ? false : null, AddReactions: lock ? false : null, CreatePublicThreads: lock ? false : null });
      await ctx.logTo(g.id, cfg.logChannel, { title: lock ? 'Kanal gesperrt' : 'Kanal entsperrt', description: `<#${i.channelId}> von <@${i.user.id}>${why ? `\nGrund: ${why}` : ''}`, color: lock ? '#ef4444' : '#22c55e' });
      return i.reply({ embeds: [ctx.styled(g.id, { description: lock ? '🔒 Dieser Kanal ist gesperrt.' : '🔓 Dieser Kanal ist wieder offen.' })] });
    }
    default: return undefined;
  }
}

function ready(ctx) {
  // ends temporary bans
  setInterval(async () => {
    for (const g of ctx.client.guilds.cache.values()) {
      const d = cases(g.id);
      const due = (d.tempbans || []).filter((t) => t.until <= Date.now());
      if (!due.length) continue;
      d.tempbans = d.tempbans.filter((t) => t.until > Date.now());
      saveData(g.id, 'cases');
      for (const t of due) {
        await g.members.unban(t.user, 'Zeitbann abgelaufen').catch(() => {});
        const u = await ctx.client.users.fetch(t.user).catch(() => ({ id: t.user, username: t.user }));
        await addCase(ctx, g, { type: 'unban', target: u, mod: null, reason: 'Zeitbann abgelaufen' });
      }
    }
  }, 60_000);
}

export default { name: 'moderation', commands, command, ready, cases };
