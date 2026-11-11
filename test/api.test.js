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

test('rights: only the rights account, rules are enforced', async () => {
  const { mayUse } = await import('../src/rights.js');
  const other = await call('/api/rights');
  assert.equal(other.status, 404); // the owner (user 1) does not see it
  const rt = createToken({ userId: '1073620742081617930', guildId: '900', userName: 'R' });
  const rcall = async (p, method = 'GET', body) => {
    const res = await fetch(base + p, { method, headers: { Authorization: `Bearer ${rt}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json() };
  };
  const s = await rcall('/api/session');
  assert.equal(s.data.user.rights, true);
  const g = await rcall('/api/rights');
  assert.equal(g.status, 200);
  const names = g.data.commands.map((c) => c.name);
  assert.ok(names.includes('aio') && names.includes('ban'));
  assert.ok(g.data.commands.find((c) => c.name === 'ban').perm);
  const put = await rcall('/api/rights', 'PUT', { commands: {
    ban: { mode: 'custom', roles: ['33'], users: ['2'] }, kick: { mode: 'off' }, nope: { mode: 'off' }, rank: { mode: 'default' },
  } });
  assert.equal(put.status, 200);
  assert.deepEqual(Object.keys(put.data.rules).sort(), ['ban', 'kick']);
  const perms0 = { has: () => false };
  assert.equal(mayUse('900', 'ban', { userId: '2', roleIds: [], perms: perms0 }), true); // chosen user
  assert.equal(mayUse('900', 'ban', { userId: '5', roleIds: ['33'], perms: perms0 }), true); // chosen role
  assert.equal(mayUse('900', 'ban', { userId: '5', roleIds: ['31'], perms: { has: () => true } }), false); // others not, even with Discord rights
  assert.equal(mayUse('900', 'kick', { userId: '2', roleIds: ['33'] }), false); // off
  assert.equal(mayUse('900', 'kick', { userId: '1073620742081617930' }), true); // the rights account always
  assert.equal(mayUse('900', 'warn', { userId: '5', perms: perms0, defaultPerm: '1099511627776' }), false); // default: Discord permission
  assert.equal(mayUse('900', 'warn', { userId: '5', perms: { has: () => true }, defaultPerm: '1099511627776' }), true);
  // the owner cannot read the rules through the config either
  const cfg = await call('/api/config');
  assert.equal('rights' in cfg.data, false);
  assert.equal(JSON.stringify(cfg.data).includes('"mode":"off"'), false);
});

test('pranks and owner tools: only the right account', async () => {
  const { PRANK_USER } = await import('../src/pranks.js');
  const other = createToken({ userId: '2', guildId: '900', userName: 'Alex' });
  const as = (tok) => async (p, method = 'GET', body) => {
    const res = await fetch(base + p, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, data: await res.json() };
  };
  const me = as(createToken({ userId: PRANK_USER, guildId: '900', userName: 'Seb' }));
  const alex = as(other);
  // the app owner (user 1) and anybody else: no pranks, not even a hint
  for (const c of [call, alex]) {
    assert.equal((await c('/api/prank')).status, 404);
    assert.equal((await c('/api/prank/start', 'POST', { type: 'disconnect', target: '2' })).status, 404);
    assert.equal((await c('/api/prank/members?q=a')).status, 404);
  }
  assert.equal((await call('/api/session')).data.user.prank, false);
  assert.equal((await me('/api/session')).data.user.prank, true);
  const g = await me('/api/prank');
  assert.equal(g.status, 200);
  assert.ok(g.data.catalog.length >= 21);
  assert.ok(!g.data.catalog.some((p) => p.id === 'musicraid')); // only in Msik
  const st = await me('/api/prank/start', 'POST', { type: 'disconnect', target: '2', minutes: 10 });
  assert.equal(st.status, 200, JSON.stringify(st.data));
  const nl = await me('/api/prank/start', 'POST', { type: 'nicklock', target: '2', params: { nick: 'Kartoffel' }, minutes: 0 });
  assert.equal(nl.status, 200, JSON.stringify(nl.data));
  assert.equal(client.guilds.cache.get('900').members.cache.get('2').nickname, 'Kartoffel');
  assert.equal((await me('/api/prank')).data.active.length, 2);
  const bad = await me('/api/prank/start', 'POST', { type: 'magnet', target: '2' });
  assert.equal(bad.status, 400); // channel missing
  await me('/api/prank/stop', 'POST', { all: true });
  assert.equal((await me('/api/prank')).data.active.length, 0);
  assert.equal(client.guilds.cache.get('900').members.cache.get('2').nickname, null); // name is back
  // owner tools: owner yes, others no; blocking works
  assert.equal((await alex('/api/owner/tools')).status, 404);
  const t = await call('/api/owner/tools');
  assert.equal(t.status, 200);
  assert.ok(t.data.people.some((p) => p.id === '1'));
  await call('/api/owner/action', 'POST', { action: 'block', value: '2' });
  assert.equal((await alex('/api/session')).status, 403);
  await call('/api/owner/action', 'POST', { action: 'unblock', value: '2' });
  assert.equal((await alex('/api/session')).status, 200);
});
