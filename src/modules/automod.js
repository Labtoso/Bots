import { Events, PermissionFlagsBits } from 'discord.js';
import { punish } from './moderation.js';
import { fill } from '../render.js';

const recent = new Map(); // guild:user -> [{ t, c }]
const strikes = new Map(); // guild:user -> [t]

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regexCache = new Map();
function wordRegex(words, wildcard) {
  const key = `${wildcard}|${words.join('\u0000')}`;
  if (regexCache.has(key)) return regexCache.get(key);
  const parts = words.map((w) => String(w).trim().toLowerCase()).filter(Boolean)
    .map((w) => esc(w).replace(/\\\*/g, '\\S*'));
  const re = parts.length ? new RegExp(wildcard ? `(${parts.join('|')})` : `(?<![\\p{L}\\d])(${parts.join('|')})(?![\\p{L}\\d])`, 'iu') : null;
  if (regexCache.size > 500) regexCache.clear();
  regexCache.set(key, re);
  return re;
}

// common replacements people use to dodge word filters
const normalize = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[@4]/g, 'a').replace(/3/g, 'e').replace(/[1!|]/g, 'i').replace(/0/g, 'o').replace(/\$|5/g, 's').replace(/7/g, 't');

const INVITE = /(discord\.gg|discord(app)?\.com\/invite|dsc\.gg|invite\.gg)\/[\w-]+/i;
const URL_RE = /https?:\/\/([^\s/<>]+)/gi;
const EMOJI = /(<a?:\w+:\d+>|\p{Extended_Pictographic})/gu;

/** Returns [ruleName, readable reason] of the first rule this message breaks, or null. */
export function check(cfg, content, { mentions = 0, history = [] } = {}) {
  const r = cfg;
  if (r.badwords.on && r.badwords.words.length) {
    const re = wordRegex(r.badwords.words, r.badwords.wildcard);
    if (re && (re.test(content) || re.test(normalize(content)))) return ['badwords', 'verbotenes Wort'];
  }
  if (r.invites.on && INVITE.test(content)) return ['invites', 'Einladungslinks sind nicht erlaubt'];
  if (r.links.on) {
    for (const [, host] of content.matchAll(URL_RE)) {
      const h = host.toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '');
      if (!r.links.allow.some((a) => h === String(a).toLowerCase() || h.endsWith(`.${String(a).toLowerCase()}`))) return ['links', 'Links sind hier nicht erlaubt'];
    }
  }
  if (r.caps.on) {
    const letters = content.replace(/<[^>]+>/g, '').match(/\p{L}/gu) || [];
    if (letters.length >= r.caps.min) {
      const up = letters.filter((c) => c !== c.toLowerCase()).length;
      if ((up / letters.length) * 100 >= r.caps.percent) return ['caps', 'zu viele Großbuchstaben'];
    }
  }
  if (r.mentions.on && mentions > r.mentions.max) return ['mentions', 'zu viele Erwähnungen'];
  if (r.emojis.on && (content.match(EMOJI) || []).length > r.emojis.max) return ['emojis', 'zu viele Emojis'];
  if (r.newlines.on && content.split('\n').length - 1 > r.newlines.max) return ['newlines', 'zu viele Zeilen'];
  if (r.zalgo.on && /[̀-ͯ҉]{4,}/.test(content)) return ['zalgo', 'Zalgo-Text'];
  const now = Date.now();
  if (r.spam.on && history.filter((h) => now - h.t <= r.spam.seconds * 1000).length >= r.spam.count) return ['spam', 'Spam'];
  if (r.duplicates.on && content.length > 0) {
    const same = history.filter((h) => now - h.t < 60_000 && h.c === content).length;
    if (same >= r.duplicates.count - 1) return ['duplicates', 'gleiche Nachricht wiederholt'];
  }
  return null;
}

async function onMessage(ctx, msg) {
  if (!msg.guild || msg.author?.bot || msg.webhookId) return;
  const cfg = ctx.cfg(msg.guild.id).automod;
  if (!cfg.enabled) return;
  if (cfg.exemptChannels.includes(msg.channelId) || cfg.exemptChannels.includes(msg.channel?.parentId)) return;
  const member = msg.member || await msg.guild.members.fetch(msg.author.id).catch(() => null);
  if (!member || member.permissions.has(PermissionFlagsBits.ManageMessages) || ctx.isOwner(member.id)) return;
  if (cfg.exemptRoles.some((r) => member.roles.cache.has(r))) return;

  const key = `${msg.guild.id}:${msg.author.id}`;
  const history = (recent.get(key) || []).filter((h) => Date.now() - h.t < 60_000);
  const content = msg.content || '';
  const hit = check(cfg, content, { mentions: msg.mentions.users.size + msg.mentions.roles.size + (msg.mentions.everyone ? 5 : 0), history });
  history.push({ t: Date.now(), c: content });
  recent.set(key, history.slice(-20));
  if (!hit) return;

  const [rule, reason] = hit;
  const rc = cfg[rule];
  await msg.delete().catch(() => {});
  if (rule === 'spam') { // clean up the burst as well
    const mine = (await msg.channel.messages.fetch({ limit: 30 }).catch(() => new Map())).filter((m) => m.author.id === msg.author.id && Date.now() - m.createdTimestamp < 30_000);
    if (mine.size) await msg.channel.bulkDelete(mine, true).catch(() => {});
  }
  if (cfg.notify) {
    const note = await msg.channel.send({ content: fill(cfg.notify, { user: `<@${msg.author.id}>`, 'user.name': member.displayName, reason }), allowedMentions: { users: [msg.author.id] } }).catch(() => null);
    if (note) setTimeout(() => note.delete().catch(() => {}), Math.max(2, cfg.notifySeconds) * 1000);
  }
  const action = rc.action === 'delete' ? null : rc.action;
  if (action) {
    await punish(ctx, msg.guild, { type: action === 'ban' && rc.minutes ? 'tempban' : action, target: msg.author, member, mod: null, reason: `Auto-Mod: ${reason}`, ms: (rc.minutes || 0) * 60000 })
      .catch((e) => ctx.log.warn('Auto-Mod Strafe:', e.message));
  }
  await ctx.logTo(msg.guild.id, cfg.logChannel, {
    title: 'Auto-Mod', color: '#f97316',
    fields: [
      { name: 'Mitglied', value: `<@${msg.author.id}> (${msg.author.tag})`, inline: true },
      { name: 'Kanal', value: `<#${msg.channelId}>`, inline: true },
      { name: 'Regel', value: `${reason}${action ? ` → ${action}` : ''}`, inline: true },
      { name: 'Nachricht', value: (content || '(leer)').slice(0, 1000) },
    ],
  });
  if (cfg.strikes.on) {
    const list = (strikes.get(key) || []).filter((t) => Date.now() - t < cfg.strikes.hours * 3600_000);
    list.push(Date.now());
    strikes.set(key, list);
    if (list.length >= cfg.strikes.count) {
      strikes.delete(key);
      await punish(ctx, msg.guild, { type: cfg.strikes.action, target: msg.author, member, mod: null, reason: `Auto-Mod: ${list.length} Verstöße`, ms: cfg.strikes.minutes * 60000 })
        .catch((e) => ctx.log.warn('Auto-Mod Verstöße:', e.message));
    }
  }
}

function init(client, ctx) {
  client.on(Events.MessageCreate, (m) => onMessage(ctx, m).catch((e) => ctx.log.warn('Auto-Mod:', e.message)));
  client.on(Events.MessageUpdate, (o, m) => {
    if (m.partial || o.content === m.content) return;
    onMessage(ctx, m).catch(() => {});
  });
  setInterval(() => { for (const [k, v] of recent) if (!v.length || Date.now() - v[v.length - 1].t > 120_000) recent.delete(k); }, 300_000);
}

export default { name: 'automod', init };
