import { GuildPlayer } from './player.js';
import { createToken } from './auth.js';
import { config } from './config.js';
import { log } from './log.js';
import { createPranks } from './pranks.js';

const CHANNELS = [
  { id: 'voice-1', name: 'Musik', category: 'Sprachkanäle', users: 1, canSpeak: true },
  { id: 'voice-2', name: 'Chillen', category: 'Sprachkanäle', users: 0, canSpeak: true },
];

// every test server id gets its own name, so several servers can be tried side by side
const guildName = (id) => (id === 'test-guild' ? 'Testserver' : `Testserver ${id}`);

/** Runs the API without Discord, for local testing of the dashboard and the audio pipeline. */
export function createMockBot() {
  const players = new Map();
  let publicUrl = '';
  const getPlayer = (gid) => {
    if (!players.has(gid)) {
      players.set(gid, new GuildPlayer(gid, { connect: async (id) => ({ id, name: CHANNELS.find((c) => c.id === id)?.name || 'Musik' }) }));
    }
    return players.get(gid);
  };
  let mem = { list: [] };
  const pranks = createPranks({ client: () => null, log, load: () => mem, save: (d) => { mem = d; }, music: async () => {} });
  const profile = { id: '1', name: 'Msik Test', avatar: null, nick: '' };
  return {
    getPlayer, pranks,
    getProfile: async () => ({ ...profile }),
    setProfile: async (gid, b) => { if (b.name) profile.name = b.name; if (typeof b.nick === 'string') profile.nick = b.nick; return { ...profile }; },
    inviteUrl: () => null,
    activeCount: () => [...players.values()].filter((p) => p.current && !p.paused).length,
    getName: () => 'Msik Test',
    getGuildInfo: async (id) => ({ id, name: guildName(id), icon: null }),
    getVoiceChannels: async () => CHANNELS,
    getTextChannels: async () => [{ id: 'text-1', name: 'musik-log', category: 'Text', canPost: true }, { id: 'text-2', name: 'allgemein', category: 'Text', canPost: false }],
    getStats: () => ({
      user: 'Msik Test#0000',
      guilds: [...players.entries()].map(([id, p]) => ({
        id, name: guildName(id), icon: null, members: 3, playing: p.current?.title || null, channel: p.channel?.name || null,
        queue: p.queue.length, paused: !!p.paused, volume: p.volume, filter: p.filter !== 'none' ? p.filter : null,
      })),
    }),
    stopAll: () => { for (const p of players.values()) p.leave(); },
    getMember: async (gid, uid) => ({ id: uid, voiceChannelId: 'voice-1' }),
    setPublicUrl: (u) => { publicUrl = u; },
    start: async () => {
      const token = createToken({ userId: process.env.MOCK_USER || '1', guildId: 'test-guild', userName: 'Tester' });
      const link = `${config.dashboardUrl}#api=${encodeURIComponent(publicUrl)}&t=${encodeURIComponent(token)}`;
      log.info(`Testmodus. Dashboard-Link:\n${link}`);
      if (process.send) process.send({ token, link });
    },
  };
}
