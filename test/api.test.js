import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aio-test-'));
process.env.NO_LOG_FILE = '1';
process.env.OWNER_ID = '1';

const { createBot } = await import('../src/bot.js');
const { createApi } = await import('../src/api.js');
const { createToken } = await import('../src/auth.js');
const { fakeClient } = await import('./fake.js');

const { client, sent } = fakeClient();
const bot = createBot({ client });
const server = createApi(bot);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const token = createToken({ userId: '1', guildId: '900', userName: 'Sebastian' });
const call = async (p, method = 'GET', body) => {
  const res = await fetch(base + p, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json() };
};

test.after(() => server.close());

test('health and auth', async () => {
  const h = await (await fetch(`${base}/health`)).json();
  assert.equal(h.name, 'aio');
  const r = await fetch(`${base}/api/config`);
  assert.equal(r.status, 401);
});

test('session, guild info and config', async () => {
  const s = await call('/api/session');
  assert.equal(s.data.user.owner, true);
  assert.equal(s.data.guild.name, 'Testserver');
  const g = await call('/api/guild');
  assert.ok(g.data.channels.some((c) => c.type === 'category'));
  assert.ok(g.data.roles.find((r) => r.name === 'Owner' && !r.assignable));
  const c = await call('/api/config');
  assert.equal(c.data.moderation.enabled, true);
});

test('saving a module sanitizes and runs hooks', async () => {
  const r = await call('/api/config/general', 'PUT', { nickname: 'Helfer', bogus: 1 });
  assert.equal(r.data.nickname, 'Helfer');
  assert.equal(r.data.bogus, undefined);
  assert.equal(client.guilds.cache.get('900').members.me.nickname, 'Helfer');
  const bad = await call('/api/config/nope', 'PUT', {});
  assert.equal(bad.status, 404);
});

test('send and edit a message', async () => {
  const msg = { content: 'Hallo {server}', embed: { enabled: true, title: 'Regeln', description: 'Sei nett' } };
  const r = await call('/api/message', 'POST', { channel: '12', message: msg });
  assert.equal(r.status, 200);
  assert.equal(sent.at(-1).body.content, 'Hallo Testserver');
  assert.equal(sent.at(-1).body.embeds[0].title, 'Regeln');
  const e = await call('/api/message', 'POST', { channel: '12', messageId: r.data.id, message: { content: 'neu', embed: { enabled: false } } });
  assert.equal(e.status, 200);
  const l = await call('/api/sent');
  assert.equal(l.data.length, 1);
});

test('reaction role panel publishes', async () => {
  await call('/api/config/reactionroles', 'PUT', { panels: [{ id: 'p1', name: 'Farben', channel: '21', type: 'buttons', mode: 'normal', message: { content: 'Wähle', embed: { enabled: false } }, items: [{ role: '31', label: 'Grün', emoji: '🟢', style: 'green' }] }] });
  const r = await call('/api/rr/p1/publish', 'POST', {});
  assert.equal(r.status, 200);
  assert.ok(sent.at(-1).body.components[0]);
  const c = await call('/api/config');
  assert.equal(c.data.reactionroles.panels[0].messageId, r.data.messageId);
});

test('owner routes and profile', async () => {
  const p = await call('/api/bot/profile', 'POST', { name: 'Labbi' });
  assert.equal(p.data.name, 'Labbi');
  const s = await call('/api/owner/servers');
  assert.equal(s.data.length, 1);
  const pr = await call('/api/bot/presence', 'PUT', { status: 'idle', activities: [{ type: 'watching', text: '{servers} Server' }] });
  assert.equal(pr.data.status, 'idle');
});

test('giveaway start and end', async () => {
  const g = await call('/api/giveaways', 'POST', { channel: '21', prize: 'Nitro', duration: '1h', winners: 1 });
  assert.equal(g.status, 200);
  const e = await call(`/api/giveaways/${g.data.id}/end`, 'POST', {});
  assert.equal(e.data.ended, true);
});

test('minecraft overview without servers', async () => {
  const r = await call('/api/mc');
  assert.deepEqual(r.data, []);
  const t = await call('/api/mc/test', 'POST', { host: '127.0.0.1', port: 1, edition: 'java' });
  assert.equal(t.data.online, false);
});
