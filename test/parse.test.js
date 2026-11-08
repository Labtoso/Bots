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

test('fast YouTube search reads videos and playlists from real responses', async () => {
  const { parseSearch } = await import('../src/youtube.js');
  const fs = await import('node:fs');
  const zlib = await import('node:zlib');
  const load = (f) => JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url))));
  const v = parseSearch(load('yt-search-videos.json.gz'));
  assert.ok(v.videos.length >= 10);
  assert.equal(v.videos[0].url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(v.videos[0].artist, 'Rick Astley');
  assert.equal(v.videos[0].duration, 214);
  assert.match(v.videos[0].thumbnail, /^https:\/\/i\.ytimg\.com\/vi\/dQw4w9WgXcQ\//);
  const p = parseSearch(load('yt-search-playlists.json.gz'));
  assert.ok(p.playlists.length >= 10);
  for (const pl of p.playlists) {
    assert.match(pl.url, /^https:\/\/www\.youtube\.com\/playlist\?list=[\w-]+$/);
    assert.ok(pl.title);
  }
  assert.equal(p.playlists[0].count, 60);
  assert.equal(p.playlists[0].artist, 'just.rick_6');
});

test('Spotify search results become tracks that play through YouTube', async () => {
  const { parseSpotifySearch } = await import('../src/spotify.js');
  const r = parseSpotifySearch({
    tracks: { items: [{ name: 'Get Lucky', duration_ms: 248413, artists: [{ name: 'Daft Punk' }, { name: 'Pharrell Williams' }], album: { images: [{ url: 's', width: 64 }, { url: 'big', width: 640 }] } }] },
    playlists: { items: [null, { id: 'p1', type: 'playlist', name: 'Funk', owner: { display_name: 'Spotify' }, tracks: { total: 50 }, images: [{ url: 'pi' }], external_urls: { spotify: 'https://open.spotify.com/playlist/p1' } }] },
    albums: { items: [{ id: 'a1', type: 'album', name: 'RAM', artists: [{ name: 'Daft Punk' }], total_tracks: 13, images: [] }] },
  });
  assert.equal(r.tracks[0].query, 'Daft Punk, Pharrell Williams - Get Lucky');
  assert.equal(r.tracks[0].duration, 248);
  assert.equal(r.tracks[0].thumbnail, 'big');
  assert.equal(r.tracks[0].url, null);
  assert.deepEqual(r.playlists.map((p) => [p.title, p.count, p.url]), [['Funk', 50, 'https://open.spotify.com/playlist/p1'], ['RAM', 13, 'https://open.spotify.com/album/a1']]);
});
