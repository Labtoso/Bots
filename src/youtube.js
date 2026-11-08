import crypto from 'node:crypto';

/*
 * Fast YouTube search through YouTube's own web API (the one youtube.com uses).
 * One HTTPS request instead of starting yt-dlp, so results arrive in a few hundred ms.
 * The caller falls back to yt-dlp when this fails.
 */

const ENDPOINT = 'https://www.youtube.com/youtubei/v1/search?prettyPrint=false';
const CLIENT = { clientName: 'WEB', clientVersion: '2.20251105.01.00', hl: 'de', gl: 'DE' };
const FILTER = { videos: 'EgIQAQ%3D%3D', playlists: 'EgIQAw%3D%3D' };

const uid = () => crypto.randomBytes(6).toString('hex');

const text = (v) => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (v.simpleText) return v.simpleText;
  if (v.content) return v.content;
  if (Array.isArray(v.runs)) return v.runs.map((r) => r.text).join('');
  return '';
};

export function parseLength(s) {
  if (!s) return 0;
  return String(s).split(':').reduce((acc, n) => acc * 60 + (Number(n) || 0), 0);
}

function biggest(list) {
  const arr = (list || []).filter((x) => x?.url);
  if (!arr.length) return null;
  arr.sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0));
  const u = arr[0].url;
  return u.startsWith('//') ? `https:${u}` : u;
}

/** Visits every object in a JSON tree. */
function walk(node, fn, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 40) return;
  if (Array.isArray(node)) { for (const n of node) walk(n, fn, depth + 1); return; }
  if (fn(node) === false) return;
  for (const k in node) walk(node[k], fn, depth + 1);
}

function find(node, pred) {
  let hit;
  walk(node, (o) => {
    if (hit !== undefined) return false;
    for (const k in o) {
      if (pred(k, o[k])) { hit = o[k]; return false; }
    }
    return true;
  });
  return hit;
}

function fromVideoRenderer(v) {
  const id = v.videoId;
  return {
    id: uid(),
    title: text(v.title) || 'Unbekannter Titel',
    artist: text(v.ownerText) || text(v.longBylineText) || text(v.shortBylineText) || '',
    duration: parseLength(text(v.lengthText)),
    thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
    source: 'youtube',
    live: !v.lengthText && !!(v.badges || []).some((b) => /LIVE/i.test(JSON.stringify(b))),
  };
}

const countFrom = (s) => {
  const m = String(s || '').match(/(\d[\d.,]*)\s*(?:videos?|titel|tracks?|folgen|episodes?)/i);
  return m ? Number(m[1].replace(/[.,]/g, '')) : null;
};

function fromPlaylistRenderer(p) {
  return {
    id: p.playlistId,
    title: text(p.title),
    artist: text(p.shortBylineText) || text(p.longBylineText) || '',
    count: Number(String(p.videoCount || '').replace(/\D/g, '')) || countFrom(text(p.videoCountText)),
    thumbnail: biggest(p.thumbnails?.[0]?.thumbnails) || biggest(p.thumbnail?.thumbnails),
    url: `https://www.youtube.com/playlist?list=${p.playlistId}`,
  };
}

function fromLockup(l) {
  const md = l.metadata?.lockupMetadataViewModel || {};
  const parts = [];
  walk(md.metadata, (o) => { if (o.metadataParts) for (const p of o.metadataParts) parts.push(text(p.text)); });
  let count = null;
  walk(l.contentImage, (o) => {
    if (count === null && o.text && typeof o.text === 'string') count = countFrom(o.text);
  });
  return {
    id: l.contentId,
    title: text(md.title),
    artist: parts.find((p) => p && !countFrom(p) && !/playlist|wiedergabeliste|aktualisiert|updated|ansehen|view full/i.test(p)) || '',
    count,
    thumbnail: biggest(find(l.contentImage, (k, v) => k === 'sources' && Array.isArray(v))),
    url: `https://www.youtube.com/playlist?list=${l.contentId}`,
  };
}

/** Pulls videos and playlists out of a youtubei search response. */
export function parseSearch(json) {
  const videos = [];
  const playlists = [];
  const seen = new Set();
  walk(json, (o) => {
    if (o.videoRenderer?.videoId) {
      if (!seen.has(o.videoRenderer.videoId)) { seen.add(o.videoRenderer.videoId); videos.push(fromVideoRenderer(o.videoRenderer)); }
      return false;
    }
    if (o.playlistRenderer?.playlistId) {
      if (!seen.has(o.playlistRenderer.playlistId)) { seen.add(o.playlistRenderer.playlistId); playlists.push(fromPlaylistRenderer(o.playlistRenderer)); }
      return false;
    }
    const l = o.lockupViewModel;
    if (l?.contentId && /PLAYLIST|PODCAST/.test(l.contentType || '')) {
      if (!seen.has(l.contentId)) { seen.add(l.contentId); playlists.push(fromLockup(l)); }
      return false;
    }
    if (o.reelShelfRenderer || o.shortsLockupViewModel) return false; // skip Shorts
    return true;
  });
  return { videos, playlists: playlists.filter((p) => p.title) };
}

async function request(query, params, timeoutMs) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'x-youtube-client-name': '1',
      'x-youtube-client-version': CLIENT.clientVersion,
      origin: 'https://www.youtube.com',
    },
    body: JSON.stringify({ context: { client: CLIENT }, query, params: params ? decodeURIComponent(params) : undefined }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`YouTube-Suche ${res.status}`);
  return parseSearch(await res.json());
}

/** Videos plus matching playlists, both requests in parallel. */
export async function ytSearch(query, { limit = 8, playlists = 3, timeoutMs = 6000 } = {}) {
  const [v, p] = await Promise.allSettled([
    request(query, FILTER.videos, timeoutMs),
    playlists ? request(query, FILTER.playlists, timeoutMs) : Promise.resolve({ playlists: [] }),
  ]);
  if (v.status === 'rejected') throw v.reason;
  return {
    tracks: v.value.videos.slice(0, limit).map(({ live, ...t }) => t),
    playlists: (p.status === 'fulfilled' ? p.value.playlists : []).slice(0, playlists),
  };
}
