import { ChannelType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { guildData, saveData } from '../store.js';
import { buildMessage, colorInt, fill, guildVars } from '../render.js';
import { pingServer } from './mcping.js';

const live = new Map(); // guildId -> Map(serverId -> status)
const lastPoll = new Map(); // guildId -> time
const renamed = new Map(); // channelId -> { at, name }
const cache = new Map(); // edition:host:port -> { at, result } (servers shared by several Discord servers)

const DAY = 864e5;
const hist = (gid) => guildData(gid, 'minecraft', () => ({ servers: {}, statusMessage: null }));

export function statusOf(guildId) {
  if (!live.has(guildId)) live.set(guildId, new Map());
  return live.get(guildId);
}

async function cachedPing(s) {
  const key = `${s.edition}:${s.host}:${s.port || ''}`;
  const c = cache.get(key);
  if (c && Date.now() - c.at < 8000) return c.result;
  const result = await pingServer(s);
  cache.set(key, { at: Date.now(), result });
  return result;
}

function record(gid, id, on, players) {
  const d = hist(gid);
  const h = d.servers[id] || (d.servers[id] = { events: [], samples: [] });
  const last = h.events[h.events.length - 1];
  const changed = !last || last.on !== on;
  if (changed) h.events.push({ t: Date.now(), on });
  if (on) h.lastOnline = Date.now();
  const s = h.samples[h.samples.length - 1];
  if (!s || Date.now() - s.t >= 5 * 60_000 || changed) h.samples.push({ t: Date.now(), p: on ? players : -1 });
  const cut = Date.now() - 30 * DAY;
  while (h.events.length > 2 && h.events[1].t < cut) h.events.shift();
  const cutS = Date.now() - 7 * DAY;
  while (h.samples.length && h.samples[0].t < cutS) h.samples.shift();
  saveData(gid, 'minecraft');
  return { changed, first: !last };
}

function serverVars(s, st) {
  return {
    'server.name': s.name || s.host, 'server.emoji': s.emoji || '', 'server.address': s.hideAddress ? '' : `${s.host}${s.port ? `:${s.port}` : ''}`,
    'server.players': st?.players ?? 0, 'server.max': st?.max ?? 0, 'server.version': st?.version || '', 'server.motd': st?.motd || '',
    'server.ping': st?.ping ?? '', 'server.list': (st?.list || []).join(', '),
  };
}

/** The status embed with one field per server. */
export function statusEmbed(ctx, guildId, only = null) {
  const cfg = ctx.cfg(guildId).minecraft;
  const st = statusOf(guildId);
  const servers = cfg.servers.filter((s) => s.host && (!only || s.id === only));
  const o = cfg.status;
  const ons = servers.filter((s) => st.get(s.id)?.online).length;
  const color = colorInt(ons === servers.length && ons ? o.colorOnline : ons === 0 ? o.colorOffline : o.colorMixed);
  const h = hist(guildId).servers;
  const fields = servers.map((s) => {
    const x = st.get(s.id);
    const lines = [];
    if (!x) lines.push('⏳ wird geprüft …');
    else if (x.online) {
      let l = `🟢 **${o.onlineText}**`;
      if (o.showPlayers) l += ` · ${x.players}/${x.max} Spieler`;
      if (o.showPing) l += ` · ${x.ping} ms`;
      lines.push(l);
      if (o.showPlayerList && x.list?.length) lines.push(`👥 ${x.list.slice(0, 20).join(', ')}${x.players > x.list.length ? ' …' : ''}`);
      if (o.showVersion && x.version) lines.push(`📦 ${x.version}`);
      if (o.showMotd && x.motd) lines.push(`💬 ${x.motd.split('\n')[0].slice(0, 100)}`);
    } else {
      lines.push(`🔴 **${o.offlineText}**`);
    }
    if (o.showUptime && x) {
      const ev = h[s.id]?.events?.at(-1);
      if (ev) lines.push(x.online ? `⏱️ online seit <t:${Math.floor(ev.t / 1000)}:R>` : `⏱️ offline seit <t:${Math.floor(ev.t / 1000)}:R>`);
    }
    if (o.showAddress && !s.hideAddress) lines.push(`🌐 \`${s.host}${s.port ? `:${s.port}` : ''}\``);
    return { name: `${s.emoji ? `${s.emoji} ` : ''}${s.name || s.host}`.slice(0, 256), value: lines.join('\n').slice(0, 1024), inline: false };
  });
  const e = ctx.styled(guildId, {
    title: o.title || 'Minecraft', description: fill(o.description, { online: ons, total: servers.length }),
    fields: fields.length ? fields : [{ name: 'Keine Server', value: 'Im Panel unter Minecraft eintragen.' }],
    footer: fill(o.footer, { interval: cfg.interval, online: ons, total: servers.length }),
  });
  if (color !== null) e.color = color;
  e.timestamp = new Date().toISOString();
  return e;
}

async function updateStatusMessage(ctx, guildId) {
  const cfg = ctx.cfg(guildId).minecraft;
  const d = hist(guildId);
  if (!cfg.statusChannel) return;
  const ch = await ctx.channel(cfg.statusChannel);
  if (!ch?.isTextBased?.()) return;
  const embed = statusEmbed(ctx, guildId);
  const sig = JSON.stringify({ ...embed, timestamp: null });
  if (d.statusMessage?.channel === ch.id && d.statusMessage.sig === sig && Date.now() - (d.statusMessage.at || 0) < 10 * 60_000) return;
  let msg = d.statusMessage?.channel === ch.id ? await ch.messages.fetch(d.statusMessage.id).catch(() => null) : null;
  try {
    if (msg) await msg.edit({ embeds: [embed] });
    else msg = await ch.send({ embeds: [embed] });
    d.statusMessage = { channel: ch.id, id: msg.id, sig, at: Date.now() };
    saveData(guildId, 'minecraft');
  } catch (e) { ctx.log.warn('MC-Statusnachricht:', e.message); }
}

async function updateCounters(ctx, guildId) {
  const cfg = ctx.cfg(guildId).minecraft;
  for (const c of cfg.counters) {
    const s = cfg.servers.find((x) => x.id === c.server);
    if (!s || !c.channel) continue;
    const st = statusOf(guildId).get(s.id);
    if (!st) continue;
    const name = fill(st.online ? c.online : c.offline, serverVars(s, st)).slice(0, 100);
    const r = renamed.get(c.channel);
    if (!name || r?.name === name || (r && Date.now() - r.at < 5.5 * 60_000)) continue;
    const ch = await ctx.channel(c.channel);
    if (!ch || ch.name === name) { renamed.set(c.channel, { at: r?.at || 0, name }); continue; }
    renamed.set(c.channel, { at: Date.now(), name });
    await ch.setName(name, 'Minecraft-Status').catch((e) => ctx.log.warn('MC-Zähler:', e.message));
  }
}

async function announce(ctx, guildId, s, st, on) {
  const all = ctx.cfg(guildId);
  const cfg = all.minecraft;
  if (!cfg.announceChannel) return;
  const guild = ctx.client.guilds.cache.get(guildId);
  const msg = on ? cfg.announceOnline : cfg.announceOffline;
  const body = buildMessage(msg, { ...guildVars(guild), ...serverVars(s, st) }, all);
  if (!body) return;
  if (cfg.announceRole) body.content = `<@&${cfg.announceRole}> ${body.content || ''}`.trim();
  const ch = await ctx.channel(cfg.announceChannel);
  await ch?.send?.(body).catch((e) => ctx.log.warn('MC-Meldung:', e.message));
}

export async function pollGuild(ctx, guildId) {
  const cfg = ctx.cfg(guildId).minecraft;
  lastPoll.set(guildId, Date.now());
  const st = statusOf(guildId);
  const ids = new Set(cfg.servers.map((s) => s.id));
  for (const id of st.keys()) if (!ids.has(id)) st.delete(id);
  await Promise.all(cfg.servers.filter((s) => s.host).map(async (s) => {
    const r = await cachedPing(s);
    const prev = st.get(s.id);
    let x;
    if (r.online) x = { ...r, fails: 0, checkedAt: Date.now() };
    else {
      const fails = (prev?.fails || 0) + 1;
      // a short hiccup does not count as offline yet
      x = prev?.online && fails < cfg.offlineAfter ? { ...prev, fails, checkedAt: Date.now() } : { online: false, error: r.error, players: 0, max: prev?.max || 0, list: [], fails, checkedAt: Date.now() };
    }
    st.set(s.id, x);
    const { changed, first } = record(guildId, s.id, x.online, x.players);
    if (changed && !first) await announce(ctx, guildId, s, x, x.online);
  }));
  await updateStatusMessage(ctx, guildId);
  await updateCounters(ctx, guildId);
}

/** Data for the panel: live status plus history. */
export function overview(ctx, guildId) {
  const cfg = ctx.cfg(guildId).minecraft;
  const st = statusOf(guildId);
  const h = hist(guildId).servers;
  return cfg.servers.map((s) => {
    const x = st.get(s.id) || null;
    const hh = h[s.id] || { events: [], samples: [] };
    const weekAgo = Date.now() - 7 * DAY;
    // online share of the last 24 h and 7 days
    const uptime = (from) => {
      let on = 0; let state = null; let t = from;
      for (const e of hh.events) {
        if (e.t <= from) { state = e.on; continue; }
        if (state) on += e.t - t;
        state = e.on; t = e.t;
      }
      if (state) on += Date.now() - t;
      const span = Date.now() - Math.max(from, hh.events[0]?.t || Date.now());
      return span > 0 ? Math.round((on / span) * 1000) / 10 : null;
    };
    return {
      id: s.id, name: s.name || s.host, host: s.host, port: s.port, edition: s.edition, emoji: s.emoji,
      status: x && { online: x.online, players: x.players, max: x.max, list: x.list, version: x.version, motd: x.motd, ping: x.ping, favicon: x.favicon, error: x.error, checkedAt: x.checkedAt },
      events: hh.events.filter((e, n, a) => e.t >= weekAgo || a[n + 1]?.t >= weekAgo || n === a.length - 1),
      samples: hh.samples, lastOnline: hh.lastOnline || null, uptime24: uptime(Date.now() - DAY), uptime7: uptime(weekAgo),
    };
  });
}

const commands = [
  new SlashCommandBuilder().setName('mc').setDescription('Status der Minecraft-Server').setDMPermission(false)
    .addStringOption((o) => o.setName('server').setDescription('Welcher Server?').setAutocomplete(true)),
];

async function command(i, ctx) {
  const cfg = ctx.cfg(i.guildId).minecraft;
  if (!cfg.enabled || !cfg.servers.length) return i.reply({ content: 'Hier sind keine Minecraft-Server eingetragen (Panel: /aio).', flags: MessageFlags.Ephemeral });
  await i.deferReply();
  if (Date.now() - (lastPoll.get(i.guildId) || 0) > 20_000) await pollGuild(ctx, i.guildId);
  return i.editReply({ embeds: [statusEmbed(ctx, i.guildId, i.options.getString('server'))] });
}

async function autocomplete(i, ctx) {
  const q = String(i.options.getFocused() || '').toLowerCase();
  const list = ctx.cfg(i.guildId).minecraft.servers.filter((s) => (s.name || s.host).toLowerCase().includes(q)).slice(0, 25);
  await i.respond(list.map((s) => ({ name: (s.name || s.host).slice(0, 100), value: s.id })));
}

function ready(ctx) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      for (const g of ctx.client.guilds.cache.values()) {
        const cfg = ctx.cfg(g.id).minecraft;
        if (!cfg.enabled || !cfg.servers.length) continue;
        if (Date.now() - (lastPoll.get(g.id) || 0) < Math.max(20, cfg.interval) * 1000) continue;
        await pollGuild(ctx, g.id).catch((e) => ctx.log.warn('Minecraft:', e.message));
      }
    } finally { busy = false; }
  };
  setTimeout(tick, 3000);
  setInterval(tick, 10_000);
}

export const voiceTypes = [ChannelType.GuildVoice, ChannelType.GuildStageVoice];
export default { name: 'minecraft', commands, command, autocomplete, ready };
