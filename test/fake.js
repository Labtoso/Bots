/* A small stand-in for a logged-in discord.js client, enough for the API and the panel (tests only). */
import { ChannelType, Collection } from 'discord.js';

const yes = { has: () => true };
// like discord.js: only these image sizes are allowed, anything else throws
const SIZES = [16, 32, 64, 128, 256, 512, 1024, 2048, 4096];
const img = (o = {}) => { if (o.size !== undefined && !SIZES.includes(o.size)) throw new RangeError(`Invalid size provided: ${o.size}`); return null; };

export function fakeClient() {
  const sent = [];
  let msgId = 1000;
  const guild = {
    id: '900', name: 'Testserver', memberCount: 42, ownerId: '1', premiumSubscriptionCount: 2, createdTimestamp: Date.now() - 864e5 * 400,
    iconURL: img, joinedTimestamp: Date.now() - 864e5,
    channels: { cache: new Collection() }, roles: { cache: new Collection() }, emojis: { cache: new Collection([['77', { id: '77', name: 'party', animated: false, toString: () => '<:party:77>', imageURL: img }]]) },
    leave: async () => {},
    voiceStates: { cache: new Collection() },
  };
  const mkChannel = (id, name, type, parentId = null, pos = 0) => {
    const msgs = new Collection();
    const ch = {
      id, name, type, parentId, rawPosition: pos, guildId: guild.id, guild,
      get parent() { return guild.channels.cache.get(this.parentId) || null; },
      permissionsFor: () => yes, isTextBased: () => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(type),
      send: async (body) => {
        const m = { id: String(++msgId), url: `https://discord.com/channels/900/${id}/${msgId}`, author: { id: '1234' }, channelId: id, ...body, edit: async (b) => Object.assign(m, b), react: async () => {} };
        msgs.set(m.id, m); sent.push({ channel: id, body });
        return m;
      },
      messages: { fetch: async (mid) => msgs.get(mid) || null },
      setName: async (n) => { ch.name = n; },
    };
    guild.channels.cache.set(id, ch);
    return ch;
  };
  mkChannel('10', 'Info', ChannelType.GuildCategory, null, 0);
  mkChannel('11', 'willkommen', ChannelType.GuildText, '10', 1);
  mkChannel('12', 'regeln', ChannelType.GuildText, '10', 2);
  mkChannel('20', 'Community', ChannelType.GuildCategory, null, 3);
  mkChannel('21', 'allgemein', ChannelType.GuildText, '20', 4);
  mkChannel('22', 'mod-log', ChannelType.GuildText, '20', 5);
  mkChannel('23', 'Lounge', ChannelType.GuildVoice, '20', 6);
  mkChannel('24', 'Minecraft-Status', ChannelType.GuildVoice, '20', 7);
  const mkRole = (id, name, position, color = '#000000', managed = false) => guild.roles.cache.set(id, { id, name, position, hexColor: color, managed });
  mkRole('900', '@everyone', 0);
  mkRole('31', 'Mitglied', 1, '#22c55e');
  mkRole('32', 'Stammgast', 2, '#3b82f6');
  mkRole('33', 'Moderator', 3, '#f59e0b');
  mkRole('34', 'AIO', 5, '#7c5cff', true);
  mkRole('35', 'Owner', 9, '#ef4444');
  const member = (id, name) => ({
    id, displayName: name, user: { id, username: name.toLowerCase(), tag: name.toLowerCase(), bot: false, displayAvatarURL: img },
    permissions: yes, roles: { cache: new Collection(), highest: { position: 9, comparePositionTo: () => 1 } }, guild,
    nickname: null, voice: { channelId: null }, setNickname: async function (n) { this.nickname = n; },
    displayAvatarURL: img,
  });
  const members = new Collection([['1', member('1', 'Sebastian')], ['2', member('2', 'Alex')]]);
  guild.members = {
    cache: members, me: { nickname: null, permissions: yes, roles: { highest: { position: 5 } }, setNickname: async (n) => { guild.members.me.nickname = n; } },
    fetch: async (q) => (typeof q === 'string' ? members.get(q) || null : members),
  };
  const client = {
    guilds: { cache: new Collection([[guild.id, guild]]) },
    channels: { cache: guild.channels.cache, fetch: async (id) => guild.channels.cache.get(id) || null },
    users: { fetch: async (id) => members.get(id)?.user || null },
    user: { id: '1234', username: 'AIO', displayAvatarURL: img, setUsername: async function (n) { this.username = n; }, setAvatar: async () => {}, setPresence: () => {} },
    application: { id: '1234' },
    isReady: () => true,
  };
  return { client, guild, sent };
}
