// Owner-only tools: hidden from everyone else, blocking, invisible mode (MOCK=1, no audio needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const OWNER = '1073620742081617930';
const PORT = 8097;
const API = `http://127.0.0.1:${PORT}`;
const SECRET = 'owner-test-secret';
process.env.SESSION_SECRET = SECRET;
const { createToken } = await import('../src/auth.js');

let proc;
let owner;
const other = createToken({ userId: '42', guildId: 'test-guild', userName: 'Kevin' });

async function call(token, path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

test.before(async () => {
  proc = fork(fileURLToPath(new URL('../src/index.js', import.meta.url)), {
    env: { ...process.env, SESSION_SECRET: SECRET, MOCK_USER: OWNER, SETTINGS_FILE: `/tmp/msik-owner-settings-${process.pid}.json`, PLAYLISTS_FILE: `/tmp/msik-owner-pl-${process.pid}.json`, MOCK: '1', TUNNEL: 'off', PORT: String(PORT), NO_PROXY: '127.0.0.1,localhost' },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  });
  owner = await new Promise((resolve, reject) => {
    proc.once('message', (m) => resolve(m.token));
    proc.once('exit', (c) => reject(new Error(`exit ${c}`)));
  });
});
test.after(() => proc?.kill());

test('only the owner sees the tools', async () => {
  assert.equal((await call(owner, '/api/session')).data.user.ctl, true);
  assert.equal((await call(other, '/api/session')).data.user.ctl, undefined);
  assert.equal((await call(owner, '/api/ctl/people')).status, 200);
  assert.equal((await call(other, '/api/ctl/people')).status, 404);
});

test('people in the session are listed', async () => {
  const ctrl = new AbortController();
  await fetch(`${API}/api/events?token=${encodeURIComponent(other)}`, { signal: ctrl.signal });
  const { people } = (await call(owner, '/api/ctl/people')).data;
  assert.ok(people.some((v) => v.name === 'Kevin' && v.id === '42'));
  ctrl.abort();
});

test('block and unblock by name or ID', async () => {
  let r = await call(owner, '/api/ctl/action', 'POST', { action: 'block', value: 'kevin' });
  assert.deepEqual(r.data.blocked, ['kevin']);
  assert.equal((await call(other, '/api/state')).status, 403);
  await call(owner, '/api/ctl/action', 'POST', { action: 'unblock', value: 'Kevin' });
  assert.equal((await call(other, '/api/state')).status, 200);
  await call(owner, '/api/ctl/action', 'POST', { action: 'block', value: '<@42>' });
  assert.equal((await call(other, '/api/state')).status, 403);
  r = await call(owner, '/api/ctl/action', 'POST', { action: 'unblock', value: '42' });
  assert.deepEqual(r.data.blocked, []);
  assert.equal((await call(owner, '/api/ctl/action', 'POST', { action: 'block', value: OWNER })).status, 400);
});

test('invisible mode keeps the owner out of the activity list', async () => {
  await call(owner, '/api/ctl/action', 'POST', { action: 'hidden', on: true });
  await call(owner, '/api/control', 'POST', { action: 'volume', value: 30 });
  let s = (await call(owner, '/api/state')).data;
  assert.equal(s.activity.filter((a) => a.action === 'volume').length, 0);
  await call(owner, '/api/ctl/action', 'POST', { action: 'hidden', on: false });
  await call(owner, '/api/control', 'POST', { action: 'volume', value: 40 });
  s = (await call(owner, '/api/state')).data;
  assert.equal(s.activity.filter((a) => a.action === 'volume').length, 1);
});

test('pranks: only the owner account, nobody else (not even a hint)', async () => {
  assert.equal((await call(other, '/api/prank')).status, 404);
  assert.equal((await call(other, '/api/prank/members')).status, 404);
  assert.equal((await call(other, '/api/prank/start', 'POST', { type: 'disconnect', target: '42' })).status, 404);
  assert.equal((await call(other, '/api/prank/stop', 'POST', { all: true })).status, 404);
  assert.equal((await call(other, '/api/ctl/profile')).status, 404);
  assert.equal((await call(other, '/api/session')).data.user.prank, undefined);
  const share = await call(owner, '/api/share', 'POST');
  assert.equal((await call(share.data.token, '/api/prank')).status, 404); // a shared link of the owner is not the owner
  const me = await call(owner, '/api/prank');
  assert.equal(me.status, 200);
  assert.ok(me.data.catalog.length >= 22);
  assert.ok(me.data.catalog.some((p) => p.id === 'musicraid'));
  assert.equal((await call(owner, '/api/session')).data.user.prank, true);
  assert.equal((await call(owner, '/api/ctl/profile')).status, 200);
});
