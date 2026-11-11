import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import dgram from 'node:dgram';
import { DEFAULTS, merge } from '../src/defaults.js';
import { buildMessage, fill, parseDuration } from '../src/render.js';
import { check } from '../src/modules/automod.js';
import { due } from '../src/modules/timers.js';
import { parseFeed } from '../src/modules/social.js';
import { levelOf, need, totalFor } from '../src/modules/levels.js';
import { pingBedrock, pingJava, plain, splitAddress } from '../src/modules/mcping.js';

test('merge keeps types and drops unknown keys', () => {
  const m = merge(DEFAULTS.levels, { xpMin: '20', xpMax: 'x', evil: 1, rewards: [{ level: 5, role: '1' }], announce: 3 });
  assert.equal(m.xpMin, 20);
  assert.equal(m.xpMax, 25);
  assert.equal(m.evil, undefined);
  assert.equal(m.announce, 'current');
  assert.deepEqual(m.rewards, [{ level: 5, role: '1' }]);
  assert.equal(merge(DEFAULTS.welcome, undefined).message.embed.enabled, true);
});

test('placeholders and messages', () => {
  assert.equal(fill('Hi {user.name} on {server} {unknown}', { 'user.name': 'Max', server: 'S' }), 'Hi Max on S {unknown}');
  const cfg = { embeds: { profiles: [{ id: 'p', color: '#ff0000', footer: { text: 'F {server}' }, author: {} }] }, general: { profile: 'p' } };
  const m = buildMessage({ content: 'x', embed: { enabled: true, title: 'T {server}', url: 'nope' } }, { server: 'S' }, cfg);
  assert.equal(m.embeds[0].color, 0xff0000);
  assert.equal(m.embeds[0].title, 'T S');
  assert.equal(m.embeds[0].footer.text, 'F S');
  assert.equal(m.embeds[0].url, undefined);
  assert.equal(buildMessage({ content: '  ', embed: { enabled: false } }), null);
  assert.equal(parseDuration('1h 30m'), 90 * 60000);
  assert.equal(parseDuration('15'), 15 * 60000);
});

test('auto-mod rules', () => {
  const cfg = merge(DEFAULTS.automod, { badwords: { on: true, words: ['doof', 'sch*ße'], wildcard: false, action: 'delete' }, caps: { on: true, percent: 70, min: 5 } });
  assert.equal(check(cfg, 'du bist d00f')[0], 'badwords');
  assert.equal(check(cfg, 'bodoofen'), null);
  assert.equal(check(cfg, 'join discord.gg/abc')[0], 'invites');
  assert.equal(check(cfg, 'HALLO LEUTE WAS GEHT')[0], 'caps');
  assert.equal(check(cfg, 'hallo')?.[0], undefined);
  const h = Array.from({ length: 6 }, () => ({ t: Date.now(), c: 'a' }));
  assert.equal(check(cfg, 'a', { history: h })[0], 'spam');
});

test('timers', () => {
  const now = new Date(2026, 10, 11, 18, 3);
  assert.equal(due({ mode: 'daily', time: '18:00', channel: '1' }, 0, now), true);
  assert.equal(due({ mode: 'daily', time: '18:00', channel: '1' }, now.getTime() - 60000, now), false);
  assert.equal(due({ mode: 'weekly', time: '18:00', days: [3], channel: '1' }, 0, now), true);
  assert.equal(due({ mode: 'weekly', time: '18:00', days: [1], channel: '1' }, 0, now), false);
  assert.equal(due({ mode: 'interval', every: 30, channel: '1' }, now.getTime() - 10 * 60000, now), false);
});

test('feeds', () => {
  const xml = `<feed><entry><id>yt:video:abc</id><yt:videoId>abc</yt:videoId><title>Neu &amp; frisch</title><link rel="alternate" href="https://www.youtube.com/watch?v=abc"/><author><name>Kanal</name></author></entry></feed>`;
  const [e] = parseFeed(xml);
  assert.equal(e.id, 'abc');
  assert.equal(e.title, 'Neu & frisch');
  assert.equal(e.author, 'Kanal');
  const rss = '<rss><channel><item><title><![CDATA[Post]]></title><link>https://x.y/1</link><guid>g1</guid></item></channel></rss>';
  assert.equal(parseFeed(rss)[0].id, 'g1');
});

test('levels', () => {
  assert.equal(need(0), 100);
  assert.deepEqual(levelOf(0), { level: 0, into: 0, next: 100 });
  assert.equal(levelOf(totalFor(10)).level, 10);
  assert.equal(levelOf(totalFor(10) - 1).level, 9);
});

function varint(n) { const o = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return Buffer.from(o); }

test('java status ping against a fake server', async () => {
  const json = JSON.stringify({ version: { name: '1.21.4', protocol: 769 }, players: { max: 20, online: 3, sample: [{ name: 'Steve', id: 'x' }] }, description: { text: '§aHallo ', extra: [{ text: 'Welt' }] } });
  const srv = net.createServer((s) => {
    s.once('data', () => {
      const body = Buffer.concat([varint(0), varint(Buffer.byteLength(json)), Buffer.from(json)]);
      s.end(Buffer.concat([varint(body.length), body]));
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const r = await pingJava('127.0.0.1', srv.address().port);
  srv.close();
  assert.equal(r.online, true);
  assert.equal(r.players, 3);
  assert.equal(r.max, 20);
  assert.deepEqual(r.list, ['Steve']);
  assert.equal(r.motd, 'Hallo Welt');
  assert.equal(r.version, '1.21.4');
});

test('bedrock ping against a fake server', async () => {
  const sock = dgram.createSocket('udp4');
  sock.on('message', (m, rinfo) => {
    const s = Buffer.from('MCPE;Bedrock Welt;712;1.21.40;4;10;123;Level;Survival;1;19132;19133;');
    const out = Buffer.alloc(35 + s.length);
    out[0] = 0x1c; m.copy(out, 1, 1, 9); Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex').copy(out, 17);
    out.writeUInt16BE(s.length, 33); s.copy(out, 35);
    sock.send(out, rinfo.port, rinfo.address);
  });
  await new Promise((r) => sock.bind(0, '127.0.0.1', r));
  const r = await pingBedrock('127.0.0.1', sock.address().port);
  sock.close();
  assert.equal(r.players, 4);
  assert.equal(r.max, 10);
  assert.equal(r.version, '1.21.40');
});

test('offline server and address parsing', async () => {
  await assert.rejects(pingJava('127.0.0.1', 1, 2000));
  assert.deepEqual(splitAddress('play.x.de:25570', 'java'), { host: 'play.x.de', port: 25570 });
  assert.deepEqual(splitAddress('play.x.de', 'bedrock'), { host: 'play.x.de', port: 19132 });
  assert.equal(plain('§cRot'), 'Rot');
});
