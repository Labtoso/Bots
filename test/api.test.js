// End-to-end test of API + player + real ffmpeg/yt-dlp audio pipeline, without Discord (MOCK=1).
// Needs the fixture server from test/fixtures (FIXTURE_BASE, default http://127.0.0.1:9000).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BASE = process.env.FIXTURE_BASE || 'http://127.0.0.1:9000';
const PORT = 8099;
const API = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let proc;
let token;

async function call(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
async function waitFor(fn, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = (await call('/api/state')).data;
    if (fn(s)) return s;
    await sleep(250);
  }
  throw new Error('timeout');
}

test.before(async () => {
  proc = fork(fileURLToPath(new URL('../src/index.js', import.meta.url)), {
    env: { ...process.env, MOCK: '1', TUNNEL: 'off', PORT: String(PORT), NO_PROXY: '127.0.0.1,localhost' },
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  token = await new Promise((resolve, reject) => {
    proc.once('message', (m) => resolve(m.token));
    proc.once('exit', (c) => reject(new Error(`exit ${c}`)));
  });
});
test.after(() => proc?.kill());

test('rejects requests without a valid token', async () => {
  const res = await fetch(`${API}/api/state`);
  assert.equal(res.status, 401);
});

test('CORS allows the dashboard origins only', async () => {
  const dom = await fetch(`${API}/api/state`, { method: 'OPTIONS', headers: { Origin: 'https://bot.labtoso.de' } });
  assert.equal(dom.headers.get('access-control-allow-origin'), 'https://bot.labtoso.de');
  const ok = await fetch(`${API}/api/state`, { method: 'OPTIONS', headers: { Origin: 'https://labtoso.github.io' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://labtoso.github.io');
  const bad = await fetch(`${API}/api/state`, { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});

test('session returns user, server and state', async () => {
  const { status, data } = await call('/api/session');
  assert.equal(status, 200);
  assert.equal(data.user.name, 'Tester');
  assert.equal(data.guild.name, 'Testserver');
});

test('plays a track with title and cover, position advances', async () => {
  const r = await call('/api/queue', 'POST', { query: `${BASE}/track1.html` });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const s = await waitFor((st) => st.current && !st.loading && st.position > 1.5);
  assert.match(s.current.title, /Nachtfahrt/);
  assert.equal(s.current.thumbnail, `${BASE}/cover1.jpg`);
  assert.equal(s.current.requester, 'Tester');
  assert.equal(s.channel.name, 'Musik');
  assert.equal(s.paused, false);
});

test('queue: add, move, remove, shuffle, clear', async () => {
  await call('/api/queue', 'POST', { query: `${BASE}/track2.html` });
  await call('/api/queue', 'POST', { query: `${BASE}/track3.html` });
  let s = (await call('/api/state')).data;
  assert.equal(s.queue.length, 2);
  assert.match(s.queue[0].title, /Kupferhimmel/);
  assert.equal(s.queue[1].thumbnail, `${BASE}/cover3.jpg`);
  s = (await call('/api/control', 'POST', { action: 'move', value: { id: s.queue[1].id, to: 0 } })).data;
  assert.match(s.queue[0].title, /Leise Wellen/);
  s = (await call('/api/control', 'POST', { action: 'shuffle' })).data;
  assert.equal(s.queue.length, 2);
  await call(`/api/queue/${s.queue[0].id}`, 'DELETE');
  s = (await call('/api/state')).data;
  assert.equal(s.queue.length, 1);
});

test('controls: pause, resume, volume, loop, filter, seek', async () => {
  let s = (await call('/api/control', 'POST', { action: 'pause' })).data;
  assert.equal(s.paused, true);
  s = (await call('/api/control', 'POST', { action: 'resume' })).data;
  assert.equal(s.paused, false);
  s = (await call('/api/control', 'POST', { action: 'volume', value: 35 })).data;
  assert.equal(s.volume, 35);
  s = (await call('/api/control', 'POST', { action: 'loop', value: 'queue' })).data;
  assert.equal(s.loop, 'queue');
  s = (await call('/api/control', 'POST', { action: 'loop' })).data;
  assert.equal(s.loop, 'off');
  s = (await call('/api/control', 'POST', { action: 'seek', value: 10 })).data;
  s = await waitFor((st) => !st.loading && st.position >= 10);
  assert.ok(s.position < 16, `position ${s.position}`);
  s = (await call('/api/control', 'POST', { action: 'filter', value: 'bassboost' })).data;
  s = await waitFor((st) => !st.loading && st.filter === 'bassboost' && st.position > 10);
  assert.equal(s.volume, 35);
  const bad = await call('/api/control', 'POST', { action: 'filter', value: 'nope' });
  assert.equal(bad.status, 500);
});

test('skip and previous move through history', async () => {
  let s = (await call('/api/state')).data;
  const first = s.current.title;
  const next = s.queue[0].title;
  await call('/api/control', 'POST', { action: 'skip' });
  s = await waitFor((st) => st.current && st.current.title === next && !st.loading);
  assert.equal(s.history[0].title, first);
  await call('/api/control', 'POST', { action: 'previous' });
  s = await waitFor((st) => st.current && st.current.title === first && !st.loading);
  assert.equal(s.queue[0].title, next);
});

test('track ends by itself and the next one starts', async () => {
  await call('/api/control', 'POST', { action: 'clear' });
  await call('/api/queue', 'POST', { query: `${BASE}/track2.html` });
  let s = (await call('/api/state')).data;
  await call('/api/control', 'POST', { action: 'seek', value: 21 }); // song1 is 25 s long
  s = await waitFor((st) => st.current && /Kupferhimmel/.test(st.current.title) && !st.loading, 15000);
  assert.equal(s.queue.length, 0);
});

test('server-sent events push live state', async () => {
  const res = await fetch(`${API}/api/events?token=${encodeURIComponent(token)}`);
  const reader = res.body.getReader();
  let text = '';
  const end = Date.now() + 4000;
  while (Date.now() < end && !text.includes('event: tick')) {
    const { value } = await reader.read();
    text += new TextDecoder().decode(value);
  }
  reader.cancel();
  assert.match(text, /event: state/);
  assert.match(text, /event: tick/);
});

test('client supplied tracks are sanitised', async () => {
  const r = await call('/api/queue', 'POST', { tracks: [{ url: 'file:///etc/passwd', title: 'x' }, { query: 'abc', title: 'ok', thumbnail: 'javascript:1' }] });
  assert.equal(r.data.added, 1);
  const s = (await call('/api/state')).data;
  const t = s.queue.at(-1);
  assert.equal(t.title, 'ok');
  assert.equal(t.thumbnail, null);
});

test('stop clears everything', async () => {
  const s = (await call('/api/control', 'POST', { action: 'stop' })).data;
  assert.equal(s.current, null);
  assert.equal(s.queue.length, 0);
});
