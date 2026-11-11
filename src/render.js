import { EMBED } from './defaults.js';

/* Placeholders like {user} and turning a dashboard message into a Discord message. */

export function fill(str, vars = {}) {
  if (typeof str !== 'string' || !str) return '';
  return str.replace(/\{([\w.]+)\}/g, (m, k) => {
    const v = vars[k] ?? vars[k.toLowerCase()];
    return v === undefined || v === null ? m : String(v);
  });
}

export function userVars(user, member) {
  if (!user) return {};
  const name = member?.displayName || user.globalName || user.username;
  return {
    user: `<@${user.id}>`, 'user.mention': `<@${user.id}>`, 'user.name': name, 'user.username': user.username,
    'user.tag': user.tag || user.username, 'user.id': user.id,
    'user.avatar': (member || user).displayAvatarURL?.({ size: 256, extension: 'png' }) || '',
    'user.created': user.createdTimestamp ? `<t:${Math.floor(user.createdTimestamp / 1000)}:R>` : '',
    'user.joined': member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '',
  };
}

export function guildVars(guild) {
  if (!guild) return {};
  return {
    server: guild.name, 'server.name': guild.name, 'server.id': guild.id,
    'server.icon': guild.iconURL?.({ size: 256, extension: 'png' }) || '',
    members: guild.memberCount, 'server.members': guild.memberCount,
    boosts: guild.premiumSubscriptionCount || 0,
    date: new Date().toLocaleDateString('de-DE'), time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function colorInt(c) {
  if (typeof c === 'number') return c;
  const m = String(c || '').trim().match(/^#?([0-9a-f]{6})$/i);
  return m ? parseInt(m[1], 16) : null;
}

const url = (u) => (/^https?:\/\/\S+$/i.test(u || '') ? u : null);
const cut = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Combines an embed with its style profile and fills in the placeholders. */
export function buildEmbed(e, vars, profiles = [], fallbackProfile = '') {
  e = { ...EMBED(), ...(e || {}) };
  const p = profiles.find((x) => x.id === (e.profile || fallbackProfile)) || profiles.find((x) => x.id === fallbackProfile) || {};
  const f = (s) => fill(s, vars);
  const out = {};
  const color = colorInt(e.color) ?? colorInt(p.color);
  if (color !== null) out.color = color;
  const author = { name: f(e.author?.name || p.author?.name), icon_url: url(f(e.author?.icon || p.author?.icon)), url: url(f(e.author?.url || p.author?.url)) };
  if (author.name) out.author = { name: cut(author.name, 256), ...(author.icon_url ? { icon_url: author.icon_url } : {}), ...(author.url ? { url: author.url } : {}) };
  if (e.title) out.title = cut(f(e.title), 256);
  if (url(f(e.url))) out.url = url(f(e.url));
  if (e.description) out.description = cut(f(e.description), 4096);
  const fields = (e.fields || []).map((x) => ({ name: cut(f(x?.name), 256), value: cut(f(x?.value), 1024), inline: !!x?.inline }))
    .filter((x) => x.name && x.value).slice(0, 25);
  if (fields.length) out.fields = fields;
  const thumb = url(f(e.thumbnail || p.thumbnail));
  if (thumb) out.thumbnail = { url: thumb };
  const image = url(f(e.image || p.image));
  if (image) out.image = { url: image };
  const footer = { text: f(e.footer?.text || p.footer?.text), icon_url: url(f(e.footer?.icon || p.footer?.icon)) };
  if (footer.text) out.footer = { text: cut(footer.text, 2048), ...(footer.icon_url ? { icon_url: footer.icon_url } : {}) };
  if (e.timestamp || p.timestamp) out.timestamp = new Date().toISOString();
  const visible = out.title || out.description || out.fields || out.author || out.image || out.thumbnail || out.footer;
  return visible ? out : null;
}

/**
 * Turns a stored message ({ content, embed }) into options for channel.send().
 * `cfg` is the server config (for the style profiles). Returns null when there is nothing to send.
 */
export function buildMessage(msg, vars = {}, cfg = null) {
  if (!msg) return null;
  if (typeof msg === 'string') msg = { content: msg };
  const content = cut(fill(msg.content || '', vars), 2000);
  const embeds = [];
  if (msg.embed?.enabled) {
    const e = buildEmbed(msg.embed, vars, cfg?.embeds?.profiles || [], cfg?.general?.profile || '');
    if (e) embeds.push(e);
  }
  if (!content.trim() && !embeds.length) return null;
  return { content: content || undefined, embeds, allowedMentions: { parse: ['users', 'roles', 'everyone'] } };
}

/** A quick embed in the server's default style (answers of commands, logs). */
export function styled(cfg, { title, description, color, fields, footer, thumbnail } = {}) {
  const e = buildEmbed({
    enabled: true, title, description, color: color || '', fields: fields || [], thumbnail: thumbnail || '',
    footer: { text: footer || '', icon: '' },
  }, {}, cfg?.embeds?.profiles || [], cfg?.general?.profile || '');
  return e || { description: description || title || '-' };
}

/** Discord embed (from a message) back into the editor format. */
export function embedToEditor(e) {
  const hex = (n) => (typeof n === 'number' ? `#${n.toString(16).padStart(6, '0')}` : '');
  return {
    ...EMBED(), enabled: true, color: hex(e.color), title: e.title || '', url: e.url || '', description: e.description || '',
    author: { name: e.author?.name || '', icon: e.author?.iconURL || e.author?.icon_url || '', url: e.author?.url || '' },
    fields: (e.fields || []).map((x) => ({ name: x.name, value: x.value, inline: !!x.inline })),
    thumbnail: e.thumbnail?.url || '', image: e.image?.url || '',
    footer: { text: e.footer?.text || '', icon: e.footer?.iconURL || e.footer?.icon_url || '' }, timestamp: !!e.timestamp,
  };
}

export function duration(ms) {
  if (!ms || ms < 0) return '-';
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} Std.${m % 60 ? ` ${m % 60} Min.` : ''}`;
  return `${Math.floor(h / 24)} Tage`;
}

/** "10m", "2h", "1d 3h", "90" (minutes) -> milliseconds */
export function parseDuration(s) {
  s = String(s || '').trim().toLowerCase();
  if (/^\d+$/.test(s)) return Number(s) * 60000;
  let ms = 0;
  for (const [, n, u] of s.matchAll(/(\d+)\s*(s|sek|m|min|h|std|d|t|tag|tage|w)/g)) {
    ms += Number(n) * ({ s: 1e3, sek: 1e3, m: 6e4, min: 6e4, h: 36e5, std: 36e5, d: 864e5, t: 864e5, tag: 864e5, tage: 864e5, w: 6048e5 }[u]);
  }
  return ms;
}
