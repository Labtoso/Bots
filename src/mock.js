import { GuildPlayer } from './player.js';
import { createToken } from './auth.js';
import { config } from './config.js';
import { log } from './log.js';

const CHANNELS = [
  { id: 'voice-1', name: 'Musik', category: 'Sprachkanäle', users: 1, canSpeak: true },
  { id: 'voice-2', name: 'Chillen', category: 'Sprachkanäle', users: 0, canSpeak: true },
];

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
  return {
    getPlayer,
    activeCount: () => [...players.values()].filter((p) => p.current && !p.paused).length,
    getName: () => 'Msik Test',
    getGuildInfo: async (id) => ({ id, name: 'Testserver', icon: null }),
    getVoiceChannels: async () => CHANNELS,
    getMember: async (gid, uid) => ({ id: uid, voiceChannelId: 'voice-1' }),
    setPublicUrl: (u) => { publicUrl = u; },
    start: async () => {
      const token = createToken({ userId: '1', guildId: 'test-guild', userName: 'Tester' });
      const link = `${config.dashboardUrl}#api=${encodeURIComponent(publicUrl)}&t=${encodeURIComponent(token)}`;
      log.info(`Testmodus. Dashboard-Link:\n${link}`);
      if (process.send) process.send({ token, link });
    },
  };
}
