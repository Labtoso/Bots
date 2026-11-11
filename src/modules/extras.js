import { ChannelType, Events, MessageFlags, PermissionFlagsBits as P, SlashCommandBuilder } from 'discord.js';
import { guildData, saveData } from '../store.js';
import { fill, guildVars, userVars } from '../render.js';
import { parseEmoji } from './reactionroles.js';

/* Starboard, statistic channels, join-to-create voice channels and polls. */

/* ---------- starboard ---------- */
const stars = (gid) => guildData(gid, 'starboard', () => ({ posts: {} }));

async function onStar(ctx, reaction) {
  if (reaction.partial) await reaction.fetch().catch(() => null);
  const msg = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
  if (!msg?.guild) return;
  const cfg = ctx.cfg(msg.guild.id).starboard;
  if (!cfg.enabled || !cfg.channel || msg.channelId === cfg.channel || cfg.ignoreChannels.includes(msg.channelId)) return;
  const want = parseEmoji(cfg.emoji);
  if ((want?.id || want?.name) !== (reaction.emoji.id || reaction.emoji.name)) return;
  const users = await reaction.users.fetch().catch(() => null);
  const count = users ? users.filter((u) => !u.bot && (cfg.selfStar || u.id !== msg.author.id)).size : reaction.count;
  const d = stars(msg.guild.id);
  const ch = await ctx.channel(cfg.channel);
  if (!ch) return;
  const existing = d.posts[msg.id] ? await ch.messages.fetch(d.posts[msg.id]).catch(() => null) : null;
  const content = `${cfg.emoji} **${count}** · <#${msg.channelId}>`;
  if (count < cfg.threshold) {
    if (existing) await existing.edit({ content }).catch(() => {});
    return;
  }
  const img = msg.attachments.find((a) => a.contentType?.startsWith('image/'))?.url || msg.embeds[0]?.image?.url || '';
  const embed = ctx.styled(msg.guild.id, {
    description: `${(msg.content || '').slice(0, 3800)}\n\n[Zur Nachricht](${msg.url})`, color: '#f59e0b',
    footer: `ID ${msg.id}`,
  });
  embed.author = { name: msg.member?.displayName || msg.author.username, icon_url: msg.author.displayAvatarURL({ size: 64 }) };
  if (img) embed.image = { url: img };
  embed.timestamp = new Date(msg.createdTimestamp).toISOString();
  if (existing) await existing.edit({ content, embeds: [embed] }).catch(() => {});
  else {
    const sent = await ch.send({ content, embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
    if (sent) { d.posts[msg.id] = sent.id; saveData(msg.guild.id, 'starboard'); }
  }
}

/* ---------- statistic channels ---------- */
const lastName = new Map();
export function counterVars(g) {
  const humans = g.members.cache.filter((m) => !m.user.bot).size;
  const bots = g.members.cache.filter((m) => m.user.bot).size;
  return {
    ...guildVars(g), humans: humans || g.memberCount, bots, channels: g.channels.cache.size, roles: g.roles.cache.size - 1,
    boosts: g.premiumSubscriptionCount || 0, tier: g.premiumTier, emojis: g.emojis.cache.size,
  };
}
async function updateCounters(ctx, g) {
  const cfg = ctx.cfg(g.id).counters;
  if (!cfg.enabled) return;
  const vars = counterVars(g);
  for (const c of cfg.items) {
    const name = fill(c.template, vars).slice(0, 100);
    if (!c.channel || !name || lastName.get(c.channel) === name) continue;
    const ch = await ctx.channel(c.channel);
    lastName.set(c.channel, name);
    if (ch && ch.name !== name) await ch.setName(name, 'Statistik-Kanal').catch((e) => ctx.log.warn('Statistik-Kanal:', e.message));
  }
}

/* ---------- join to create ---------- */
const temp = () => guildData('_global', 'tempvoice', () => ({ channels: {} }));
async function onVoice(ctx, o, n) {
  const g = n.guild;
  const cfg = ctx.cfg(g.id).tempvoice;
  const t = temp();
  // left a temp channel that is empty now
  if (o.channelId && t.channels[o.channelId] && o.channelId !== n.channelId) {
    const ch = o.channel || await ctx.channel(o.channelId);
    if (!ch || ch.members.size === 0) {
      await ch?.delete('Temp-Kanal leer').catch(() => {});
      delete t.channels[o.channelId];
      saveData('_global', 'tempvoice');
    }
  }
  if (!cfg.enabled || !cfg.hub || n.channelId !== cfg.hub || !n.member) return;
  const hub = n.channel;
  const name = fill(cfg.name, { ...guildVars(g), ...userVars(n.member.user, n.member) }).slice(0, 100) || n.member.displayName;
  const ch = await g.channels.create({
    name, type: ChannelType.GuildVoice, parent: cfg.category || hub?.parentId || null, userLimit: cfg.limit || 0,
    permissionOverwrites: [{ id: n.member.id, allow: [P.ManageChannels, P.MoveMembers, P.Connect, P.Speak] }],
    reason: 'Temp-Sprachkanal',
  }).catch((e) => { ctx.log.warn('Temp-Kanal:', e.message); return null; });
  if (!ch) return;
  t.channels[ch.id] = { owner: n.member.id, guild: g.id };
  saveData('_global', 'tempvoice');
  await n.member.voice.setChannel(ch).catch(() => ch.delete().catch(() => {}));
}

/* ---------- polls ---------- */
const commands = [
  new SlashCommandBuilder().setName('umfrage').setDescription('Startet eine Umfrage').setDefaultMemberPermissions(P.ManageMessages).setDMPermission(false)
    .addStringOption((o) => o.setName('frage').setDescription('Die Frage').setRequired(true).setMaxLength(300))
    .addStringOption((o) => o.setName('antworten').setDescription('Antworten mit ; getrennt, z. B. Ja; Nein; Vielleicht').setRequired(true))
    .addIntegerOption((o) => o.setName('stunden').setDescription('Dauer in Stunden (Standard 24)').setMinValue(1).setMaxValue(768))
    .addBooleanOption((o) => o.setName('mehrfach').setDescription('Mehrere Antworten erlaubt')),
];

async function command(i) {
  const answers = i.options.getString('antworten').split(/;|\n/).map((s) => s.trim()).filter(Boolean).slice(0, 10);
  if (answers.length < 2) return i.reply({ content: 'Mindestens zwei Antworten, mit ; getrennt.', flags: MessageFlags.Ephemeral });
  return i.reply({
    poll: {
      question: { text: i.options.getString('frage') }, answers: answers.map((text) => ({ text: text.slice(0, 55) })),
      duration: i.options.getInteger('stunden') || 24, allowMultiselect: !!i.options.getBoolean('mehrfach'),
    },
  });
}

function init(client, ctx) {
  client.on(Events.MessageReactionAdd, (r) => onStar(ctx, r).catch((e) => ctx.log.warn('Starboard:', e.message)));
  client.on(Events.MessageReactionRemove, (r) => onStar(ctx, r).catch(() => {}));
  client.on(Events.VoiceStateUpdate, (o, n) => onVoice(ctx, o, n).catch((e) => ctx.log.warn('Temp-Voice:', e.message)));
}

function ready(ctx) {
  // members once, so humans/bots can be counted
  (async () => {
    for (const g of ctx.client.guilds.cache.values()) {
      if (ctx.cfg(g.id).counters.enabled && !ctx.missingIntents.length) await g.members.fetch().catch(() => {});
    }
  })();
  const run = async () => { for (const g of ctx.client.guilds.cache.values()) await updateCounters(ctx, g).catch(() => {}); };
  setTimeout(run, 15_000);
  setInterval(run, 10 * 60_000);
  // temp channels left over from before a restart
  setTimeout(async () => {
    const t = temp();
    for (const id of Object.keys(t.channels)) {
      const ch = await ctx.channel(id);
      if (!ch || ch.members?.size === 0) { await ch?.delete('Temp-Kanal leer').catch(() => {}); delete t.channels[id]; }
    }
    saveData('_global', 'tempvoice');
  }, 20_000);
}

export const refreshCounters = (ctx, g) => updateCounters(ctx, g);
export default { name: 'extras', commands, command, init, ready };
