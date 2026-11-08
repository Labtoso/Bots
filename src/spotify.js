import crypto from 'node:crypto';
import { config } from './config.js';

/*
 * Spotify search through the official Web API (Client Credentials flow).
 * Needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET from a free app on developer.spotify.com.
 * Spotify only supplies titles and covers; playback looks the song up on YouTube.
 */

const uid = () => crypto.randomBytes(6).toString('hex');
let token = null;

export const spotifyReady = () => !!(config.spotifyId && config.spotifySecret);

async function getToken() {
  if (token && token.until > Date.now()) return token.value;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic ${Buffer.from(`${config.spotifyId}:${config.spotifySecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(res.status === 400 || res.status === 401 ? 'SPOTIFY_BAD_KEYS' : `Spotify ${res.status}`);
  const data = await res.json();
  token = { value: data.access_token, until: Date.now() + (data.expires_in - 60) * 1000 };
  return token.value;
}

const img = (images) => (images || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || null;

export function parseSpotifySearch(data) {
  const tracks = (data.tracks?.items || []).filter(Boolean).map((t) => {
    const artist = (t.artists || []).map((a) => a.name).join(', ');
    return {
      id: uid(), title: t.name, artist, duration: Math.round((t.duration_ms || 0) / 1000),
      thumbnail: img(t.album?.images), url: null, source: 'spotify', query: `${artist} - ${t.name}`,
    };
  });
  const playlists = [...(data.playlists?.items || []), ...(data.albums?.items || [])].filter(Boolean).map((p) => ({
    id: p.id,
    title: p.name,
    artist: p.owner?.display_name || (p.artists || []).map((a) => a.name).join(', ') || '',
    count: p.tracks?.total ?? p.total_tracks ?? null,
    thumbnail: img(p.images),
    url: p.external_urls?.spotify || `https://open.spotify.com/${p.type}/${p.id}`,
  }));
  return { tracks, playlists };
}

export async function spotifySearch(query, { limit = 8, playlists = 3 } = {}) {
  if (!spotifyReady()) throw new Error('SPOTIFY_NOT_SET');
  const url = `https://api.spotify.com/v1/search?type=track,playlist,album&limit=${limit}&market=DE&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${await getToken()}` }, signal: AbortSignal.timeout(6000) });
  if (res.status === 401) { token = null; throw new Error('Spotify-Anmeldung abgelaufen, bitte nochmal suchen'); }
  if (!res.ok) throw new Error(`Spotify ${res.status}`);
  const r = parseSpotifySearch(await res.json());
  return { tracks: r.tracks.slice(0, limit), playlists: r.playlists.slice(0, playlists) };
}
