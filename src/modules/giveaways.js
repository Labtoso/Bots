import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits as P, SlashCommandBuilder } from 'discord.js';
import { guildData, saveData } from '../store.js';
import { colorInt, parseDuration } from '../render.js';

export const gwData = (gid) => guildData(gid, 'giveaways', () => ({ list: [] }));

function embed(ctx, g, gw) {
  const cfg = ctx.cfg(g).giveaways;
  const ended = gw.ended;
  const e = ctx.styled(g, {
    title: `${cfg.emoji} ${gw.prize}`,
    description: [
      gw.description || '',
      ended ? `**Beendet** <t:${Math.floor(gw.ends / 1000)}:R>` : `Endet <t:${Math.floor(gw.ends / 1000)}:R> (<t:${Math.floor(gw.ends / 1000)}:f>)`,
      `Gewinner: **${gw.winners}** · Teilnehmer: **${gw.entries.length}**`,
      gw.role ? `Nur mit Rolle <@&${gw.role}>` : '',
      gw.host ? `Von <@${gw.host}>` : '',
      ended ? `\n🏆 ${gw.won?.length ? gw.won.map((id) => `<@${id}>`).join(', ') : 'Keine Teilnehmer'}` : '',
    ].filter(Boolean).join('\n'),
  });
  if (!ended && colorInt(cfg.color) !== null) e.color = colorInt(cfg.color);
  return e;
}

const row = (gw, ctx, g) => [new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId(`gw:join:${gw.id}`).setStyle(ButtonStyle.Primary).setEmoji(ctx.cfg(g).giveaways.emoji || '🎉')
    .setLabel(gw.ended ? 'Beendet' : 'Mitmachen').setDisabled(!!gw.ended),
)];

/** Starts a giveaway (from the command or the panel). */
export async function startGiveaway(ctx, guildId, { channel, prize, ms, winners = 1, role = '', description = '', host = null }) {
  const ch = await ctx.channel(channel);
  if (!ch?.isTextBased?.()) throw new Error('Bitte einen Textkanal wählen.');
  if (!prize) throw new Error('Was gibt es zu gewinnen?');
  if (!ms || ms < 30_000) throw new Error('Dauer fehlt (z. B. 1h, 2d).');
  const gw = { id: Date.now().toString(36), channel: ch.id, prize: prize.slice(0, 200), description: description.slice(0, 1500), winners: Math.max(1, Math.min(20, winners)), role, host, ends: Date.now() + ms, entries: [], ended: false };
  const msg = await ch.send({ embeds: [embed(ctx, guildId, gw)], components: row(gw, ctx, guildId) });
  gw.messageId = msg.id;
  gwData(guildId).list.push(gw);
  saveData(guildId, 'giveaways');
  return gw;
}

function draw(gw, n = gw.winners, exclude = []) {
  const pool = gw.entries.filter((id) => !exclude.includes(id));
  const out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

export async function endGiveaway(ctx, guildId, id, reroll = false) {
  const gw = gwData(guildId).list.find((x) => x.id === id);
  if (!gw) throw new Error('Gewinnspiel nicht gefunden.');
  if (reroll && !gw.ended) throw new Error('Läuft noch.');
  gw.won = reroll ? draw(gw, 1, gw.won || []).concat((gw.won || []).slice(1)) : draw(gw);
  gw.ended = true;
  gw.ends = Math.min(gw.ends, Date.now());
  saveData(guildId, 'giveaways');
  const ch = await ctx.channel(gw.channel);
  const msg = ch ? await ch.messages.fetch(gw.messageId).catch(() => null) : null;
  await msg?.edit({ embeds: [embed(ctx, guildId, gw)], components: row(gw, ctx, guildId) }).catch(() => {});
  if (ch) {
    const text = gw.won.length ? `🎉 Glückwunsch ${gw.won.map((x) => `<@${x}>`).join(', ')}! Ihr habt **${gw.prize}** gewonnen.` : `Niemand hat bei **${gw.prize}** mitgemacht.`;
    await ch.send({ content: text, ...(msg ? { reply: { messageReference: msg.id, failIfNotExists: false } } : {}) }).catch(() => {});
  }
  return gw;
}

const commands = [
  new SlashCommandBuilder().setName('giveaway').setDescription('Gewinnspiele').setDefaultMemberPermissions(P.ManageGuild).setDMPermission(false)
    .addSubcommand((s) => s.setName('start').setDescription('Startet ein Gewinnspiel in diesem Kanal')
      .addStringOption((o) => o.setName('preis').setDescription('Was gibt es?').setRequired(true))
      .addStringOption((o) => o.setName('dauer').setDescription('z. B. 30m, 2h, 3d').setRequired(true))
      .addIntegerOption((o) => o.setName('gewinner').setDescription('Anzahl Gewinner').setMinValue(1).setMaxValue(20))
      .addRoleOption((o) => o.setName('rolle').setDescription('Nur Mitglieder mit dieser Rolle')))
    .addSubcommand((s) => s.setName('ende').setDescription('Beendet ein Gewinnspiel sofort').addStringOption((o) => o.setName('id').setDescription('ID (im Panel)').setRequired(true).setAutocomplete(true)))
    .addSubcommand((s) => s.setName('reroll').setDescription('Zieht einen neuen Gewinner').addStringOption((o) => o.setName('id').setDescription('ID').setRequired(true).setAutocomplete(true))),
];

async function command(i, ctx) {
  const sub = i.options.getSubcommand();
  try {
    if (sub === 'start') {
      const gw = await startGiveaway(ctx, i.guildId, {
        channel: i.channelId, prize: i.options.getString('preis'), ms: parseDuration(i.options.getString('dauer')),
        winners: i.options.getInteger('gewinner') || 1, role: i.options.getRole('rolle')?.id || '', host: i.user.id,
      });
      return i.reply({ content: `Gewinnspiel gestartet (ID ${gw.id}).`, flags: MessageFlags.Ephemeral });
    }
    await endGiveaway(ctx, i.guildId, i.options.getString('id'), sub === 'reroll');
    return i.reply({ content: 'Erledigt.', flags: MessageFlags.Ephemeral });
  } catch (e) {
    return i.reply({ content: e.message, flags: MessageFlags.Ephemeral });
  }
}

async function autocomplete(i) {
  const list = gwData(i.guildId).list.slice(-25).reverse();
  await i.respond(list.map((g) => ({ name: `${g.prize} (${g.ended ? 'beendet' : 'läuft'})`.slice(0, 100), value: g.id })));
}

async function component(i, ctx) {
  const [, , id] = i.customId.split(':');
  const gw = gwData(i.guildId).list.find((x) => x.id === id);
  if (!gw || gw.ended) return i.reply({ content: 'Dieses Gewinnspiel ist vorbei.', flags: MessageFlags.Ephemeral });
  if (gw.role && !i.member.roles.cache.has(gw.role)) return i.reply({ content: `Dafür brauchst du die Rolle <@&${gw.role}>.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  const n = gw.entries.indexOf(i.user.id);
  if (n >= 0) gw.entries.splice(n, 1); else gw.entries.push(i.user.id);
  saveData(i.guildId, 'giveaways');
  await i.update({ embeds: [embed(ctx, i.guildId, gw)] });
  return i.followUp({ content: n >= 0 ? 'Du bist raus.' : 'Du bist dabei! Nochmal klicken zum Austreten.', flags: MessageFlags.Ephemeral });
}

function ready(ctx) {
  setInterval(() => {
    for (const g of ctx.client.guilds.cache.values()) {
      for (const gw of gwData(g.id).list) {
        if (!gw.ended && gw.ends <= Date.now()) endGiveaway(ctx, g.id, gw.id).catch((e) => ctx.log.warn('Gewinnspiel:', e.message));
      }
    }
  }, 15_000);
}

export default { name: 'giveaways', prefix: 'gw', commands, command, autocomplete, component, ready };
