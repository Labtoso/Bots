/*
 * Default settings of every module. They are also the schema: saving a module keeps only the
 * keys that exist here and takes over the type of the default value.
 */

export const EMBED = () => ({
  enabled: false, profile: '', color: '', author: { name: '', icon: '', url: '' }, title: '', url: '',
  description: '', fields: [], thumbnail: '', image: '', footer: { text: '', icon: '' }, timestamp: false,
});

/** A message as the dashboard edits it: plain text plus an optional embed. */
export const MSG = (content = '', embed = null) => ({ content, embed: { ...EMBED(), ...(embed || {}) } });

export const DEFAULTS = {
  general: {
    nickname: '', // bot name on this server
    profile: '', // default embed style profile for all bot messages
    managerRoles: [], // roles that may open the panel besides "Manage Server"
    panelChannelId: '', // /aio only works here (empty = everywhere)
    language: 'de',
  },

  moderation: {
    enabled: true,
    logChannel: '',
    dmUser: true,
    dmMessage: MSG('', { enabled: true, title: 'Moderation auf {server}', description: '**Aktion:** {action}\n**Grund:** {reason}\n**Dauer:** {duration}' }),
    requireReason: false,
    warnActions: [{ count: 3, action: 'timeout', minutes: 60 }, { count: 5, action: 'kick', minutes: 0 }],
    warnExpireDays: 0,
    muteDefaultMinutes: 10,
    publicReply: false,
  },

  automod: {
    enabled: false,
    logChannel: '',
    exemptRoles: [],
    exemptChannels: [],
    notify: 'Hey {user}, deine Nachricht wurde entfernt: {reason}',
    notifySeconds: 6,
    badwords: { on: true, words: [], wildcard: true, action: 'delete', minutes: 10 },
    invites: { on: true, action: 'delete', minutes: 10 },
    links: { on: false, allow: ['youtube.com', 'youtu.be', 'tenor.com', 'giphy.com'], action: 'delete', minutes: 10 },
    caps: { on: false, percent: 70, min: 12, action: 'delete', minutes: 10 },
    mentions: { on: true, max: 5, action: 'timeout', minutes: 10 },
    emojis: { on: false, max: 12, action: 'delete', minutes: 10 },
    spam: { on: true, count: 6, seconds: 5, action: 'timeout', minutes: 5 },
    duplicates: { on: false, count: 3, action: 'delete', minutes: 10 },
    newlines: { on: false, max: 20, action: 'delete', minutes: 10 },
    zalgo: { on: false, action: 'delete', minutes: 10 },
    strikes: { on: false, count: 3, hours: 1, action: 'timeout', minutes: 60 },
  },

  logs: {
    enabled: false,
    channel: '',
    ignoreChannels: [],
    ignoreBots: true,
    events: {
      messageDelete: true, messageEdit: true, bulkDelete: true,
      memberJoin: true, memberLeave: true, memberBan: true, memberUnban: true,
      nickname: true, roles: true, timeout: true,
      channelCreate: true, channelDelete: true, roleCreate: true, roleDelete: true,
      voice: false, invites: false,
    },
    channels: { messages: '', members: '', server: '', voice: '' },
  },

  welcome: {
    enabled: false,
    channel: '',
    message: MSG('Willkommen {user} auf **{server}**!', { enabled: true, title: 'Willkommen!', description: 'Schön, dass du da bist, {user}. Du bist Mitglied Nummer **{members}**.', thumbnail: '{user.avatar}' }),
    dmEnabled: false,
    dm: MSG('Willkommen auf {server}, {user.name}!'),
    goodbyeEnabled: false,
    goodbyeChannel: '',
    goodbye: MSG('**{user.name}** hat den Server verlassen.'),
    autoRoles: [],
    botRoles: [],
    autoRoleDelay: 0,
  },

  levels: {
    enabled: false,
    xpMin: 15,
    xpMax: 25,
    cooldown: 60,
    voiceXp: false,
    voiceXpPerMinute: 4,
    announce: 'current', // current | channel | dm | off
    announceChannel: '',
    levelUp: MSG('GG {user}, du bist jetzt **Level {level}**!'),
    rewards: [], // { level, role }
    stackRewards: true,
    noXpRoles: [],
    noXpChannels: [],
    multipliers: [], // { role, factor }
    resetOnLeave: false,
  },

  reactionroles: {
    panels: [], // { id, name, channel, messageId, message, type, mode, items: [{ emoji, role, label, style, description }] }
  },

  customcmds: {
    enabled: true,
    prefix: '!',
    commands: [], // see dashboard
  },

  embeds: {
    profiles: [
      { id: 'standard', name: 'Standard', color: '#5865F2', author: { name: '', icon: '', url: '' }, footer: { text: '', icon: '' }, thumbnail: '', image: '', timestamp: false },
    ],
    templates: [], // { id, name, message }
  },

  minecraft: {
    enabled: false,
    servers: [], // { id, name, host, port, edition, emoji, hideAddress }
    interval: 60,
    statusChannel: '',
    status: {
      title: 'Minecraft-Server', description: '', colorOnline: '#22c55e', colorOffline: '#ef4444', colorMixed: '#f59e0b',
      showPlayers: true, showPlayerList: true, showVersion: true, showMotd: false, showPing: false, showAddress: true,
      showUptime: true, onlineText: 'Online', offlineText: 'Offline', footer: 'Aktualisiert alle {interval} Sekunden',
    },
    announceChannel: '',
    announceRole: '',
    announceOnline: MSG('{server.emoji} **{server.name}** ist jetzt online!'),
    announceOffline: MSG('{server.emoji} **{server.name}** ist offline.'),
    counters: [], // { server, channel, online, offline }
    offlineAfter: 2, // failed checks before a server counts as offline
  },

  social: {
    enabled: false,
    interval: 5,
    feeds: [], // { id, type, target, channel, role, message, live, title }
  },

  timers: {
    enabled: false,
    messages: [], // { id, name, channel, message, mode, every, time, days, on }
  },

  birthdays: {
    enabled: false,
    channel: '',
    role: '',
    time: '09:00',
    message: MSG('Alles Gute zum Geburtstag, {user}! 🎂{age}'),
  },

  tickets: {
    enabled: false,
    category: '',
    supportRoles: [],
    logChannel: '',
    panelChannel: '',
    panelMessageId: '',
    panel: MSG('', { enabled: true, title: 'Support', description: 'Klick auf den Button, um ein Ticket zu öffnen.' }),
    buttonLabel: 'Ticket öffnen',
    buttonEmoji: '🎫',
    opened: MSG('{user}, danke für dein Ticket. Das Team meldet sich gleich.', { enabled: true, title: 'Ticket #{ticket}', description: 'Beschreib dein Anliegen. Mit dem Button unten schließt du das Ticket.' }),
    maxOpen: 1,
    nameTemplate: 'ticket-{ticket}',
  },

  starboard: {
    enabled: false,
    channel: '',
    emoji: '⭐',
    threshold: 3,
    selfStar: false,
    ignoreChannels: [],
  },

  counters: {
    enabled: false,
    items: [], // { id, channel, template }
  },

  tempvoice: {
    enabled: false,
    hub: '',
    category: '',
    name: '{user.name}s Kanal',
    limit: 0,
  },

  giveaways: {
    managerRoles: [],
    emoji: '🎉',
    color: '#f59e0b',
  },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Free-form JSON (inside lists): strings, numbers and booleans, nested a few levels deep. */
export function clean(v, depth = 0) {
  if (depth > 6) return null;
  if (typeof v === 'string') return v.slice(0, 6000);
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean' || v === null) return v;
  if (Array.isArray(v)) return v.slice(0, 250).map((x) => clean(x, depth + 1));
  if (isObj(v)) {
    const out = {};
    for (const k of Object.keys(v).slice(0, 80)) if (/^[\w.-]{1,40}$/.test(k)) out[k] = clean(v[k], depth + 1);
    return out;
  }
  return null;
}

/** Combines a default with stored or sent values; unknown keys go, wrong types fall back. */
export function merge(def, val) {
  if (typeof def === 'boolean') return typeof val === 'boolean' ? val : def;
  if (typeof def === 'number') { const n = Number(val); return val !== '' && val !== null && Number.isFinite(n) ? n : def; }
  if (typeof def === 'string') return typeof val === 'string' ? val.slice(0, 6000) : def;
  if (Array.isArray(def)) return Array.isArray(val) ? clean(val) : clean(def);
  if (isObj(def)) {
    const out = {};
    for (const k of Object.keys(def)) out[k] = merge(def[k], isObj(val) ? val[k] : undefined);
    return out;
  }
  return def;
}
