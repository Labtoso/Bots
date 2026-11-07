import { GuildPlayer } from './player.js';
import { createToken } from './auth.js';
import { config } from './config.js';
import { log } from './log.js';

/** Runs the API without Discord, for local testing of the dashboard and the audio pipeline. */
export function createMockBot() {
  const players = new Map();
  let publicUrl = '';
  const getPlayer = (gid) => {
    if (!players.has(gid)) {
      players.set(gid, new GuildPlayer(gid, { connect: async () => ({ id: 'voice-1', name: 'Musik' }) }));
    }
    return players.get(gid);
  };
  return {
    getPlayer,
    getGuildInfo: async (id) => ({ id, name: 'Testserver', icon: null }),
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
