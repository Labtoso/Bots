import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { bins } from './binaries.js';
import { log } from './log.js';
import { ytSearch } from './youtube.js';

const uid = () => crypto.randomBytes(6).toString('hex');

export function runYtdlp(args, { timeout = 45_000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(bins.ytdlp, ['--no-warnings', '--ignore-config', ...args], { windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { p.kill(); reject(new Error('yt-dlp Zeitüberschreitung')); }, timeout);
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(err.split('\n').find((l) => l.includes('ERROR')) || `yt-dlp Fehler ${code}`));
    });
  });
}

function bestThumb(info) {
  if (info.thumbnail) return info.thumbnail;
  const list = (info.thumbnails || []).filter((t) => t.url);
  if (list.length) {
    list.sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0));
    return list[0].url;
  }
  if (info.ie_key === 'Youtube' || /youtu/.test(info.url || '') || info.extractor_key === 'Youtube') {
    return `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`;
  }
  return null;
}

function pageUrl(info) {
  if (info.webpage_url) return info.webpage_url;
  if (info.url && /^https?:/.test(info.url)) return info.url;
  if (info.id && (info.ie_key === 'Youtube' || !info.ie_key)) return `https://www.youtube.com/watch?v=${info.id}`;
  return null;
}

/** Turns one yt-dlp info object into our track format. */
export function toTrack(info, extra = {}) {
  const source = (info.extractor_key || info.ie_key || 'web').replace(/Tab$/, '').toLowerCase();
  return {
    id: uid(),
    title: info.track || info.title || 'Unbekannter Titel',
    artist: info.artist || info.uploader || info.channel || info.creator || '',
    duration: Math.round(info.duration || 0),
    thumbnail: bestThumb(info),
    url: pageUrl(info),
    source: source.startsWith('youtube') ? 'youtube' : source,
    ...extra,
  };
}

export function parseYtdlpJson(text) {
  const data = JSON.parse(text);
  if (data._type === 'playlist' || Array.isArray(data.entries)) {
    return {
      playlist: data.title || null,
      tracks: (data.entries || []).filter(Boolean).filter((e) => e.title !== '[Private video]' && e.title !== '[Deleted video]').map((e) => toTrack(e)),
    };
  }
  return { playlist: null, tracks: [toTrack(data)] };
}

/* Small cache so typing, adding and "add all" do not search twice. */
const cache = new Map();
const CACHE_MS = 10 * 60_000;
const fresh = (t) => ({ ...t, id: uid() });
function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const value = fn();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return value;
}

let fastBroken = 0;
/** Search: YouTube's web API first (fast), yt-dlp as fallback. Returns tracks and playlists. */
export async function searchAll(query, limit = 8) {
  const key = `s:${limit}:${query.toLowerCase()}`;
  const r = await cached(key, async () => {
    if (Date.now() > fastBroken) {
      try {
        const fast = await ytSearch(query, { limit });
        if (fast.tracks.length) return fast;
      } catch (e) {
        log.warn('Schnelle Suche fehlgeschlagen, nutze yt-dlp:', e.message);
        fastBroken = Date.now() + 5 * 60_000;
      }
    }
    const out = await runYtdlp(['--flat-playlist', '-J', `ytsearch${limit}:${query}`]);
    return { tracks: parseYtdlpJson(out).tracks, playlists: [] };
  });
  return { tracks: r.tracks.map(fresh), playlists: r.playlists };
}

export async function search(query, limit = 8) {
  return (await searchAll(query, limit)).tracks;
}

const isUrl = (s) => /^https?:\/\//i.test(s);

/* ---------- Spotify (no account needed, reads public pages) ---------- */

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i'));
  return m ? decode(m[1]) : null;
};

async function spotify(url) {
  const m = url.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist)\/([A-Za-z0-9]+)/);
  if (!m) throw new Error('Spotify-Link nicht erkannt');
  const [, kind, id] = m;
  const res = await fetch(`https://open.spotify.com/embed/${kind}/${id}`, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!next) throw new Error('Spotify-Seite konnte nicht gelesen werden');
  const entity = JSON.parse(next[1])?.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Spotify-Daten fehlen');
  const cover = (entity.visualIdentity?.image || entity.coverArt?.sources || []).sort((a, b) => (b.maxWidth || 0) - (a.maxWidth || 0))[0]?.url || null;
  const mk = (title, artist, duration, img) => ({
    id: uid(), title, artist, duration: Math.round((duration || 0) / 1000), thumbnail: img || cover,
    url: null, source: 'spotify', query: `${artist} - ${title}`,
  });
  if (kind === 'track') {
    const artist = (entity.artists || []).map((a) => a.name).join(', ') || entity.subtitle || '';
    return { playlist: null, tracks: [mk(entity.name || entity.title, artist, entity.duration, cover)] };
  }
  const list = entity.trackList || [];
  return { playlist: entity.name || entity.title, tracks: list.map((t) => mk(t.title, t.subtitle || '', t.duration, null)) };
}

/** Resolves user input (search text or link) into tracks. */
export async function resolve(input) {
  const q = String(input || '').trim();
  if (!q) throw new Error('Leere Eingabe');
  if (!isUrl(q)) {
    const [first] = await search(q, 1);
    if (!first) throw new Error('Nichts gefunden');
    return { playlist: null, tracks: [first] };
  }
  if (/open\.spotify\.com/.test(q)) return spotify(q);
  const r = await cached(`u:${q}`, async () => parseYtdlpJson(await runYtdlp(['--flat-playlist', '-J', q], { timeout: 90_000 })));
  return { playlist: r.playlist, tracks: r.tracks.map(fresh) };
}

/* Stream URLs are cached so skipping to an already prefetched track starts at once. */
const streams = new Map();
const streamKey = (t) => t.url || `q:${t.query}`;
function expiresAt(url) {
  const m = String(url).match(/[?&/]expire[=/](\d{9,})/);
  const hard = m ? Number(m[1]) * 1000 - 5 * 60_000 : Infinity;
  return Math.min(hard, Date.now() + 60 * 60_000);
}

async function fetchStream(track) {
  let target = track.url;
  if (!target && track.query) {
    const [hit] = await search(track.query, 1);
    if (!hit) throw new Error(`Nicht gefunden: ${track.query}`);
    target = hit.url;
    track.url = hit.url;
    if (!track.duration) track.duration = hit.duration;
    if (!track.thumbnail) track.thumbnail = hit.thumbnail;
  }
  const args = ['-j', '--no-playlist', '-f', 'bestaudio/best', target];
  let out;
  try {
    out = await runYtdlp(args);
  } catch (err) {
    // YouTube sometimes needs its JavaScript challenge solved; Node is already here, so use it for the retry
    if (!/youtu/.test(target)) throw err;
    log.warn('Stream erneut mit JS-Laufzeit:', err.message);
    out = await runYtdlp(['--js-runtimes', `node:${process.execPath}`, ...args]);
  }
  const info = JSON.parse(out);
  return {
    url: info.url, headers: info.http_headers || {}, isLive: !!info.is_live,
    duration: info.duration ? Math.round(info.duration) : 0, thumbnail: bestThumb(info),
  };
}

/** Gets a playable stream URL (plus headers) right before playback. */
export async function streamInfo(track) {
  const key = streamKey(track);
  let hit = streams.get(key);
  if (!hit || hit.until < Date.now()) {
    const promise = fetchStream(track);
    hit = { promise, until: Date.now() + 60 * 60_000 };
    streams.set(key, hit);
    promise.then((i) => { hit.until = i.isLive ? 0 : expiresAt(i.url); }, () => streams.delete(key));
    if (streams.size > 200) streams.delete(streams.keys().next().value);
  }
  const info = await hit.promise;
  if (!track.duration && info.duration) track.duration = info.duration;
  if (!track.thumbnail && info.thumbnail) track.thumbnail = info.thumbnail;
  return info;
}

/** Drops a cached stream URL, e.g. after YouTube answered 403. */
export function forgetStream(track) {
  if (track) streams.delete(streamKey(track));
}

/** Resolves the stream in the background, errors are ignored here. */
export function prefetchStream(track) {
  if (track && (track.url || track.query)) streamInfo(track).catch(() => {});
}
