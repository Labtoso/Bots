import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYtdlpJson } from '../src/resolve.js';
import { createToken, verifyToken } from '../src/auth.js';

test('YouTube search results get title, channel, duration and cover', () => {
  const json = JSON.stringify({
    _type: 'playlist', title: 'lofi',
    entries: [
      { ie_key: 'Youtube', id: 'abcdefghijk', title: 'Lofi Mix', channel: 'Some Channel', duration: 3605.4, url: 'https://www.youtube.com/watch?v=abcdefghijk' },
      { ie_key: 'Youtube', id: 'zzzzzzzzzzz', title: '[Deleted video]' },
    ],
  });
  const { playlist, tracks } = parseYtdlpJson(json);
  assert.equal(playlist, 'lofi');
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].title, 'Lofi Mix');
  assert.equal(tracks[0].artist, 'Some Channel');
  assert.equal(tracks[0].duration, 3605);
  assert.equal(tracks[0].thumbnail, 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
  assert.equal(tracks[0].source, 'youtube');
});

test('single video prefers the biggest thumbnail and track/artist tags', () => {
  const { tracks } = parseYtdlpJson(JSON.stringify({
    extractor_key: 'Youtube', id: 'x', title: 'Artist - Song (Official Video)', track: 'Song', artist: 'Artist',
    duration: 200, webpage_url: 'https://www.youtube.com/watch?v=x',
    thumbnails: [{ url: 'small', width: 120, height: 90 }, { url: 'big', width: 1280, height: 720 }],
  }));
  assert.equal(tracks[0].title, 'Song');
  assert.equal(tracks[0].artist, 'Artist');
  assert.equal(tracks[0].thumbnail, 'big');
});

test('tokens are bound to user and server and can not be forged', () => {
  const t = createToken({ userId: '42', guildId: '7', userName: 'Seb' });
  assert.deepEqual({ u: verifyToken(t).u, g: verifyToken(t).g }, { u: '42', g: '7' });
  const [payload, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ u: '42', g: '8', exp: Date.now() + 1e6 })).toString('base64url');
  assert.equal(verifyToken(`${forged}.${sig}`), null);
  assert.equal(verifyToken(`${payload}.x`), null);
  assert.equal(verifyToken('nope'), null);
});
