import { config } from '../config.js';
import { guildData, saveData } from '../store.js';
import { buildMessage, guildVars } from '../render.js';
import { MSG } from '../defaults.js';

/*
 * GitHub: posts new releases, commits, tags, issues and pull requests of any public repository.
 * Uses the GitHub REST API with ETags (an unchanged answer does not count against the limit),
 * GITHUB_TOKEN in .env raises the limit from 60 to 5000 requests per hour.
 */

export const EVENTS = ['release', 'commit', 'tag', 'issue', 'issueClosed', 'pr', 'prMerged'];

const C = { release: '#2ea043', commit: '#6e7681', tag: '#8250df', issue: '#1f883d', issueClosed: '#8250df', pr: '#1f6feb', prMerged: '#8250df' };
/** Default messages per event (also used when a feed has none). */
export const GH_MESSAGES = () => ({
  release: MSG('', { enabled: true, color: C.release, author: { name: '{repo}', icon: '{repo.avatar}', url: '{repo.url}' }, title: '🚀 {release.name}', url: '{release.url}', description: '{release.body}', footer: { text: '{release.tag}{prerelease} · von {author}', icon: '{author.avatar}' }, timestamp: true }),
  commit: MSG('', { enabled: true, color: C.commit, author: { name: '{repo} · {branch}', icon: '{repo.avatar}', url: '{repo.url}' }, title: '{commits} neue Commits', url: '{compare.url}', description: '{commits.list}', timestamp: true }),
  tag: MSG('', { enabled: true, color: C.tag, author: { name: '{repo}', icon: '{repo.avatar}', url: '{repo.url}' }, title: '🏷️ Neuer Tag: {tag}', url: '{url}', timestamp: true }),
  issue: MSG('', { enabled: true, color: C.issue, author: { name: '{author}', icon: '{author.avatar}', url: '{author.url}' }, title: 'Issue #{number}: {title}', url: '{url}', description: '{body}', footer: { text: '{repo}{labels}', icon: '' }, timestamp: true }),
  issueClosed: MSG('', { enabled: true, color: C.issueClosed, author: { name: '{author}', icon: '{author.avatar}', url: '{author.url}' }, title: '✅ Issue #{number} geschlossen: {title}', url: '{url}', footer: { text: '{repo}', icon: '' }, timestamp: true }),
  pr: MSG('', { enabled: true, color: C.pr, author: { name: '{author}', icon: '{author.avatar}', url: '{author.url}' }, title: 'Pull Request #{number}: {title}', url: '{url}', description: '{body}', footer: { text: '{repo} · {head} → {base}', icon: '' }, timestamp: true }),
  prMerged: MSG('', { enabled: true, color: C.prMerged, author: { name: '{author}', icon: '{author.avatar}', url: '{author.url}' }, title: '🔀 Pull Request #{number} gemergt: {title}', url: '{url}', footer: { text: '{repo} · {head} → {base}', icon: '' }, timestamp: true }),
});

const state = (gid) => guildData(gid, 'github', () => ({ feeds: {} }));
const lastRun = new Map();
const cache = new Map(); // url -> { etag, data }
export const rate = { remaining: null, limit: null, reset: null };

/** "owner/name" from "owner/name", a GitHub link (also without https, with www, /tree/<branch>, .git) or git@github.com:owner/name. */
export function parseRepo(s) {
  return parseRepoLink(s)?.repo || null;
}

export function parseRepoLink(s) {
  const t = String(s || '').trim().replace(/^git@github\.com:/i, '').replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '');
  const m = t.match(/^([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/([^?#]+))?(?:[/?#].*)?$/i);
  if (!m || /^(?:https?:|www\.|github\.com)/i.test(m[1])) return null;
  return { repo: `${m[1]}/${m[2]}`, branch: m[3] ? decodeURIComponent(m[3].replace(/\/+$/, '')) : '' };
}

async function gh(path) {
  const url = `https://api.github.com${path}`;
  const c = cache.get(url);
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'aio-discord-bot', 'X-GitHub-Api-Version': '2022-11-28' };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
  if (c?.etag) headers['If-None-Match'] = c.etag;
  let res;
  try { res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) }); } catch (e) {
    throw new Error(`GitHub nicht erreichbar (${e.cause?.code || e.name || e.message})`);
  }
  if (res.headers.get('x-ratelimit-remaining') !== null) {
    rate.remaining = Number(res.headers.get('x-ratelimit-remaining'));
    rate.limit = Number(res.headers.get('x-ratelimit-limit'));
    rate.reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
  }
  if (res.status === 304 && c) return c.data;
  if (res.status === 404) throw new Error('Repository nicht gefunden (privat oder falsch geschrieben?)');
  if (res.status === 401) throw new Error('GITHUB_TOKEN in der .env ist ungültig oder abgelaufen');
  if (res.status === 429 || (res.status === 403 && rate.remaining === 0)) {
    const at = rate.reset ? new Date(rate.reset).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '';
    throw new Error(`GitHub-Limit erreicht, ab ${at || 'später'} geht es weiter (mit GITHUB_TOKEN in der .env viel mehr)`);
  }
  if (res.status === 403) throw new Error('GitHub verweigert den Zugriff (privates Repository? Dann GITHUB_TOKEN mit Leserecht in die .env)');
  if (!res.ok) throw new Error(`GitHub: HTTP ${res.status}`);
  const data = await res.json();
  cache.set(url, { etag: res.headers.get('etag'), data });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return data;
}

const cut = (s, n) => { s = String(s || '').replace(/\r/g, '').replace(/<!--[\s\S]*?-->/g, '').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const user = (u) => ({ author: u?.login || '', 'author.avatar': u?.avatar_url || '', 'author.url': u?.html_url || '' });
const isBot = (u, name = '') => u?.type === 'Bot' || /\[bot\]$/i.test(u?.login || name);

/** Everything new in one repository, as { type, key, vars, text } (oldest first). */
export async function fetchRepo(f) {
  const link = parseRepoLink(f.repo);
  if (!link) throw new Error('Bitte das Repository als besitzer/name oder als GitHub-Link eintragen.');
  const { repo } = link;
  const info = await gh(`/repos/${repo}`);
  const base = {
    repo: info.full_name, 'repo.name': info.name, 'repo.owner': info.owner?.login || '', 'repo.url': info.html_url,
    'repo.avatar': info.owner?.avatar_url || '', 'repo.description': info.description || '', stars: info.stargazers_count ?? 0,
  };
  const ev = f.events || {};
  const items = [];
  const branch = String(f.branch || '').trim() || link.branch || info.default_branch;
  if (ev.release || ev.prerelease) {
    for (const r of await gh(`/repos/${repo}/releases?per_page=10`)) {
      if (r.draft || (r.prerelease ? !ev.prerelease : !ev.release)) continue;
      items.push({ type: 'release', key: `r${r.id}`, at: r.published_at, bot: isBot(r.author), text: `${r.name} ${r.tag_name} ${r.body || ''}`, vars: {
        ...base, ...user(r.author), url: r.html_url, title: r.name || r.tag_name, 'release.name': r.name || r.tag_name, 'release.tag': r.tag_name,
        'release.url': r.html_url, 'release.body': cut(r.body, Math.max(100, Math.min(4000, Number(f.bodyLength) || 1500))) || '-', prerelease: r.prerelease ? ' · Pre-Release' : '',
      } });
    }
  }
  if (ev.commit) {
    const list = await gh(`/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=20`).catch((e) => {
      throw /nicht gefunden/.test(e.message) ? new Error(`Branch "${branch}" gibt es in ${info.full_name} nicht`) : e;
    });
    for (const c of list) {
      const msg = c.commit?.message || '';
      items.push({ type: 'commit', key: `c${c.sha}`, at: c.commit?.committer?.date, bot: isBot(c.author, c.commit?.author?.name), text: msg, vars: {
        ...base, ...user(c.author), author: c.author?.login || c.commit?.author?.name || '', url: c.html_url, title: msg.split('\n')[0],
        'commit.message': cut(msg.split('\n')[0], 200), 'commit.body': cut(msg, 1000), 'commit.sha': c.sha.slice(0, 7), 'commit.url': c.html_url, branch,
      } });
    }
  }
  if (ev.tag) {
    for (const t of await gh(`/repos/${repo}/tags?per_page=10`)) {
      items.push({ type: 'tag', key: `t${t.name}`, text: t.name, vars: { ...base, url: `${info.html_url}/releases/tag/${encodeURIComponent(t.name)}`, title: t.name, tag: t.name, 'tag.sha': t.commit?.sha?.slice(0, 7) || '' } });
    }
  }
  if (ev.issue || ev.issueClosed) {
    for (const i of await gh(`/repos/${repo}/issues?state=all&sort=updated&direction=desc&per_page=20`)) {
      if (i.pull_request) continue;
      const vars = { ...base, ...user(i.user), url: i.html_url, title: i.title, number: i.number, body: cut(i.body, 500) || '-', labels: i.labels?.length ? ` · ${i.labels.map((l) => l.name).join(', ')}` : '', state: i.state };
      const text = `${i.title} ${i.body || ''} ${(i.labels || []).map((l) => l.name).join(' ')}`;
      if (ev.issue) items.push({ type: 'issue', key: `i${i.number}`, at: i.created_at, bot: isBot(i.user), text, vars });
      if (ev.issueClosed && i.state === 'closed') items.push({ type: 'issueClosed', key: `ic${i.number}`, at: i.closed_at, bot: isBot(i.user), text, vars: { ...vars, ...(i.closed_by ? { 'closed.by': i.closed_by.login } : {}) } });
    }
  }
  if (ev.pr || ev.prMerged) {
    for (const p of await gh(`/repos/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=20`)) {
      const vars = { ...base, ...user(p.user), url: p.html_url, title: p.title, number: p.number, body: cut(p.body, 500) || '-', head: p.head?.ref || '', base: p.base?.ref || '', state: p.merged_at ? 'merged' : p.state };
      const text = `${p.title} ${p.body || ''}`;
      if (ev.pr && !p.draft) items.push({ type: 'pr', key: `p${p.number}`, at: p.created_at, bot: isBot(p.user), text, vars });
      if (ev.prMerged && p.merged_at) items.push({ type: 'prMerged', key: `pm${p.number}`, at: p.merged_at, bot: isBot(p.user), text, vars });
    }
  }
  return { repo: info.full_name, branch, info: base, items: items.sort((a, b) => String(a.at || '').localeCompare(String(b.at || ''))) };
}

const words = (s) => String(s || '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
function passes(f, it) {
  if (f.ignoreBots && it.bot) return false;
  const t = it.text.toLowerCase();
  const inc = words(f.include); const exc = words(f.exclude);
  if (inc.length && !inc.some((w) => t.includes(w))) return false;
  if (exc.some((w) => t.includes(w))) return false;
  if (it.type === 'commit' && f.skipMerges && /^merge (pull request|branch)/i.test(it.vars['commit.message'] || '')) return false;
  return true;
}

async function send(ctx, guildId, f, type, vars) {
  const all = ctx.cfg(guildId);
  const guild = ctx.client.guilds.cache.get(guildId);
  const msg = f.messages?.[type] || GH_MESSAGES()[type];
  const v = { ...guildVars(guild), ...vars };
  const body = buildMessage(msg, v, all) || { content: `${v.title || ''}\n${v.url || ''}`.trim() };
  const ping = (f.pings?.[type] ?? f.role) || '';
  if (ping) body.content = `${ping === 'everyone' ? '@everyone' : `<@&${ping}>`} ${body.content || ''}`.trim();
  body.allowedMentions = { parse: ['roles', 'everyone'] };
  const ch = await ctx.channel(f.channels?.[type] || f.channel);
  if (!ch?.isTextBased?.()) throw new Error('Kanal fehlt oder der Bot darf dort nicht schreiben.');
  return ch.send(body);
}

/** Posts a batch of new items: commits are combined into one message, everything else one by one. */
async function postItems(ctx, guildId, f, items, info) {
  const commits = items.filter((x) => x.type === 'commit');
  for (const it of items.filter((x) => x.type !== 'commit').slice(-5)) await send(ctx, guildId, f, it.type, it.vars);
  if (commits.length) {
    const max = Math.max(1, Math.min(25, Number(f.maxCommits) || 10));
    const shown = commits.slice(-max).reverse();
    const list = shown.map((c) => `[\`${c.vars['commit.sha']}\`](${c.vars['commit.url']}) ${c.vars['commit.message']} – ${c.vars.author}`).join('\n')
      + (commits.length > max ? `\n… und ${commits.length - max} weitere` : '');
    const first = commits[0].vars['commit.sha'];
    await send(ctx, guildId, f, 'commit', {
      ...commits.at(-1).vars, commits: commits.length, 'commits.list': list,
      'compare.url': commits.length > 1 ? `${info['repo.url']}/compare/${first}^...${commits.at(-1).vars['commit.sha']}` : commits.at(-1).vars['commit.url'],
    });
  }
}

export async function checkGuild(ctx, guildId) {
  const cfg = ctx.cfg(guildId).github;
  const s = state(guildId);
  lastRun.set(guildId, Date.now());
  for (const f of cfg.feeds) {
    if (!f.repo || f.on === false || (!f.channel && !Object.values(f.channels || {}).some(Boolean))) continue;
    const st = s.feeds[f.id] || (s.feeds[f.id] = { seen: [], init: false });
    const sig = `${parseRepo(f.repo)}|${f.branch || parseRepoLink(f.repo)?.branch || ''}|${EVENTS.filter((e) => f.events?.[e]).join(',')}|${f.events?.prerelease ? 'pre' : ''}`;
    if (st.sig !== sig) Object.assign(st, { seen: [], init: false, sig });
    try {
      const r = await fetchRepo(f);
      const seen = new Set(st.seen);
      const fresh = r.items.filter((x) => !seen.has(x.key));
      if (st.init && fresh.length) await postItems(ctx, guildId, f, fresh.filter((x) => passes(f, x)), r.info);
      st.seen = [...r.items.map((x) => x.key), ...st.seen].filter((v, n, a) => a.indexOf(v) === n).slice(0, 400);
      st.init = true;
      st.error = null;
      st.checkedAt = Date.now();
      st.repo = r.repo;
    } catch (e) {
      st.error = e.message;
    }
  }
  const ids = new Set(cfg.feeds.map((f) => f.id));
  for (const id of Object.keys(s.feeds)) if (!ids.has(id)) delete s.feeds[id];
  saveData(guildId, 'github');
}

/** Panel button: posts the newest item of one kind right now (to see how it looks). */
export async function postLatest(ctx, guildId, f, type) {
  const ev = type === 'release' ? { release: true, prerelease: true } : { [type]: true };
  const r = await fetchRepo({ ...f, events: ev });
  const items = r.items.filter((x) => x.type === type);
  if (!items.length) throw new Error('Dazu gibt es in diesem Repository noch nichts.');
  await postItems(ctx, guildId, f, type === 'commit' ? items.slice(-3) : [items.at(-1)], r.info);
  return { ok: true, title: items.at(-1).vars.title };
}

export async function testRepo(f) {
  const r = await fetchRepo({ ...f, events: { release: true, prerelease: true, commit: true } });
  const rel = r.items.filter((x) => x.type === 'release').at(-1);
  const com = r.items.filter((x) => x.type === 'commit').at(-1);
  return { repo: r.repo, branch: r.branch, stars: r.info.stars, release: rel ? rel.vars['release.tag'] : null, commit: com ? com.vars['commit.message'] : null, rate };
}

export function ghStatus(guildId) {
  const s = state(guildId).feeds;
  return { rate, token: !!config.githubToken, feeds: Object.fromEntries(Object.entries(s).map(([id, v]) => [id, { error: v.error || null, checkedAt: v.checkedAt || null, repo: v.repo || null }])) };
}

function ready(ctx) {
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      for (const g of ctx.client.guilds.cache.values()) {
        const cfg = ctx.cfg(g.id).github;
        if (!cfg.enabled || !cfg.feeds.length) continue;
        if (Date.now() - (lastRun.get(g.id) || 0) < Math.max(2, cfg.interval) * 60_000) continue;
        await checkGuild(ctx, g.id).catch((e) => ctx.log.warn('GitHub:', e.message));
      }
    } finally { busy = false; }
  }, 30_000);
}

export default { name: 'github', ready };
