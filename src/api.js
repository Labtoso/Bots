import http from 'node:http';
import { ChannelType } from 'discord.js';
import { config } from './config.js';
import { createToken, checkToken } from './auth.js';
import { log } from './log.js';
import { DEFAULTS, EMBED } from './defaults.js';
import { botData, guildConfig, guildData, saveBot, saveData, saveModule } from './store.js';
import { buildMessage, embedToEditor, guildVars, parseDuration, userVars } from './render.js';
import { levelData, levelOf, ranking, giveXp } from './modules/levels.js';
import moderation from './modules/moderation.js';
import { publish as publishRR } from './modules/reactionroles.js';
import { publishPanel as publishTickets, ticketData } from './modules/tickets.js';
import { overview as mcOverview, pollGuild } from './modules/minecraft.js';
import { pingServer } from './modules/mcping.js';
import { checkGuild, feedStatus, fetchFeed } from './modules/social.js';
import { endGiveaway, gwData, startGiveaway } from './modules/giveaways.js';
import { bdays } from './modules/birthdays.js';
import { refreshCounters } from './modules/extras.js';
import { isRightsUser, rightsData, saveRights } from './rights.js';
import { isPrankUser } from './pranks.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  [ChannelType.GuildText]: 'text', [ChannelType.GuildAnnouncement]: 'announcement', [ChannelType.GuildVoice]: 'voice',
  [ChannelType.GuildStageVoice]: 'stage', [ChannelType.GuildCategory]: 'category', [ChannelType.GuildForum]: 'forum',
};

class HttpError extends Error { constructor(code, msg, reason) { super(msg); this.code = code; this.reason = reason; } }
const fail = (code, msg, reason) => { throw new HttpError(code, msg, reason); };

/** REST API for the panel on bot.labtoso.de. */
export function createApi(bot) {
  const { ctx } = bot;
  const memberCache = new Map(); // guild:user -> { at, ok }

  function cors(req, res) {
    const origin = req.headers.origin;
    if (origin && (config.allowedOrigins.includes(origin) || config.allowedOrigins.includes('*'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
  }
  const send = (res, code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  async function readBody(req) {
    let data = '';
    for await (const chunk of req) {
      data += chunk;
      if (data.length > 3_000_000) fail(413, 'Zu groß');
    }
    try { return data ? JSON.parse(data) : {}; } catch { return fail(400, 'Ungültiges JSON'); }
  }

  const client = () => bot.client;
  const guildOf = (id) => client()?.guilds.cache.get(id) || fail(404, 'Der Bot ist nicht mehr auf diesem Server.');

  const seen = new Map(); // who used the panel lately

  async function allowed(session) {
    if (ctx.isOwner(session.u) || isRightsUser(session.u)) return true;
    const key = `${session.g}:${session.u}`;
    const c = memberCache.get(key);
    if (c && Date.now() - c.at < 60_000) return c.ok;
    const g = guildOf(session.g);
    const m = await g.members.fetch(session.u).catch(() => null);
    const ok = ctx.canManage(m);
    memberCache.set(key, { at: Date.now(), ok });
    return ok;
  }

  function activity(gid, session, action) {
    const d = guildData(gid, 'activity', () => ({ list: [] }));
    d.list.push({ t: Date.now(), user: session.u, name: session.n, avatar: session.a, action });
    if (d.list.length > 300) d.list.splice(0, d.list.length - 300);
    saveData(gid, 'activity');
  }

  function guildInfo(g) {
    const me = g.members.me;
    const channels = [...g.channels.cache.values()].filter((c) => TYPES[c.type])
      .sort((a, b) => (a.type === ChannelType.GuildCategory ? a.rawPosition : (a.parent?.rawPosition ?? -1)) - (b.type === ChannelType.GuildCategory ? b.rawPosition : (b.parent?.rawPosition ?? -1)) || a.rawPosition - b.rawPosition)
      .map((c) => ({ id: c.id, name: c.name, type: TYPES[c.type], parent: c.parentId || null, canPost: !!me && !!c.permissionsFor(me)?.has(['ViewChannel', 'SendMessages']) }));
    const top = me?.roles.highest.position ?? 0;
    const roles = [...g.roles.cache.values()].filter((r) => r.id !== g.id).sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.hexColor === '#000000' ? null : r.hexColor, managed: r.managed, assignable: !r.managed && r.position < top }));
    const emojis = [...g.emojis.cache.values()].map((e) => ({ id: e.id, name: e.name, animated: e.animated, text: e.toString(), url: e.imageURL({ size: 64 }) }));
    return { channels, roles, emojis };
  }

  /** Things to do after a module was saved. */
  async function afterSave(g, mod, value) {
    if (mod === 'general') {
      const me = g.members.me;
      if (me && (me.nickname || '') !== value.nickname) await me.setNickname(value.nickname || null).catch((e) => log.warn('Nickname:', e.message));
    }
    if (mod === 'customcmds') await ctx.registerGuildCommands(g.id);
    if (mod === 'minecraft' && value.enabled) pollGuild(ctx, g.id).catch(() => {});
    if (mod === 'counters') refreshCounters(ctx, g).catch(() => {});
    if (mod === 'social' && value.enabled) checkGuild(ctx, g.id).catch(() => {});
  }

  /* ---------- routes ---------- */
  const routes = [];
  const route = (method, pattern, fn, { owner = false, rights = false, prank = false } = {}) => {
    const keys = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
    routes.push({ method, re, keys, fn, owner, rights, prank });
  };

  route('GET', '/api/session', async ({ session, g }) => ({
    user: { id: session.u, name: session.n, avatar: session.a, owner: ctx.isOwner(session.u), rights: isRightsUser(session.u), prank: isPrankUser(session.u) },
    guild: { id: g.id, name: g.name, icon: g.iconURL({ size: 128, extension: 'png' }), members: g.memberCount },
    bot: { id: client().user.id, name: client().user.username, nickname: g.members.me?.nickname || '', avatar: client().user.displayAvatarURL({ size: 128, extension: 'png' }) },
    missingIntents: ctx.missingIntents, expires: session.exp, modules: Object.keys(DEFAULTS),
  }));
  route('GET', '/api/guild', ({ g }) => guildInfo(g));
  route('GET', '/api/config', ({ g }) => guildConfig(g.id));
  route('PUT', '/api/config/:mod', async ({ g, params, body, session }) => {
    if (!DEFAULTS[params.mod]) fail(404, 'Unbekanntes Modul');
    const saved = saveModule(g.id, params.mod, body);
    activity(g.id, session, `hat „${params.mod}“ gespeichert`);
    await afterSave(g, params.mod, saved);
    return saved;
  });

  route('GET', '/api/overview', ({ g }) => {
    const cfg = guildConfig(g.id);
    const cases = moderation.cases(g.id);
    return {
      members: g.memberCount, channels: g.channels.cache.size, roles: g.roles.cache.size - 1, boosts: g.premiumSubscriptionCount || 0,
      created: g.createdTimestamp, cases: cases.list.length, warns: cases.list.filter((c) => c.type === 'warn' && !c.removed).length,
      xpUsers: Object.keys(levelData(g.id).users).length, tickets: Object.keys(ticketData(g.id).open).length,
      giveaways: gwData(g.id).list.filter((x) => !x.ended).length,
      enabled: Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, cfg[k].enabled ?? null])),
      mc: mcOverview(ctx, g.id).map((s) => ({ name: s.name, emoji: s.emoji, online: s.status?.online ?? null, players: s.status?.players ?? 0, max: s.status?.max ?? 0 })),
      activity: guildData(g.id, 'activity', () => ({ list: [] })).list.slice(-15).reverse(),
    };
  });
  route('GET', '/api/activity', ({ g }) => guildData(g.id, 'activity', () => ({ list: [] })).list.slice().reverse());

  /* messages / embed editor */
  route('POST', '/api/message', async ({ g, body, session }) => {
    const ch = await ctx.channel(body.channel);
    if (!ch || ch.guildId !== g.id || !ch.isTextBased()) fail(400, 'Bitte einen Textkanal wählen.');
    const msg = buildMessage(body.message, { ...guildVars(g), ...userVars(await client().users.fetch(session.u).catch(() => null)) }, guildConfig(g.id));
    if (!msg) fail(400, 'Die Nachricht ist leer.');
    let sent;
    if (body.messageId) {
      const old = await ch.messages.fetch(body.messageId).catch(() => null);
      if (!old || old.author.id !== client().user.id) fail(404, 'Diese Nachricht kann der Bot nicht bearbeiten (nur eigene).');
      sent = await old.edit({ ...msg, content: msg.content ?? null });
    } else sent = await ch.send(msg);
    const d = guildData(g.id, 'sent', () => ({ list: [] }));
    d.list = d.list.filter((x) => x.id !== sent.id);
    d.list.push({ id: sent.id, channel: ch.id, name: body.name || (body.message?.embed?.enabled && body.message.embed.title) || (body.message?.content || '').slice(0, 60) || 'Nachricht', at: Date.now(), message: body.message });
    if (d.list.length > 100) d.list.shift();
    saveData(g.id, 'sent');
    activity(g.id, session, `hat eine Nachricht in #${ch.name} ${body.messageId ? 'bearbeitet' : 'gesendet'}`);
    return { id: sent.id, url: sent.url };
  });
  route('GET', '/api/sent', ({ g }) => guildData(g.id, 'sent', () => ({ list: [] })).list.slice().reverse());
  route('POST', '/api/message/load', async ({ g, body }) => {
    const m = String(body.link || '').match(/channels\/(\d+)\/(\d+)\/(\d+)/);
    if (!m || m[1] !== g.id) fail(400, 'Bitte einen Nachrichtenlink von diesem Server einfügen (Rechtsklick → Link kopieren).');
    const ch = await ctx.channel(m[2]);
    const msg = await ch?.messages.fetch(m[3]).catch(() => null);
    if (!msg) fail(404, 'Nachricht nicht gefunden.');
    return {
      channel: ch.id, messageId: msg.id, own: msg.author.id === client().user.id,
      message: { content: msg.content || '', embed: msg.embeds[0] ? embedToEditor(msg.embeds[0]) : EMBED() },
    };
  });

  route('POST', '/api/rr/:id/publish', async ({ g, params, session }) => { const r = await publishRR(ctx, g.id, params.id); activity(g.id, session, 'hat ein Rollen-Panel veröffentlicht'); return r; });
  route('POST', '/api/tickets/publish', async ({ g, session }) => { const r = await publishTickets(ctx, g.id); activity(g.id, session, 'hat das Ticket-Panel veröffentlicht'); return r; });
  route('GET', '/api/tickets', ({ g }) => Object.entries(ticketData(g.id).open).map(([channel, t]) => ({ channel, ...t, name: g.channels.cache.get(channel)?.name || null })));

  /* minecraft */
  route('GET', '/api/mc', ({ g }) => mcOverview(ctx, g.id));
  route('POST', '/api/mc/refresh', async ({ g }) => { await pollGuild(ctx, g.id); return mcOverview(ctx, g.id); });
  route('POST', '/api/mc/test', async ({ body }) => {
    if (!body.host) fail(400, 'Adresse fehlt.');
    return pingServer({ host: String(body.host), port: Number(body.port) || 0, edition: body.edition === 'bedrock' ? 'bedrock' : 'java' });
  });

  /* levels */
  route('GET', '/api/levels', ({ g, query }) => {
    const all = ranking(g.id);
    const page = Math.max(0, Number(query.get('page')) || 0);
    return {
      total: all.length,
      list: all.slice(page * 100, page * 100 + 100).map(([id, u], n) => {
        const m = g.members.cache.get(id);
        return { id, rank: page * 100 + n + 1, xp: u.xp, msgs: u.msgs || 0, ...levelOf(u.xp), name: m?.displayName || u.name || id, avatar: m?.displayAvatarURL({ size: 64, extension: 'png' }) || u.avatar || null };
      }),
    };
  });
  route('POST', '/api/levels/set', async ({ g, body, session }) => {
    const m = await g.members.fetch(String(body.user)).catch(() => null);
    if (!m) fail(404, 'Mitglied nicht gefunden.');
    const cur = levelData(g.id).users[m.id]?.xp || 0;
    await giveXp(ctx, g, m, Math.max(0, Number(body.xp) || 0) - cur, null);
    activity(g.id, session, `hat die XP von ${m.displayName} auf ${body.xp} gesetzt`);
    return { ok: true };
  });
  route('POST', '/api/levels/reset', ({ g, session, body }) => {
    if (body.confirm !== 'RESET') fail(400, 'Bitte bestätigen.');
    levelData(g.id).users = {};
    saveData(g.id, 'levels');
    activity(g.id, session, 'hat alle XP zurückgesetzt');
    return { ok: true };
  });
  route('GET', '/api/members', async ({ g, query }) => {
    const q = String(query.get('q') || '').trim();
    if (!q) return [];
    const found = /^\d{15,}$/.test(q) ? [await g.members.fetch(q).catch(() => null)].filter(Boolean) : [...(await g.members.fetch({ query: q, limit: 10 }).catch(() => new Map())).values()];
    return found.map((m) => ({ id: m.id, name: m.displayName, tag: m.user.tag, avatar: m.displayAvatarURL({ size: 64, extension: 'png' }) }));
  });

  /* moderation */
  route('GET', '/api/cases', ({ g }) => moderation.cases(g.id).list.slice(-300).reverse());
  route('POST', '/api/cases/:n/remove', ({ g, params, session }) => {
    const c = moderation.cases(g.id).list.find((x) => x.n === Number(params.n));
    if (!c) fail(404, 'Fall nicht gefunden.');
    c.removed = true;
    saveData(g.id, 'cases');
    activity(g.id, session, `hat Fall #${c.n} entfernt`);
    return c;
  });

  /* social */
  route('POST', '/api/social/test', async ({ body }) => {
    try {
      const r = await fetchFeed({ type: body.type, target: body.target }, {});
      return { ok: true, live: r.live ?? null, items: r.items.slice(0, 3) };
    } catch (e) { return { ok: false, error: e.message }; }
  });
  route('GET', '/api/social/status', ({ g }) => feedStatus(g.id));

  /* giveaways */
  route('GET', '/api/giveaways', ({ g }) => gwData(g.id).list.slice().reverse());
  route('POST', '/api/giveaways', async ({ g, body, session }) => {
    const gw = await startGiveaway(ctx, g.id, { ...body, ms: parseDuration(body.duration), winners: Number(body.winners) || 1, host: session.u });
    activity(g.id, session, `hat das Gewinnspiel „${gw.prize}“ gestartet`);
    return gw;
  });
  route('POST', '/api/giveaways/:id/end', ({ g, params }) => endGiveaway(ctx, g.id, params.id));
  route('POST', '/api/giveaways/:id/reroll', ({ g, params }) => endGiveaway(ctx, g.id, params.id, true));
  route('DELETE', '/api/giveaways/:id', ({ g, params }) => {
    const d = gwData(g.id);
    d.list = d.list.filter((x) => x.id !== params.id);
    saveData(g.id, 'giveaways');
    return { ok: true };
  });

  route('GET', '/api/birthdays', ({ g }) => Object.entries(bdays(g.id).users).map(([id, b]) => ({ id, ...b, name: g.members.cache.get(id)?.displayName || id })));

  /* pranks (one account only, everybody else gets 404) */
  route('GET', '/api/prank', async ({ g }) => ({
    catalog: ctx.pranks.catalog(g.id), durations: ctx.pranks.durations, active: await ctx.pranks.view(g.id), channels: ctx.pranks.channels(g.id),
    invite: `https://discord.com/oauth2/authorize?client_id=${client().user.id}&scope=bot+applications.commands&permissions=8`,
  }), { prank: true });
  route('GET', '/api/prank/members', ({ g, query }) => ctx.pranks.members(g.id, query.get('q') || ''), { prank: true });
  route('POST', '/api/prank/start', async ({ g, body }) => {
    try { return await ctx.pranks.start(g.id, body); } catch (e) { return fail(400, e.message); }
  }, { prank: true });
  route('POST', '/api/prank/stop', async ({ g, body }) => {
    if (body.all) await ctx.pranks.stopAll(g.id); else await ctx.pranks.stop(String(body.id || ''));
    return { active: await ctx.pranks.view(g.id) };
  }, { prank: true });

  /* tools for the bot owner: block people, who is online, status, logs, restart */
  route('GET', '/api/owner/tools', () => {
    const names = Object.fromEntries([...client().guilds.cache.values()].map((x) => [x.id, x.name]));
    const people = [...seen.values()].filter((v) => Date.now() - v.at < 15 * 60_000).sort((a, b) => b.at - a.at).map((v) => ({ ...v, guildName: names[v.guild] || v.guild }));
    let commit = null;
    try { commit = fs.readFileSync(path.join(ROOT, '.version'), 'utf8').trim(); } catch {
      try { commit = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim(); if (commit.startsWith('ref:')) commit = fs.readFileSync(path.join(ROOT, '.git', commit.slice(5).trim()), 'utf8').trim(); } catch { commit = null; }
    }
    return {
      people, blocked: botData().blocked || [],
      status: {
        servers: client().guilds.cache.size, members: [...client().guilds.cache.values()].reduce((n, x) => n + (x.memberCount || 0), 0),
        uptime: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1048576), node: process.version,
        platform: `${process.platform} ${process.arch}`, commit: commit ? commit.slice(0, 7) : null, intents: ctx.missingIntents.length ? `fehlen: ${ctx.missingIntents.join(', ')}` : 'alle da',
        pranks: ctx.pranks.list().length,
      },
    };
  }, { owner: true });
  route('GET', '/api/owner/logs', () => {
    let text = '';
    try { text = fs.readFileSync(path.join(ROOT, 'logs', 'aio.log'), 'utf8'); } catch { text = ''; }
    return { lines: text.split(/\r?\n/).filter(Boolean).slice(-300).map((l) => l.replace(/(SECRET|TOKEN)=\S+/gi, '$1=***')) };
  }, { owner: true });
  route('POST', '/api/owner/action', async ({ body, session }) => {
    const b = botData();
    const a = body.action;
    if (a === 'block' || a === 'unblock') {
      const value = String(body.value || '').trim().replace(/^<@!?(\d+)>$/, '$1').slice(0, 64);
      if (!value) fail(400, 'Name oder ID fehlt');
      if (ctx.owners.has(value)) fail(400, 'Dich selbst kannst du nicht sperren.');
      b.blocked = (b.blocked || []).filter((x) => x.toLowerCase() !== value.toLowerCase());
      if (a === 'block') b.blocked.push(value);
      saveBot();
      return { blocked: b.blocked };
    }
    if (a === 'revoke') { b.revokedAt = Date.now(); saveBot(); log.info(`Alle Panel-Links zurückgezogen von ${session.n}`); return { ok: true }; }
    if (a === 'stopPranks') { await ctx.pranks.stopAll(); return { ok: true }; }
    if (a === 'restart') {
      log.info('Neustart über das Panel');
      setTimeout(() => process.exit(0), 300); // systemd / AIO.cmd start it again
      return { ok: true };
    }
    return fail(400, 'Unbekannte Aktion');
  }, { owner: true });

  /* who may use which command (one account only) */
  route('GET', '/api/rights', async ({ g }) => {
    const rules = rightsData(g.id).commands;
    const users = {};
    for (const id of new Set(Object.values(rules).flatMap((r) => r.users))) {
      const m = g.members.cache.get(id) || await g.members.fetch(id).catch(() => null);
      const u = m?.user || await client().users.fetch(id).catch(() => null);
      users[id] = { name: m?.displayName || u?.globalName || u?.username || id, tag: u?.tag || '', avatar: (m || u)?.displayAvatarURL?.({ size: 64, extension: 'png' }) || null };
    }
    return { commands: ctx.commandList(g.id), rules, users };
  }, { rights: true });
  route('PUT', '/api/rights', async ({ g, body }) => {
    const known = new Set(ctx.commandList(g.id).map((c) => c.name));
    const d = saveRights(g.id, body.commands, known);
    await ctx.refreshCommands(g.id);
    return { rules: d.commands };
  }, { rights: true });

  /* bot profile and servers (owner only) */
  route('GET', '/api/bot', () => {
    const u = client().user;
    return { id: u.id, name: u.username, avatar: u.displayAvatarURL({ size: 256, extension: 'png' }), presence: { status: 'online', activities: [{ type: 'custom', text: '/aio' }], rotateSeconds: 60, ...botData().presence } };
  }, { owner: true });
  route('POST', '/api/bot/profile', async ({ body, session }) => {
    const u = client().user;
    try {
      if (body.name && body.name !== u.username) await u.setUsername(String(body.name).slice(0, 32));
      if (body.avatar) await u.setAvatar(String(body.avatar));
      if (body.banner) await u.setBanner(String(body.banner)).catch(() => {});
    } catch (e) {
      if (/rate|too fast|changing.*too/i.test(e.message)) fail(429, 'Discord erlaubt nur 2 Namensänderungen pro Stunde. Probier es später nochmal.');
      fail(400, e.message);
    }
    log.info(`Bot-Profil geändert von ${session.n}`);
    return { name: u.username, avatar: u.displayAvatarURL({ size: 256, extension: 'png' }) };
  }, { owner: true });
  route('PUT', '/api/bot/presence', ({ body }) => {
    const b = botData();
    b.presence = {
      status: ['online', 'idle', 'dnd', 'invisible'].includes(body.status) ? body.status : 'online',
      activities: (Array.isArray(body.activities) ? body.activities : []).slice(0, 20).map((a) => ({ type: String(a.type || 'custom'), text: String(a.text || '').slice(0, 128), url: String(a.url || '').slice(0, 300) })),
      rotateSeconds: Math.max(15, Number(body.rotateSeconds) || 60),
    };
    saveBot();
    ctx.applyPresence();
    return b.presence;
  }, { owner: true });
  route('GET', '/api/owner/servers', () => [...client().guilds.cache.values()].map((g) => ({
    id: g.id, name: g.name, icon: g.iconURL({ size: 64, extension: 'png' }), members: g.memberCount, joined: g.joinedTimestamp,
  })), { owner: true });
  route('POST', '/api/owner/open', ({ body, session }) => {
    const g = guildOf(String(body.guild));
    const token = createToken({ userId: session.u, guildId: g.id, userName: session.n, avatar: session.a });
    return { token };
  }, { owner: true });
  route('POST', '/api/owner/leave', async ({ body }) => { await guildOf(String(body.guild)).leave(); return { ok: true }; }, { owner: true });

  async function handle(req, res) {
    cors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    if (p === '/' || p === '/health') {
      return send(res, 200, { ok: true, name: 'aio', backend: config.backendName || bot.getName?.() || 'AIO', bot: bot.getName?.() || null, botId: client()?.user?.id || null, ready: !!client()?.isReady?.(), servers: client()?.guilds.cache.size || 0, time: Date.now() });
    }
    const r = routes.find((x) => x.method === req.method && x.re.test(p));
    if (!r) return send(res, 404, { error: 'Nicht gefunden' });
    try {
      const check = checkToken((req.headers.authorization || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('token'));
      const session = check.data;
      if (!session) {
        if (check.reason === 'expired') fail(401, `Link abgelaufen (galt bis ${new Date(check.exp).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' })}). Hol dir mit /aio einen neuen.`, 'expired');
        if (check.reason === 'missing') fail(401, 'Kein Panel-Link. Schreib /aio auf deinem Server.', 'missing');
        fail(401, 'Dieser Link gehört nicht zu diesem Backend (anderer Bot oder neu installiert). Hol dir mit /aio einen neuen Link.', 'invalid');
      }
      if (!client()?.isReady?.()) fail(503, 'Der Bot startet gerade, gleich nochmal versuchen.');
      if (r.owner && !ctx.isOwner(session.u)) fail(404, 'Nicht gefunden');
      if (r.rights && !isRightsUser(session.u)) fail(404, 'Nicht gefunden');
      if (r.prank && !isPrankUser(session.u)) fail(404, 'Nicht gefunden');
      if ((botData().revokedAt || 0) > session.exp - config.sessionHours * 3600_000 && !ctx.isOwner(session.u)) fail(401, 'Dieser Link wurde zurückgezogen. Hol dir mit /aio einen neuen.', 'revoked');
      if (ctx.isBlocked(session.u, session.n)) fail(403, 'Du bist für dieses Panel gesperrt.');
      seen.set(`${session.u}|${session.g}`, { id: session.u, name: session.n, avatar: session.a, guild: session.g, at: Date.now() });
      const g = guildOf(session.g);
      if (!await allowed(session)) fail(403, 'Du hast auf diesem Server keinen Zugriff mehr aufs Panel.');
      const m = p.match(r.re);
      const params = Object.fromEntries(r.keys.map((k, n) => [k, decodeURIComponent(m[n + 1])]));
      const body = ['POST', 'PUT'].includes(req.method) ? await readBody(req) : {};
      const out = await r.fn({ session, g, params, body, query: url.searchParams, req });
      return send(res, 200, out ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.code, { error: e.message, ...(e.reason ? { reason: e.reason } : {}) });
      log.warn(`API ${req.method} ${p}:`, e.message);
      return send(res, 500, { error: e.message || 'Fehler' });
    }
  }

  return http.createServer((req, res) => {
    handle(req, res).catch((e) => { log.error('API:', e.stack || e.message); if (!res.headersSent) send(res, 500, { error: 'Interner Fehler' }); });
  });
}
