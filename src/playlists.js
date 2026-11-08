import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './config.js';
import { log } from './log.js';

/* Saved playlists per server, kept in data/playlists.json. */
const file = process.env.PLAYLISTS_FILE || path.join(ROOT, 'data', 'playlists.json');
let data = {};
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { data = {}; }

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(data));
      fs.renameSync(`${file}.tmp`, file);
    } catch (e) { log.warn('Playlists nicht gespeichert:', e.message); }
  }, 200);
}

const id = () => crypto.randomBytes(5).toString('hex');
const MAX_LISTS = 100;
const MAX_TRACKS = 500;
const keep = (t) => ({
  id: id(), title: t.title, artist: t.artist || '', duration: t.duration || 0,
  thumbnail: t.thumbnail || null, url: t.url || null, query: t.query || null, source: t.source || 'web',
});

const lists = (g) => (data[g] ||= []);
const find = (g, pid) => {
  const p = lists(g).find((x) => x.id === pid);
  if (!p) throw new Error('PLAYLIST_GONE');
  return p;
};
const summary = (p) => ({
  id: p.id, name: p.name, by: p.by, count: p.tracks.length,
  duration: p.tracks.reduce((a, t) => a + (t.duration || 0), 0),
  thumbnail: p.tracks.find((t) => t.thumbnail)?.thumbnail || null, updatedAt: p.updatedAt,
});

export const playlists = {
  list: (g) => lists(g).map(summary),
  get: (g, pid) => find(g, pid),
  create(g, name, by) {
    if (lists(g).length >= MAX_LISTS) throw new Error('Zu viele Playlists');
    const p = { id: id(), name: String(name).slice(0, 60), by, tracks: [], updatedAt: Date.now() };
    lists(g).push(p); save();
    return p;
  },
  rename(g, pid, name) { const p = find(g, pid); p.name = String(name).slice(0, 60); p.updatedAt = Date.now(); save(); return p; },
  remove(g, pid) { data[g] = lists(g).filter((x) => x.id !== pid); save(); },
  addTracks(g, pid, tracks) {
    const p = find(g, pid);
    const room = MAX_TRACKS - p.tracks.length;
    const add = tracks.slice(0, Math.max(0, room)).map(keep);
    p.tracks.push(...add); p.updatedAt = Date.now(); save();
    return add.length;
  },
  removeTrack(g, pid, tid) { const p = find(g, pid); p.tracks = p.tracks.filter((t) => t.id !== tid); p.updatedAt = Date.now(); save(); return p; },
  moveTrack(g, pid, tid, to) {
    const p = find(g, pid);
    const i = p.tracks.findIndex((t) => t.id === tid);
    if (i < 0) return p;
    const [t] = p.tracks.splice(i, 1);
    p.tracks.splice(Math.max(0, Math.min(Number(to) || 0, p.tracks.length)), 0, t);
    p.updatedAt = Date.now(); save();
    return p;
  },
};
