import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, config } from './config.js';
import { bins } from './binaries.js';
import { createToken, verifyToken } from './auth.js';
import { log } from './log.js';
import { resolve, searchAll } from './resolve.js';
import { settings } from './settings.js';
import { playlists } from './playlists.js';
import { spotifyReady, spotifySearch } from './spotify.js';

/**
 * REST + Server-Sent-Events API used by the dashboard on GitHub Pages.
 * `bot` provides: getPlayer(guildId), getGuildInfo(guildId), getMember(guildId, userId)
 */
export function createApi(bot) {
  const streams = new Map(); // guildId -> Set(res)
  const hooked = new Set();

  function hook(guildId) {
    if (hooked.has(guildId)) return;
    hooked.add(guildId);
    bot.getPlayer(guildId).on('update', (state) => {
      const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
      for (const res of streams.get(guildId) || []) res.write(payload);
    });
  }

  function cors(req, res) {
    const origin = req.headers.origin;
    if (origin && (config.allowedOrigins.includes(origin) || config.allowedOrigins.includes('*'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Msik-Name');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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
      if (data.length > 64_000) throw new Error('Body zu groß');
    }
    return data ? JSON.parse(data) : {};
  }

  const errors = {
    NOT_IN_VOICE: [409, 'Geh zuerst in einen Sprachkanal oder wähl im Dashboard einen Kanal aus.'],
    SPOTIFY_NOT_SET: [400, 'Spotify-Suche ist auf diesem Bot nicht eingerichtet (SPOTIFY_CLIENT_SECRET in .env). Stell in den Einstellungen auf YouTube.'],
    SPOTIFY_BAD_KEYS: [400, 'Spotify-Schlüssel ungültig. SPOTIFY_CLIENT_SECRET in .env prüfen.'],
    PLAYLIST_GONE: [404, 'Diese Playlist gibt es nicht mehr.'],
    NO_CHANNEL: [400, 'Kein Kanal gewählt.'],
    CHANNEL_GONE: [404, 'Diesen Sprachkanal gibt es nicht mehr.'],
    NO_VOICE_PERMS: [403, 'Der Bot darf in diesem Kanal nicht verbinden oder sprechen.'],
  };

  async function handle(req, res) {
    cors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    if (p === '/' || p === '/health') {
      return send(res, 200, {
        ok: true, name: 'msik', backend: config.backendName || bot.getName?.() || 'Msik', bot: bot.getName?.() || null,
        active: bot.activeCount?.() || 0, spotify: spotifyReady(),
      });
    }

    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('token');
    const session = verifyToken(token);
    if (!session) return send(res, 401, { error: 'Sitzung abgelaufen. Hol dir mit /web einen neuen Link.' });
    const guildId = session.g;
    if (session.s && (session.e || 0) !== settings.get(guildId).guestEpoch) {
      return send(res, 401, { error: 'Dieser geteilte Link wurde zurückgezogen. Hol dir einen neuen.' });
    }
    const isOwner = !session.s && String(session.u) === String(config.ownerId);
    // people who opened a shared link name themselves in the dashboard
    const guestName = String(req.headers['x-msik-name'] || url.searchParams.get('name') || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 32);
    const who = session.s
      ? { name: guestName || 'Gast', avatar: null, guest: true }
      : { name: session.n, avatar: session.a };
    if (!isOwner && settings.isBlocked(session.s ? null : session.u, who.name)) {
      return send(res, 403, { error: 'Du bist für dieses Dashboard gesperrt.' });
    }
    if (isOwner && settings.global().hidden) who.hidden = true;
    const player = bot.getPlayer(guildId);
    hook(guildId);

    if (p === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive', 'X-Accel-Buffering': 'no',
      });
      res.write(`retry: 3000\nevent: state\ndata: ${JSON.stringify(player.state())}\n\n`);
      if (!streams.has(guildId)) streams.set(guildId, new Set());
      streams.get(guildId).add(res);
      res.viewer = { id: session.s ? null : String(session.u), name: who.name, avatar: who.avatar || null, guest: !!session.s, self: isOwner, since: Date.now() };
      const ping = setInterval(() => res.write(`event: tick\ndata: ${JSON.stringify({ position: player.state().position, paused: player.paused, loading: player.loading, rev: player.rev })}\n\n`), 1000);
      req.on('close', () => { clearInterval(ping); streams.get(guildId)?.delete(res); });
      return undefined;
    }

    if (p === '/api/session' && req.method === 'GET') {
      return send(res, 200, {
        user: { id: session.u, name: who.name, avatar: who.avatar, guest: !!session.s, ...(isOwner ? { ctl: true } : {}) },
        guild: await bot.getGuildInfo(guildId),
        expires: session.exp,
        state: player.state(),
      });
    }

    if (p === '/api/state' && req.method === 'GET') return send(res, 200, player.state());

    if (p === '/api/share' && req.method === 'POST') {
      // a link others can open without /web; it is bound to this server and expires like any link
      const token = createToken({ userId: 'guest', guildId, userName: '', guest: true, epoch: settings.get(guildId).guestEpoch });
      return send(res, 200, { token, expires: verifyToken(token).exp });
    }

    if (p === '/api/channels' && req.method === 'GET') {
      const [channels, text, member] = await Promise.all([
        bot.getVoiceChannels(guildId), bot.getTextChannels(guildId), bot.getMember(guildId, session.u),
      ]);
      const st = settings.get(guildId);
      return send(res, 200, {
        channels, text, selected: st.channelId, mine: member.voiceChannelId,
        npEnabled: st.npEnabled, npChannelId: st.npChannelId, webChannelId: st.webChannelId,
      });
    }

    /* ---------- owner tools (checked here on the server, unknown to everyone else) ---------- */
    if (p.startsWith('/api/ctl/')) {
      if (!isOwner) return send(res, 404, { error: 'Nicht gefunden' });
      if (p === '/api/ctl/people' && req.method === 'GET') {
        const names = Object.fromEntries((bot.getStats().guilds || []).map((g) => [g.id, g.name]));
        const people = [];
        for (const [gid, set] of streams) {
          const seen = new Set();
          for (const r of set) {
            const v = r.viewer;
            if (!v) continue;
            const k = `${v.id || ''}|${v.name}`;
            if (seen.has(k)) continue;
            seen.add(k);
            people.push({ ...v, guildId: gid, guild: names[gid] || null });
          }
        }
        const g = settings.global();
        const counts = {};
        for (const v of people) counts[v.guildId] = (counts[v.guildId] || 0) + 1;
        const guilds = (bot.getStats().guilds || []).map((gu) => ({
          id: gu.id, name: gu.name, members: gu.members, playing: gu.playing, channel: gu.channel, queue: gu.queue, viewers: counts[gu.id] || 0,
        }));
        return send(res, 200, { people, guilds, blocked: g.blocked, hidden: !!g.hidden });
      }
      if (p === '/api/ctl/open' && req.method === 'POST') {
        // the owner opens any server's panel on this bot without needing someone's link
        const body0 = await readBody(req);
        const gid = String(body0.guildId || '').trim();
        if (!gid) return send(res, 400, { error: 'Server fehlt' });
        const token = createToken({ userId: session.u, guildId: gid, userName: session.n, avatar: session.a });
        return send(res, 200, { token });
      }
      if (p === '/api/ctl/status' && req.method === 'GET') {
        const ver = spawnSync(bins.ytdlp, ['--version'], { encoding: 'utf8', timeout: 15_000, windowsHide: true }).stdout?.trim() || null;
        let commit = null;
        try { commit = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim(); if (commit.startsWith('ref:')) commit = fs.readFileSync(path.join(ROOT, '.git', commit.slice(5).trim()), 'utf8').trim(); } catch { /* zip install */ }
        return send(res, 200, {
          ...bot.getStats(), uptime: Math.round(process.uptime()), memoryMb: Math.round(process.memoryUsage().rss / 1048576),
          node: process.version, ytdlp: ver, platform: `${process.platform} ${process.arch}`, commit: commit ? commit.slice(0, 7) : null,
          spotify: spotifyReady(),
        });
      }
      if (p === '/api/ctl/logs' && req.method === 'GET') {
        let text = '';
        try { text = fs.readFileSync(path.join(ROOT, 'logs', 'msik.log'), 'utf8'); } catch { text = ''; }
        const lines = text.split(/\r?\n/).filter(Boolean).slice(-300)
          .map((l) => l.replace(/(SECRET|TOKEN)=\S+/gi, '$1=***'));
        return send(res, 200, { lines });
      }
      if (p === '/api/ctl/action' && req.method === 'POST') {
        const body0 = await readBody(req);
        const a = body0.action;
        if (a === 'stopAll') { bot.stopAll(); return send(res, 200, { ok: true }); }
        if (a === 'hidden') { settings.setGlobal({ hidden: !!body0.on }); return send(res, 200, { ok: true, hidden: !!body0.on }); }
        if (a === 'block' || a === 'unblock') {
          const value = String(body0.value || '').trim().replace(/^<@!?(\d+)>$/, '$1').slice(0, 64);
          if (!value) return send(res, 400, { error: 'Name oder ID fehlt' });
          if (value === String(config.ownerId)) return send(res, 400, { error: 'Dich selbst kannst du nicht sperren.' });
          const blocked = settings.global().blocked.filter((b) => b.toLowerCase() !== value.toLowerCase());
          if (a === 'block') {
            blocked.push(value);
            // throw them out right away
            for (const set of streams.values()) {
              for (const r of set) {
                const v = r.viewer;
                if (v && !v.self && (v.id === value || v.name.toLowerCase() === value.toLowerCase())) { set.delete(r); r.end(); }
              }
            }
          }
          settings.setGlobal({ blocked });
          return send(res, 200, { ok: true, blocked });
        }
        if (a === 'revokeGuests') {
          settings.set(guildId, { guestEpoch: settings.get(guildId).guestEpoch + 1 });
          return send(res, 200, { ok: true });
        }
        if (a === 'ytdlp') {
          const r = spawnSync(bins.ytdlp, ['-U'], { encoding: 'utf8', timeout: 120_000, windowsHide: true });
          return send(res, 200, { ok: r.status === 0, output: `${r.stdout || ''}${r.stderr || ''}`.trim().split(/\r?\n/).slice(-5).join('\n') });
        }
        if (a === 'restart') {
          send(res, 200, { ok: true });
          log.info('Neustart über das Dashboard');
          setTimeout(() => process.exit(0), 300); // start.bat / Msik.cmd / systemd start it again
          return undefined;
        }
        return send(res, 400, { error: 'Unbekannte Aktion' });
      }
      return send(res, 404, { error: 'Nicht gefunden' });
    }

    if (p === '/api/search' && req.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return send(res, 200, { results: [] });
      if (/^https?:\/\//i.test(q)) {
        const r = await resolve(q);
        return send(res, 200, { results: r.tracks.slice(0, 50), playlist: r.playlist, total: r.tracks.length });
      }
      const spotify = url.searchParams.get('source') === 'spotify';
      const r = spotify ? await spotifySearch(q) : await searchAll(q, 8);
      // Spotify hits play through YouTube: look up the first matches now, so + starts sooner
      if (spotify) r.tracks.slice(0, 4).forEach((t) => searchAll(t.query, 1).catch(() => {}));
      return send(res, 200, { results: r.tracks, playlists: r.playlists });
    }

    if (p === '/api/playlists' && req.method === 'GET') return send(res, 200, { playlists: playlists.list(guildId) });
    const pm = p.match(/^\/api\/playlists\/([\w-]+)(?:\/(tracks|play)(?:\/([\w-]+))?)?$/);
    if (pm && !pm[2] && req.method === 'GET') return send(res, 200, playlists.get(guildId, pm[1]));

    if (req.method !== 'POST' && req.method !== 'DELETE' && req.method !== 'PATCH') return send(res, 404, { error: 'Nicht gefunden' });
    const body = req.method === 'DELETE' ? {} : await readBody(req);

    /* ---------- saved playlists ---------- */
    if (p === '/api/playlists' && req.method === 'POST') {
      const name = String(body.name || '').trim();
      if (!name) return send(res, 400, { error: 'Name fehlt' });
      const pl = playlists.create(guildId, name, who.name);
      if (Array.isArray(body.tracks)) playlists.addTracks(guildId, pl.id, body.tracks.map(sanitizeTrack).filter(Boolean));
      player.logActivity(who, 'plCreate', pl.name);
      return send(res, 200, { playlist: playlists.get(guildId, pl.id), playlists: playlists.list(guildId) });
    }
    if (pm) {
      const [, pid, sub, tid] = pm;
      if (!sub && req.method === 'DELETE') {
        const name = playlists.get(guildId, pid).name;
        playlists.remove(guildId, pid);
        player.logActivity(who, 'plDelete', name);
        return send(res, 200, { playlists: playlists.list(guildId) });
      }
      if (!sub && req.method === 'PATCH') {
        if (body.name) playlists.rename(guildId, pid, String(body.name).trim() || 'Playlist');
        if (body.move) playlists.moveTrack(guildId, pid, body.move.id, body.move.to);
        return send(res, 200, { playlist: playlists.get(guildId, pid), playlists: playlists.list(guildId) });
      }
      if (sub === 'tracks' && req.method === 'POST') {
        let tracks;
        if (Array.isArray(body.tracks)) tracks = body.tracks.slice(0, 500).map(sanitizeTrack).filter(Boolean);
        else tracks = (await resolve(body.query)).tracks;
        const added = playlists.addTracks(guildId, pid, tracks);
        const pl = playlists.get(guildId, pid);
        player.logActivity(who, 'plAdd', `${added === 1 ? tracks[0].title : added}|${pl.name}`);
        return send(res, 200, { added, playlist: pl, playlists: playlists.list(guildId) });
      }
      if (sub === 'tracks' && tid && req.method === 'DELETE') {
        const pl = playlists.removeTrack(guildId, pid, tid);
        return send(res, 200, { playlist: pl, playlists: playlists.list(guildId) });
      }
      if (sub === 'play' && req.method === 'POST') {
        const pl = playlists.get(guildId, pid);
        if (!pl.tracks.length) return send(res, 400, { error: 'Die Playlist ist leer.' });
        const member = await bot.getMember(guildId, session.u);
        player.startVoice(member, settings.get(guildId).channelId);
        let tracks = pl.tracks.map((t) => ({ ...t, id: Math.random().toString(16).slice(2, 14), requester: who.hidden ? '' : who.name }));
        if (body.shuffle) tracks = tracks.sort(() => Math.random() - 0.5);
        if (body.replace) player.clear();
        const added = await player.add(tracks, { now: !!body.replace });
        player.logActivity(who, 'plPlay', pl.name);
        return send(res, 200, { added, state: player.state() });
      }
    }

    if (p === '/api/queue' && req.method === 'POST') {
      const member = await bot.getMember(guildId, session.u);
      player.startVoice(member, settings.get(guildId).channelId); // join while the songs are looked up
      let tracks;
      let playlist = null;
      if (Array.isArray(body.tracks) && body.tracks.length) {
        tracks = body.tracks.slice(0, config.maxQueue).map(sanitizeTrack).filter(Boolean);
      } else {
        const r = await resolve(body.query);
        tracks = r.tracks;
        playlist = r.playlist;
      }
      tracks.forEach((t) => { t.requester = who.hidden ? '' : who.name; });
      const added = await player.add(tracks, { next: !!body.next, now: !!body.now });
      if (added) player.logActivity(who, body.now ? 'playNow' : body.next ? 'addNext' : 'add', playlist || (added === 1 ? tracks[0].title : `${added}`));
      return send(res, 200, { added, playlist, state: player.state() });
    }

    if (p === '/api/settings' && req.method === 'POST') {
      const idOrNull = (v) => (typeof v === 'string' && /^[\w-]{1,32}$/.test(v) ? v : null);
      const patch = {};
      if ('channelId' in body) patch.channelId = idOrNull(body.channelId);
      // server-wide options: not for people on a shared link
      if (!session.s) {
        if ('npEnabled' in body) patch.npEnabled = !!body.npEnabled;
        if ('npChannelId' in body) patch.npChannelId = idOrNull(body.npChannelId);
        if ('webChannelId' in body) patch.webChannelId = idOrNull(body.webChannelId);
      } else if (['npEnabled', 'npChannelId', 'webChannelId'].some((k) => k in body)) {
        return send(res, 403, { error: 'Das darf nur, wer /web selbst benutzt hat.' });
      }
      const saved = settings.set(guildId, patch);
      if ('channelId' in patch) {
        if (patch.channelId && body.join) await player.moveTo(patch.channelId);
        player.logActivity(who, 'channel', patch.channelId ? player.channel?.name || patch.channelId : null);
      }
      return send(res, 200, { settings: saved, state: player.state() });
    }

    const qm = p.match(/^\/api\/queue\/([\w-]+)$/);
    if (qm && req.method === 'DELETE') {
      const tr = player.queue.find((x) => x.id === qm[1]);
      player.remove(qm[1]);
      if (tr) player.logActivity(who, 'remove', tr.title);
      return send(res, 200, { ok: true });
    }

    if (p === '/api/control' && req.method === 'POST') {
      const { action, value } = body;
      const actions = {
        toggle: () => player.toggle(),
        pause: () => player.pause(),
        resume: () => player.resume(),
        skip: () => player.skip(),
        previous: () => player.previous(),
        stop: () => player.stop(),
        leave: () => player.leave(),
        seek: () => player.seek(value),
        volume: () => player.setVolume(value),
        loop: () => player.setLoop(value),
        filter: () => player.setFilter(value),
        autoplay: () => player.setAutoplay(value),
        shuffle: () => player.shuffle(),
        clear: () => player.clear(),
        move: () => player.move(value?.id, value?.to),
        jump: () => player.jump(value),
        remove: () => player.remove(value),
        join: async () => (value ? player.moveTo(String(value)) : player.ensureVoice(await bot.getMember(guildId, session.u), settings.get(guildId).channelId)),
      };
      if (!actions[action]) return send(res, 400, { error: 'Unbekannte Aktion' });
      const byId = (id) => player.queue.find((x) => x.id === id)?.title || null;
      const detail = {
        jump: () => byId(value), remove: () => byId(value), move: () => byId(value?.id),
        volume: () => Math.round(Number(value) || 0), filter: () => value, loop: () => null,
        seek: () => Math.round(Number(value) || 0), autoplay: () => !!value,
        skip: () => player.current?.title || null,
      }[action]?.() ?? null;
      const wasPaused = player.paused;
      await actions[action]();
      if (action === 'loop') player.logActivity(who, 'loop', player.loop);
      else if (action === 'toggle') player.logActivity(who, wasPaused ? 'resume' : 'pause');
      else if (action !== 'join') player.logActivity(who, action, detail);
      return send(res, 200, player.state());
    }

    return send(res, 404, { error: 'Nicht gefunden' });
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      const known = errors[err.message];
      if (!known) log.warn('API:', err.message);
      if (!res.headersSent) send(res, known ? known[0] : 500, { error: known ? known[1] : err.message });
    });
  });
  return server;
}

function sanitizeTrack(t) {
  if (!t || typeof t !== 'object') return null;
  const str = (v, n = 500) => (typeof v === 'string' ? v.slice(0, n) : null);
  const url = str(t.url, 2000);
  if (url && !/^https?:\/\//i.test(url)) return null;
  const query = str(t.query, 300);
  if (!url && !query) return null;
  return {
    id: Math.random().toString(16).slice(2, 14),
    title: str(t.title) || 'Unbekannter Titel',
    artist: str(t.artist) || '',
    duration: Math.max(0, Math.round(Number(t.duration) || 0)),
    thumbnail: /^https?:\/\//.test(t.thumbnail || '') ? str(t.thumbnail, 2000) : null,
    url, query, source: str(t.source, 30) || 'web',
  };
}
