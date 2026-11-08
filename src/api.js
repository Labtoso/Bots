import http from 'node:http';
import { config } from './config.js';
import { verifyToken } from './auth.js';
import { log } from './log.js';
import { resolve, searchAll } from './resolve.js';
import { settings } from './settings.js';
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
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
    SPOTIFY_NOT_SET: [400, 'Spotify-Suche ist auf diesem Bot nicht eingerichtet (SPOTIFY_CLIENT_ID und SPOTIFY_CLIENT_SECRET in .env). Stell in den Einstellungen auf YouTube.'],
    SPOTIFY_BAD_KEYS: [400, 'Spotify-Schlüssel ungültig. SPOTIFY_CLIENT_ID und SPOTIFY_CLIENT_SECRET in .env prüfen.'],
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
      const ping = setInterval(() => res.write(`event: tick\ndata: ${JSON.stringify({ position: player.state().position, paused: player.paused })}\n\n`), 1000);
      req.on('close', () => { clearInterval(ping); streams.get(guildId)?.delete(res); });
      return undefined;
    }

    if (p === '/api/session' && req.method === 'GET') {
      return send(res, 200, {
        user: { id: session.u, name: session.n, avatar: session.a },
        guild: await bot.getGuildInfo(guildId),
        expires: session.exp,
        state: player.state(),
      });
    }

    if (p === '/api/state' && req.method === 'GET') return send(res, 200, player.state());

    if (p === '/api/channels' && req.method === 'GET') {
      const [channels, member] = await Promise.all([bot.getVoiceChannels(guildId), bot.getMember(guildId, session.u)]);
      return send(res, 200, { channels, selected: settings.get(guildId).channelId, mine: member.voiceChannelId });
    }

    if (p === '/api/search' && req.method === 'GET') {
      const q = (url.searchParams.get('q') || '').trim();
      if (!q) return send(res, 200, { results: [] });
      if (/^https?:\/\//i.test(q)) {
        const r = await resolve(q);
        return send(res, 200, { results: r.tracks.slice(0, 50), playlist: r.playlist, total: r.tracks.length });
      }
      const r = url.searchParams.get('source') === 'spotify' ? await spotifySearch(q) : await searchAll(q, 8);
      return send(res, 200, { results: r.tracks, playlists: r.playlists });
    }

    if (req.method !== 'POST' && req.method !== 'DELETE') return send(res, 404, { error: 'Nicht gefunden' });
    const body = req.method === 'POST' ? await readBody(req) : {};

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
      tracks.forEach((t) => { t.requester = session.n; });
      const added = await player.add(tracks, { next: !!body.next });
      return send(res, 200, { added, playlist, state: player.state() });
    }

    if (p === '/api/settings' && req.method === 'POST') {
      const channelId = typeof body.channelId === 'string' && /^[\w-]{1,32}$/.test(body.channelId) ? body.channelId : null;
      const saved = settings.set(guildId, { channelId });
      if (channelId && body.join) await player.moveTo(channelId);
      return send(res, 200, { settings: saved, state: player.state() });
    }

    const qm = p.match(/^\/api\/queue\/([\w-]+)$/);
    if (qm && req.method === 'DELETE') { player.remove(qm[1]); return send(res, 200, { ok: true }); }

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
      await actions[action]();
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
