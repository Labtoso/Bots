import { config } from '../config.js';
import { guildData, saveData } from '../store.js';
import { buildMessage, guildVars } from '../render.js';

/* Alerts for new YouTube videos, Twitch/Kick streams, Reddit/Bluesky posts and any RSS feed. No API keys needed. */

const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'en' };
const state = (gid) => guildData(gid, 'social', () => ({ feeds: {} }));
const lastRun = new Map();
const fetchCache = new Map();

async function get(url, { json = false, headers = {} } = {}) {
  const c = fetchCache.get(url);
  if (c && Date.now() - c.at < 60_000) return c.body;
  const res = await fetch(url, { headers: { ...UA, ...headers }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${new URL(url).host}: HTTP ${res.status}`);
  const body = json ? await res.json() : await res.text();
  fetchCache.set(url, { at: Date.now(), body });
  if (fetchCache.size > 300) fetchCache.delete(fetchCache.keys().next().value);
  return body;
}

const decode = (s) => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, 'i')); return m ? decode(m[1]) : ''; };

/** Items of an RSS or Atom feed, newest first as the feed lists them. */
export function parseFeed(xml) {
  const blocks = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  return blocks.map((b) => {
    const href = b.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    const link = decode(href || tag(b, 'link'));
    return {
      id: tag(b, 'yt:videoId') || tag(b, 'guid') || tag(b, 'id') || link,
      title: tag(b, 'title'), link, author: tag(tag(b, 'author'), 'name') || tag(b, 'author') || tag(b, 'dc:creator'),
      thumb: b.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1] || '',
    };
  }).filter((x) => x.id);
}

async function youtubeId(target) {
  const t = String(target).trim();
  const direct = t.match(/(UC[\w-]{22})/);
  if (direct) return direct[1];
  const url = /^https?:/.test(t) ? t : `https://www.youtube.com/${t.startsWith('@') ? t : `@${t}`}`;
  const html = await get(url, { headers: { Cookie: 'CONSENT=YES+1' } });
  const m = html.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/) || html.match(/channel\/(UC[\w-]{22})/);
  if (!m) throw new Error('YouTube-Kanal nicht gefunden');
  return m[1];
}

let twitchToken = null;
async function twitchLive(login) {
  if (config.twitchId && config.twitchSecret) {
    if (!twitchToken || twitchToken.exp < Date.now()) {
      const r = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${config.twitchId}&client_secret=${config.twitchSecret}&grant_type=client_credentials`, { method: 'POST' });
      const j = await r.json();
      twitchToken = { token: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
    }
    const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, { headers: { 'Client-Id': config.twitchId, Authorization: `Bearer ${twitchToken.token}` } });
    const s = (await r.json()).data?.[0];
    return s ? { live: true, id: s.id, title: s.title, game: s.game_name, thumb: s.thumbnail_url?.replace('{width}', '640').replace('{height}', '360') } : { live: false };
  }
  const html = await get(`https://www.twitch.tv/${encodeURIComponent(login)}`);
  const live = /"isLiveBroadcast":true/.test(html);
  const title = decode(html.match(/<meta property="og:description" content="([^"]*)"/)?.[1] || '');
  return { live, id: live ? `live-${new Date().toISOString().slice(0, 13)}` : null, title, thumb: `https://static-cdn.jtvnw.net/previews-ttv/live_user_${login.toLowerCase()}-640x360.jpg` };
}

/** Looks at one feed. Returns { items: [...], live?: bool } */
export async function fetchFeed(f, st = {}) {
  const target = String(f.target || '').trim();
  if (!target) throw new Error('Kein Ziel eingetragen');
  switch (f.type) {
    case 'youtube': {
      st.channelId = st.channelId || await youtubeId(target);
      const items = parseFeed(await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${st.channelId}`));
      return { items: items.map((x) => ({ ...x, link: x.link || `https://youtu.be/${x.id}`, thumb: x.thumb || `https://i.ytimg.com/vi/${x.id}/hqdefault.jpg` })) };
    }
    case 'twitch': {
      const login = target.replace(/^https?:\/\/(www\.)?twitch\.tv\//, '').split(/[/?]/)[0];
      const s = await twitchLive(login);
      return { live: s.live, items: s.live ? [{ id: s.id, title: s.title || `${login} ist live`, link: `https://twitch.tv/${login}`, author: login, thumb: s.thumb, game: s.game || '' }] : [] };
    }
    case 'kick': {
      const name = target.replace(/^https?:\/\/(www\.)?kick\.com\//, '').split(/[/?]/)[0];
      const j = await get(`https://kick.com/api/v2/channels/${encodeURIComponent(name)}`, { json: true });
      const ls = j.livestream;
      return { live: !!ls, items: ls ? [{ id: String(ls.id), title: ls.session_title || `${name} ist live`, link: `https://kick.com/${name}`, author: name, thumb: ls.thumbnail?.url || '' }] : [] };
    }
    case 'reddit': {
      const sub = target.replace(/^https?:\/\/(www\.)?reddit\.com\//, '').replace(/^\/?r\//, '').split(/[/?]/)[0];
      return { items: parseFeed(await get(`https://www.reddit.com/r/${encodeURIComponent(sub)}/new/.rss`)) };
    }
    case 'bluesky': {
      const actor = target.replace(/^https?:\/\/bsky\.app\/profile\//, '').replace(/^@/, '').split('/')[0];
      const j = await get(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=10&filter=posts_no_replies`, { json: true });
      return {
        items: (j.feed || []).filter((x) => !x.reason).map((x) => ({
          id: x.post.uri, title: (x.post.record?.text || '').slice(0, 300), author: x.post.author?.displayName || x.post.author?.handle,
          link: `https://bsky.app/profile/${x.post.author?.handle}/post/${x.post.uri.split('/').pop()}`, thumb: x.post.embed?.images?.[0]?.thumb || '',
        })),
      };
    }
    default: {
      if (!/^https?:\/\//.test(target)) throw new Error('RSS braucht eine Adresse mit https://');
      return { items: parseFeed(await get(target)) };
    }
  }
}

const LABEL = { youtube: 'YouTube', twitch: 'Twitch', kick: 'Kick', reddit: 'Reddit', bluesky: 'Bluesky', rss: 'RSS' };

async function post(ctx, guildId, f, item) {
  const all = ctx.cfg(guildId);
  const guild = ctx.client.guilds.cache.get(guildId);
  const vars = { ...guildVars(guild), title: item.title, link: item.link, author: item.author || f.name || f.target, name: f.name || f.target, platform: LABEL[f.type] || f.type, thumbnail: item.thumb || '', game: item.game || '' };
  const body = buildMessage(f.message, vars, all) || { content: `${item.title}\n${item.link}`, allowedMentions: { parse: ['roles'] } };
  if (f.role) body.content = `${f.role === 'everyone' ? '@everyone' : `<@&${f.role}>`} ${body.content || ''}`.trim();
  const ch = await ctx.channel(f.channel);
  await ch?.send?.(body).catch((e) => ctx.log.warn('Social-Alert:', e.message));
}

export async function checkGuild(ctx, guildId) {
  const cfg = ctx.cfg(guildId).social;
  const s = state(guildId);
  lastRun.set(guildId, Date.now());
  for (const f of cfg.feeds) {
    if (!f.channel || !f.target || f.on === false) continue;
    const st = s.feeds[f.id] || (s.feeds[f.id] = { seen: [], init: false });
    if (st.target !== `${f.type}:${f.target}`) { Object.assign(st, { seen: [], init: false, channelId: null, live: false, target: `${f.type}:${f.target}` }); }
    try {
      const r = await fetchFeed(f, st);
      st.error = null;
      if (f.type === 'twitch' || f.type === 'kick') {
        if (r.live && !st.live && st.init) await post(ctx, guildId, f, r.items[0]);
        st.live = r.live;
      } else {
        const fresh = r.items.filter((x) => !st.seen.includes(x.id));
        if (st.init) for (const item of fresh.slice(0, 3).reverse()) await post(ctx, guildId, f, item);
        st.seen = [...r.items.map((x) => x.id), ...st.seen].filter((v, n, a) => a.indexOf(v) === n).slice(0, 80);
      }
      st.init = true;
      st.checkedAt = Date.now();
    } catch (e) {
      st.error = e.message;
    }
  }
  const ids = new Set(cfg.feeds.map((f) => f.id));
  for (const id of Object.keys(s.feeds)) if (!ids.has(id)) delete s.feeds[id];
  saveData(guildId, 'social');
}

export function feedStatus(guildId) {
  const s = state(guildId).feeds;
  return Object.fromEntries(Object.entries(s).map(([id, v]) => [id, { error: v.error || null, checkedAt: v.checkedAt || null, live: !!v.live }]));
}

function ready(ctx) {
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      for (const g of ctx.client.guilds.cache.values()) {
        const cfg = ctx.cfg(g.id).social;
        if (!cfg.enabled || !cfg.feeds.length) continue;
        if (Date.now() - (lastRun.get(g.id) || 0) < Math.max(2, cfg.interval) * 60_000) continue;
        await checkGuild(ctx, g.id).catch((e) => ctx.log.warn('Social:', e.message));
      }
    } finally { busy = false; }
  }, 30_000);
}

export default { name: 'social', ready };
