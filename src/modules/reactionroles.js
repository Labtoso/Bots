import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, MessageFlags, StringSelectMenuBuilder } from 'discord.js';
import { saveModule } from '../store.js';
import { buildMessage, guildVars } from '../render.js';

const STYLE = { blue: ButtonStyle.Primary, grey: ButtonStyle.Secondary, green: ButtonStyle.Success, red: ButtonStyle.Danger };

export function parseEmoji(e) {
  e = String(e || '').trim();
  const m = e.match(/^<(a?):(\w+):(\d+)>$/);
  if (m) return { id: m[3], name: m[2], animated: !!m[1] };
  if (/^\d{15,}$/.test(e)) return { id: e };
  return e ? { name: e } : null;
}
const emojiKey = (e) => (e?.id ? e.id : e?.name || '');

function components(panel) {
  const items = panel.items.filter((x) => x.role).slice(0, 25);
  if (panel.type === 'buttons') {
    const rows = [];
    items.forEach((it, n) => {
      if (n % 5 === 0) rows.push(new ActionRowBuilder());
      const b = new ButtonBuilder().setCustomId(`rr:${panel.id}:${n}`).setStyle(STYLE[it.style] || ButtonStyle.Secondary);
      if (it.label) b.setLabel(it.label.slice(0, 80));
      const em = parseEmoji(it.emoji);
      if (em) b.setEmoji(em);
      if (!it.label && !em) b.setLabel('Rolle');
      rows[rows.length - 1].addComponents(b);
    });
    return rows;
  }
  if (panel.type === 'select') {
    const menu = new StringSelectMenuBuilder().setCustomId(`rr:${panel.id}`).setPlaceholder(panel.placeholder || 'Rollen auswählen')
      .setMinValues(0).setMaxValues(panel.mode === 'unique' ? 1 : Math.max(1, items.length));
    menu.addOptions(items.map((it, n) => {
      const o = { label: (it.label || `Rolle ${n + 1}`).slice(0, 100), value: String(n) };
      if (it.description) o.description = it.description.slice(0, 100);
      const em = parseEmoji(it.emoji);
      if (em) o.emoji = em;
      return o;
    }));
    return [new ActionRowBuilder().addComponents(menu)];
  }
  return [];
}

/** Posts the panel (or updates the posted message) and remembers its message ID. */
export async function publish(ctx, guildId, panelId) {
  const all = ctx.cfg(guildId);
  const cfg = all.reactionroles;
  const panel = cfg.panels.find((p) => p.id === panelId);
  if (!panel) throw new Error('Panel nicht gefunden.');
  const guild = ctx.client.guilds.cache.get(guildId);
  const ch = await ctx.channel(panel.channel);
  if (!ch?.isTextBased?.()) throw new Error('Bitte einen Textkanal wählen.');
  const body = buildMessage(panel.message, guildVars(guild), all) || { content: panel.name || 'Rollen' };
  body.components = components(panel);
  let msg = panel.messageId ? await ch.messages.fetch(panel.messageId).catch(() => null) : null;
  if (msg && msg.author.id === ctx.client.user.id) await msg.edit({ ...body, content: body.content ?? null });
  else msg = await ch.send(body);
  if (panel.type === 'reactions') {
    for (const it of panel.items) {
      const em = parseEmoji(it.emoji);
      if (em && it.role) await msg.react(em.id ? em.id : em.name).catch((e) => ctx.log.warn('Reaktion:', e.message));
    }
  }
  panel.messageId = msg.id;
  saveModule(guildId, 'reactionroles', cfg);
  return { messageId: msg.id, url: msg.url };
}

async function setRole(member, role, on) {
  if (!role || !member.guild.roles.cache.has(role)) return false;
  if (on && !member.roles.cache.has(role)) { await member.roles.add(role, 'Reaction Role'); return true; }
  if (!on && member.roles.cache.has(role)) { await member.roles.remove(role, 'Reaction Role'); return true; }
  return false;
}

async function onReaction(ctx, reaction, user, added) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);
  const guild = reaction.message.guild;
  if (!guild) return;
  const panel = ctx.cfg(guild.id).reactionroles.panels.find((p) => p.messageId === reaction.message.id && p.type === 'reactions');
  if (!panel) return;
  const key = emojiKey(reaction.emoji);
  const item = panel.items.find((it) => emojiKey(parseEmoji(it.emoji)) === key);
  if (!item) return;
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;
  try {
    if (added) {
      if (panel.mode === 'remove') return void await setRole(member, item.role, false);
      if (panel.mode === 'unique') {
        for (const it of panel.items) if (it !== item) await setRole(member, it.role, false);
        for (const r of reaction.message.reactions.cache.values()) {
          if (emojiKey(r.emoji) !== key) await r.users.remove(user.id).catch(() => {});
        }
      }
      await setRole(member, item.role, true);
    } else if (panel.mode === 'normal' || panel.mode === 'unique') {
      await setRole(member, item.role, false);
    }
  } catch (e) { ctx.log.warn('Reaction Role:', e.message); }
}

async function component(i, ctx) {
  const [, panelId, idx] = i.customId.split(':');
  const panel = ctx.cfg(i.guildId).reactionroles.panels.find((p) => p.id === panelId);
  if (!panel) return i.reply({ content: 'Dieses Panel gibt es nicht mehr.', flags: MessageFlags.Ephemeral });
  const member = i.member;
  const roles = panel.items.map((x) => x.role).filter(Boolean);
  const changes = [];
  try {
    if (i.isButton()) {
      const item = panel.items[Number(idx)];
      const has = member.roles.cache.has(item?.role);
      let on = !has;
      if (panel.mode === 'add' || panel.mode === 'verify') on = true;
      if (panel.mode === 'remove') on = false;
      if (on && panel.mode === 'unique') for (const r of roles) if (r !== item.role && await setRole(member, r, false)) changes.push(`➖ <@&${r}>`);
      if (await setRole(member, item.role, on)) changes.push(`${on ? '➕' : '➖'} <@&${item.role}>`);
    } else if (i.isStringSelectMenu()) {
      const want = new Set(i.values.map((v) => panel.items[Number(v)]?.role).filter(Boolean));
      for (const r of roles) {
        const on = want.has(r);
        if (panel.mode === 'add' && !on) continue;
        if (await setRole(member, r, on)) changes.push(`${on ? '➕' : '➖'} <@&${r}>`);
      }
    }
  } catch (e) {
    return i.reply({ content: `Das ging nicht: ${e.message}. Steht die Bot-Rolle über diesen Rollen?`, flags: MessageFlags.Ephemeral });
  }
  return i.reply({ content: changes.length ? changes.join('\n') : 'Nichts geändert.', flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}

function init(client, ctx) {
  client.on(Events.MessageReactionAdd, (r, u) => onReaction(ctx, r, u, true));
  client.on(Events.MessageReactionRemove, (r, u) => onReaction(ctx, r, u, false));
}

export default { name: 'reactionroles', prefix: 'rr', init, component, publish };
