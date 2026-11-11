import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags, PermissionFlagsBits as P } from 'discord.js';
import { guildData, saveData, saveModule } from '../store.js';
import { buildMessage, fill, guildVars, userVars } from '../render.js';
import { parseEmoji } from './reactionroles.js';

export const ticketData = (gid) => guildData(gid, 'tickets', () => ({ n: 0, open: {} }));

export async function publishPanel(ctx, guildId) {
  const all = ctx.cfg(guildId);
  const cfg = all.tickets;
  const ch = await ctx.channel(cfg.panelChannel);
  if (!ch?.isTextBased?.()) throw new Error('Bitte einen Kanal für das Ticket-Panel wählen.');
  const guild = ctx.client.guilds.cache.get(guildId);
  const body = buildMessage(cfg.panel, guildVars(guild), all) || { content: 'Support' };
  const btn = new ButtonBuilder().setCustomId('tk:open').setStyle(ButtonStyle.Primary).setLabel(cfg.buttonLabel || 'Ticket öffnen');
  const em = parseEmoji(cfg.buttonEmoji);
  if (em) btn.setEmoji(em);
  body.components = [new ActionRowBuilder().addComponents(btn)];
  let msg = cfg.panelMessageId ? await ch.messages.fetch(cfg.panelMessageId).catch(() => null) : null;
  if (msg) await msg.edit({ ...body, content: body.content ?? null }); else msg = await ch.send(body);
  cfg.panelMessageId = msg.id;
  saveModule(guildId, 'tickets', cfg);
  return { messageId: msg.id, url: msg.url };
}

async function open(i, ctx) {
  const all = ctx.cfg(i.guildId);
  const cfg = all.tickets;
  if (!cfg.enabled) return i.reply({ content: 'Tickets sind gerade aus.', flags: MessageFlags.Ephemeral });
  const d = ticketData(i.guildId);
  // forget tickets whose channel is gone
  for (const id of Object.keys(d.open)) if (!i.guild.channels.cache.has(id)) delete d.open[id];
  const mine = Object.entries(d.open).filter(([, t]) => t.user === i.user.id);
  if (mine.length >= Math.max(1, cfg.maxOpen)) return i.reply({ content: `Du hast schon ein offenes Ticket: <#${mine[0][0]}>`, flags: MessageFlags.Ephemeral });
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const n = ++d.n;
  const vars = { ...guildVars(i.guild), ...userVars(i.user, i.member), ticket: n };
  const support = cfg.supportRoles.filter((r) => i.guild.roles.cache.has(r));
  const ch = await i.guild.channels.create({
    name: fill(cfg.nameTemplate || 'ticket-{ticket}', vars).toLowerCase().slice(0, 90),
    type: ChannelType.GuildText,
    parent: cfg.category || null,
    permissionOverwrites: [
      { id: i.guild.roles.everyone.id, deny: [P.ViewChannel] },
      { id: i.user.id, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks] },
      { id: ctx.client.user.id, allow: [P.ViewChannel, P.SendMessages, P.ManageChannels, P.ReadMessageHistory, P.EmbedLinks] },
      ...support.map((r) => ({ id: r, allow: [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles] })),
    ],
    reason: `Ticket von ${i.user.tag}`,
  });
  d.open[ch.id] = { user: i.user.id, n, at: Date.now() };
  saveData(i.guildId, 'tickets');
  const body = buildMessage(cfg.opened, vars, all) || { content: `Ticket #${n}` };
  body.content = `${support.map((r) => `<@&${r}>`).join(' ')} ${body.content || ''}`.trim() || undefined;
  body.components = [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tk:claim').setStyle(ButtonStyle.Secondary).setLabel('Übernehmen').setEmoji('🙋'),
    new ButtonBuilder().setCustomId('tk:close').setStyle(ButtonStyle.Danger).setLabel('Schließen').setEmoji('🔒'),
  )];
  await ch.send(body);
  await ctx.logTo(i.guildId, cfg.logChannel, { title: `Ticket #${n} geöffnet`, description: `<#${ch.id}> von <@${i.user.id}>`, color: '#22c55e' });
  return i.editReply(`Dein Ticket: <#${ch.id}>`);
}

async function close(i, ctx) {
  const cfg = ctx.cfg(i.guildId).tickets;
  const d = ticketData(i.guildId);
  const t = d.open[i.channelId];
  if (!t) return i.reply({ content: 'Das ist kein offenes Ticket.', flags: MessageFlags.Ephemeral });
  await i.reply({ content: '🔒 Ticket wird geschlossen …' });
  const msgs = await i.channel.messages.fetch({ limit: 100 }).catch(() => new Map());
  const lines = [...msgs.values()].reverse().map((m) => `[${new Date(m.createdTimestamp).toLocaleString('de-DE')}] ${m.author.tag}: ${m.content}${m.attachments.size ? ` [${[...m.attachments.values()].map((a) => a.url).join(' ')}]` : ''}`);
  const file = new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), { name: `ticket-${t.n}.txt` });
  if (cfg.logChannel) {
    const log = await ctx.channel(cfg.logChannel);
    await log?.send({
      embeds: [ctx.styled(i.guildId, { title: `Ticket #${t.n} geschlossen`, description: `Von <@${t.user}>, geschlossen von <@${i.user.id}>${t.claimedBy ? `\nÜbernommen von <@${t.claimedBy}>` : ''}`, color: '#ef4444' })],
      files: [file], allowedMentions: { parse: [] },
    }).catch(() => {});
  }
  const u = await ctx.client.users.fetch(t.user).catch(() => null);
  await u?.send({ content: `Dein Ticket #${t.n} auf **${i.guild.name}** wurde geschlossen. Hier der Verlauf:`, files: [file] }).catch(() => {});
  delete d.open[i.channelId];
  saveData(i.guildId, 'tickets');
  setTimeout(() => i.channel.delete('Ticket geschlossen').catch(() => {}), 4000);
}

async function component(i, ctx) {
  const action = i.customId.split(':')[1];
  if (action === 'open') return open(i, ctx);
  if (action === 'close') return close(i, ctx);
  if (action === 'claim') {
    const cfg = ctx.cfg(i.guildId).tickets;
    const t = ticketData(i.guildId).open[i.channelId];
    if (!t) return i.reply({ content: 'Das ist kein offenes Ticket.', flags: MessageFlags.Ephemeral });
    const isSupport = cfg.supportRoles.some((r) => i.member.roles.cache.has(r)) || i.member.permissions.has(P.ManageChannels);
    if (!isSupport) return i.reply({ content: 'Nur das Support-Team kann Tickets übernehmen.', flags: MessageFlags.Ephemeral });
    t.claimedBy = i.user.id;
    saveData(i.guildId, 'tickets');
    return i.reply({ content: `🙋 <@${i.user.id}> kümmert sich um dieses Ticket.` });
  }
  return undefined;
}

export default { name: 'tickets', prefix: 'tk', component };
