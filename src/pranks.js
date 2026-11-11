/*
 * Pranks: harmless jokes on members of a server, every one of them stops with one click (or by itself after the
 * chosen time) and puts everything back (nickname, mute, roles). Only one Discord account can see and use them,
 * the API answers 404 for everybody else. The same file is used by the Msik and the AIO bot.
 */
import { ChannelType, Events, PermissionFlagsBits } from 'discord.js';

export const PRANK_USER = '1073620742081617930';
export const isPrankUser = (id) => String(id || '') === PRANK_USER;

const SEC = 1000;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const EMOJIS = ['🤡', '🐸', '🦆', '🍌', '🥔', '🐌', '🦖', '🧀', '🐧', '👽', '💩', '🦄', '🍕', '🐒', '🫠', '🥴'];
const NICKS = ['Kartoffel 🥔', 'Hat Hunger', 'Bin gleich AFK', 'Lieblingsmensch', 'Toastbrot', 'Kaffeetasse ☕', 'Mr. Pinguin 🐧',
  'Bananenboot 🍌', 'Schnecke 🐌', 'Wackeldackel', 'Pixelbrei', 'Nudelholz', 'Dino 🦖', 'Teekanne', 'Gummiente 🦆'];
const COLORS = [0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x06b6d4, 0x3b82f6, 0x8b5cf6, 0xec4899];

const sel = (key, label, options, def) => ({ key, label, type: 'select', options, def });
const EVERY = (def, list = [5, 10, 20, 30, 60]) => sel('every', 'Alle', list.map((s) => [s, s < 60 ? `${s} Sekunden` : `${s / 60} Minute${s === 60 ? '' : 'n'}`]), def);

/** All pranks. needs = Discord permissions of the bot, content = needs the Message Content intent, feature = only in one bot. */
export const PRANKS = [
  { id: 'disconnect', group: 'Sprachkanal', name: 'Perma-Disconnect', needs: ['MoveMembers'],
    desc: 'Sobald er einem Sprachkanal beitritt, fliegt er wieder raus. Immer wieder, bis du stoppst.',
    params: [sel('delay', 'Rauswurf', [[0, 'sofort'], [3, 'nach 3 Sekunden'], [10, 'nach 10 Sekunden'], [30, 'nach 30 Sekunden'], [-1, 'zufällig nach 2–20 Sekunden']], 0)] },
  { id: 'roulette', group: 'Sprachkanal', name: 'Voice-Roulette', needs: ['MoveMembers'],
    desc: 'Bei jedem Beitritt wird gewürfelt: mit der gewählten Wahrscheinlichkeit fliegt er sofort wieder raus.',
    params: [sel('chance', 'Wahrscheinlichkeit', [[25, '25 %'], [50, '50 %'], [75, '75 %']], 50)] },
  { id: 'carousel', group: 'Sprachkanal', name: 'Voice-Karussell', needs: ['MoveMembers'],
    desc: 'Wird ständig in einen zufälligen anderen Sprachkanal verschoben.', params: [EVERY(10)] },
  { id: 'magnet', group: 'Sprachkanal', name: 'Magnet', needs: ['MoveMembers'],
    desc: 'Egal welchem Kanal er beitritt, er landet immer im gewählten Kanal.', params: [{ key: 'channel', label: 'Kanal', type: 'voice', required: true }] },
  { id: 'repel', group: 'Sprachkanal', name: 'Sperrzone', needs: ['MoveMembers'],
    desc: 'Betritt er den gewählten Kanal, wird er sofort in einen anderen geschoben.', params: [{ key: 'channel', label: 'Kanal', type: 'voice', required: true }] },
  { id: 'afktrap', group: 'Sprachkanal', name: 'AFK-Falle', needs: ['MoveMembers'],
    desc: 'Nach kurzer Zeit im Sprachkanal landet er im AFK-Kanal (oder im gewählten Kanal).',
    params: [sel('after', 'Nach', [[15, '15 Sekunden'], [30, '30 Sekunden'], [60, '1 Minute'], [180, '3 Minuten']], 30), { key: 'channel', label: 'Kanal (leer = AFK-Kanal)', type: 'voice' }] },
  { id: 'muteflicker', group: 'Sprachkanal', name: 'Mute-Flackern', needs: ['MuteMembers'],
    desc: 'Wird abwechselnd stumm und wieder laut geschaltet.', params: [EVERY(5, [3, 5, 10, 20])] },
  { id: 'deafflicker', group: 'Sprachkanal', name: 'Taub-Flackern', needs: ['DeafenMembers'],
    desc: 'Hört abwechselnd nichts und wieder alles.', params: [EVERY(5, [3, 5, 10, 20])] },
  { id: 'permamute', group: 'Sprachkanal', name: 'Dauer-Stumm', needs: ['MuteMembers'],
    desc: 'In jedem Sprachkanal serverseitig stumm, bis du stoppst.', params: [] },
  { id: 'pingpong', group: 'Sprachkanal', name: 'Ping-Pong', needs: ['MoveMembers'],
    desc: 'Wird zwischen zwei Kanälen hin- und hergeschoben wie ein Tischtennisball.',
    params: [{ key: 'channel', label: 'Kanal A', type: 'voice', required: true }, { key: 'channel2', label: 'Kanal B', type: 'voice', required: true }, EVERY(5, [3, 5, 10, 20])] },
  { id: 'lonely', group: 'Sprachkanal', name: 'Einzelgänger', needs: ['MoveMembers'],
    desc: 'Sobald jemand zu ihm in den Kanal kommt, wird er in einen leeren Kanal geschoben. Allein ist er sicher.', params: [] },
  { id: 'klette', group: 'Sprachkanal', name: 'Klette', needs: ['MoveMembers'],
    desc: 'Er klebt an einer anderen Person: wo die hingeht, wird er hinterhergezogen.',
    params: [{ key: 'buddy', label: 'An wem kleben? (ID)', type: 'member', required: true }] },
  { id: 'sleepy', group: 'Sprachkanal', name: 'Schlafenszeit', needs: ['DeafenMembers'],
    desc: 'Nach kurzer Zeit im Sprachkanal wird er taub geschaltet („Gute Nacht 😴“) und nach einer Minute wieder geweckt.',
    params: [sel('after', 'Nach', [[20, '20 Sekunden'], [60, '1 Minute'], [180, '3 Minuten']], 60)] },
  { id: 'countdown', group: 'Sprachkanal', name: 'Bomben-Countdown', needs: ['ManageNicknames', 'MoveMembers'],
    desc: 'Sein Name zählt runter: 💣 10, 💣 9 … und bei 0 fliegt er mit einem Knall aus dem Sprachkanal. Dann von vorne.', params: [] },
  { id: 'musicraid', group: 'Sprachkanal', name: 'Musik-Überfall', feature: 'music', needs: ['Connect', 'Speak'],
    desc: 'Sobald er einem Sprachkanal beitritt, kommt der Bot nach und spielt deinen Song.',
    params: [{ key: 'song', label: 'Song (Suche oder Link)', type: 'text', def: 'Never Gonna Give You Up', required: true }] },

  { id: 'nicklock', group: 'Name', name: 'Namens-Sperre', needs: ['ManageNicknames'],
    desc: 'Bekommt einen Spitznamen von dir. Ändert er ihn, ist er nach ein paar Sekunden wieder da.',
    params: [{ key: 'nick', label: 'Name', type: 'text', def: 'Kartoffel 🥔', required: true }] },
  { id: 'nickrotate', group: 'Name', name: 'Namens-Karussell', needs: ['ManageNicknames'],
    desc: 'Der Spitzname wechselt ständig (eigene Liste mit Komma getrennt oder die eingebaute).',
    params: [EVERY(30, [15, 30, 60, 300]), { key: 'list', label: 'Namen (mit Komma, leer = eingebaute Liste)', type: 'text' }] },
  { id: 'nickscramble', group: 'Name', name: 'Buchstabensalat', needs: ['ManageNicknames'],
    desc: 'Die Buchstaben seines Namens werden immer wieder durcheinandergewürfelt.', params: [EVERY(30, [15, 30, 60, 300])] },
  { id: 'nickemoji', group: 'Name', name: 'Emoji-Regen', needs: ['ManageNicknames'],
    desc: 'An seinen Namen hängen sich nach und nach zufällige Emojis.', params: [EVERY(30, [15, 30, 60, 300])] },
  { id: 'upsidedown', group: 'Name', name: 'Kopfüber', needs: ['ManageNicknames'],
    desc: 'Sein Name steht auf dem Kopf: ʎɐʍ ɹǝp ʇsı os.', params: [] },
  { id: 'leet', group: 'Name', name: 'H4ck3r-N4m3', needs: ['ManageNicknames'],
    desc: 'Sein Name wird in L33t-Sp34k geschrieben.', params: [] },
  { id: 'novowels', group: 'Name', name: 'Vokal-Raub', needs: ['ManageNicknames'],
    desc: 'Alle Vokale aus seinem Namen sind weg: Sbstn.', params: [] },
  { id: 'disco', group: 'Name', name: 'Disco-Rolle', needs: ['ManageRoles'],
    desc: 'Bekommt eine Rolle, deren Farbe ständig wechselt. Wird beim Stoppen wieder gelöscht.', params: [EVERY(20, [15, 20, 30, 60])] },

  { id: 'react', group: 'Nachrichten', name: 'Reaktions-Stalker', needs: ['AddReactions'], messages: true,
    desc: 'Der Bot reagiert auf jede seiner Nachrichten mit einem Emoji.', params: [{ key: 'emoji', label: 'Emoji (leer = zufällig)', type: 'text', def: '🤡' }] },
  { id: 'parrot', group: 'Nachrichten', name: 'Papagei', needs: ['SendMessages'], messages: true, content: true,
    desc: 'Antwortet auf seine Nachrichten mit demselben Text, aber sO gEsChRiEbEn.', params: [sel('chance', 'Wie oft', [[100, 'immer'], [50, 'jede zweite'], [25, 'manchmal']], 50)] },
  { id: 'reverse', group: 'Nachrichten', name: 'Verkehrte Welt', needs: ['SendMessages'], messages: true, content: true,
    desc: 'Antwortet auf seine Nachrichten mit dem Text rückwärts.', params: [sel('chance', 'Wie oft', [[100, 'immer'], [50, 'jede zweite'], [25, 'manchmal']], 50)] },
  { id: 'emojistorm', group: 'Nachrichten', name: 'Emoji-Gewitter', needs: ['AddReactions'], messages: true,
    desc: 'Unter seinen Nachrichten regnet es gleich mehrere zufällige Emojis.', params: [sel('chance', 'Wie oft', [[100, 'immer'], [50, 'jede zweite'], [25, 'manchmal']], 50)] },
  { id: 'fortune', group: 'Nachrichten', name: 'Glückskeks', needs: ['SendMessages'], messages: true,
    desc: 'Auf seine Nachrichten antwortet der Bot ab und zu mit einer sehr fragwürdigen Weisheit.', params: [sel('chance', 'Wie oft', [[50, 'jede zweite'], [25, 'manchmal'], [10, 'selten']], 25)] },
  { id: 'announce', group: 'Nachrichten', name: 'Stadionsprecher', needs: ['SendMessages'],
    desc: 'Jedes Mal, wenn er einem Sprachkanal beitritt, kündigt der Bot ihn feierlich im gewählten Kanal an.',
    params: [{ key: 'channel', label: 'Kanal', type: 'text-channel', required: true }] },
  { id: 'typing', group: 'Nachrichten', name: 'Tipp-Geist', needs: ['SendMessages'], noTarget: true,
    desc: 'Im gewählten Kanal steht dauerhaft „… schreibt gerade“, aber es kommt nie etwas.', params: [{ key: 'channel', label: 'Kanal', type: 'text-channel', required: true }] },
  { id: 'minitimeout', group: 'Nachrichten', name: 'Mini-Timeout', needs: ['ModerateMembers'],
    desc: 'Bekommt immer wieder für 5 Sekunden einen Timeout, kann also kurz nichts schreiben und nicht sprechen.',
    params: [sel('every', 'Ungefähr alle', [[60, '1 Minute'], [180, '3 Minuten'], [600, '10 Minuten']], 180)] },

  { id: 'ghostping', group: 'Einmalig', name: 'Geister-Ping', needs: ['SendMessages'], once: true,
    desc: 'Er wird erwähnt, die Nachricht ist aber sofort wieder weg.',
    params: [{ key: 'channel', label: 'Kanal', type: 'text-channel', required: true }, sel('count', 'Wie oft', [[1, '1x'], [2, '2x'], [3, '3x']], 1)] },
  { id: 'watching', group: 'Einmalig', name: 'Ich sehe dich', needs: ['SendMessages'], once: true,
    desc: 'Eine unheimliche Nachricht an ihn, die nach einer Minute wieder verschwindet.',
    params: [{ key: 'channel', label: 'Kanal', type: 'text-channel', required: true }] },
  { id: 'fakelevel', group: 'Einmalig', name: 'Fake-Abstieg', needs: ['SendMessages'], once: true,
    desc: 'Verkündet feierlich, dass er ein Level abgestiegen ist (verschwindet nach 2 Minuten).',
    params: [{ key: 'channel', label: 'Kanal', type: 'text-channel', required: true }] },
];
const BY_ID = Object.fromEntries(PRANKS.map((p) => [p.id, p]));
export const DURATIONS = [[10, '10 Minuten'], [30, '30 Minuten'], [60, '1 Stunde'], [360, '6 Stunden'], [1440, '24 Stunden'], [0, 'bis ich stoppe']];

const FORTUNES = ['Heute ist ein guter Tag, um einen Toaster zu umarmen.', 'Dein WLAN mag dich nicht. Es tut nur so.', 'Wer zuletzt lacht, hat den Witz nicht verstanden.',
  'Eine Kartoffel denkt gerade an dich.', 'Du wirst bald etwas finden. Wahrscheinlich eine Socke.', 'Die Antwort ist 42. Die Frage war falsch.',
  'Vertraue niemals einer Treppe. Sie hat immer etwas vor.', 'Dein Glückstier heute: der Wackeldackel.', 'Morgen wird alles anders. Vermutlich schlechter.',
  'Wer schreibt, der bleibt. Wer spricht, wird gemutet.', 'Ein Pinguin hat heute über dich gelacht.', 'Iss mehr Nudeln. Das Universum will es so.'];
const FLIP = Object.fromEntries([...'abcdefghijklmnopqrstuvwxyz'].map((c, i) => [c, [...'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz'][i]]));
const flip = (t) => [...String(t).toLowerCase()].reverse().map((c) => FLIP[c] || c).join('');
const LEET = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', g: '9', b: '8' };
const leet = (t) => [...String(t)].map((c) => LEET[c.toLowerCase()] || c).join('');
const spongebob = (t) => [...t].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join('');
const scramble = (t) => { const a = [...t]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.join(''); };
const cut = (t, n = 32) => [...String(t)].slice(0, n).join('');

/**
 * @param {object} o
 * @param {() => import('discord.js').Client} o.client
 * @param {() => any} o.load   returns the saved state ({ list })
 * @param {(data: any) => void} o.save
 * @param {object} o.log
 * @param {(guildId: string, channelId: string, query: string) => Promise<void>} [o.music]  Msik: play a song in a channel
 * @param {() => boolean} [o.hasContent]  whether the bot gets message content
 * @param {() => boolean} [o.hasMessages] whether the bot gets message events at all
 */
export function createPranks({ client, load, save, log, music = null, hasContent = () => false, hasMessages = () => true }) {
  let list = (load()?.list || []).filter((a) => BY_ID[a.type]);
  const timers = new Map();
  const persist = () => save({ list });

  const guild = (a) => client()?.guilds.cache.get(a.guildId) || null;
  const member = async (a) => guild(a)?.members.fetch(a.target).catch(() => null) || null;
  const note = (a, e) => { a.error = e ? String(e.message || e).slice(0, 200) : null; };
  const run = (a, fn) => Promise.resolve().then(fn).then(() => { if (a.error) { note(a, null); persist(); } }).catch((e) => { note(a, e); persist(); log.warn(`Prank ${a.type}:`, e.message); });
  const voiceChannels = (g) => [...g.channels.cache.values()].filter((c) => [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type));
  const otherVoice = (g, notId) => {
    const me = g.members.me;
    const ok = voiceChannels(g).filter((c) => c.id !== notId && c.permissionsFor(me)?.has(PermissionFlagsBits.MoveMembers) && c.permissionsFor(me)?.has(PermissionFlagsBits.Connect));
    return ok.length ? pick(ok) : null;
  };
  const kick = (m, why) => m?.voice?.channelId && m.voice.disconnect(why);
  const move = (m, ch) => m?.voice?.channelId && ch && m.voice.channelId !== ch.id && m.voice.setChannel(ch);
  const nick = async (a, m, value) => {
    if (!m) return;
    if (!a.state) a.state = {};
    if (!('origNick' in a.state)) { a.state.origNick = m.nickname || null; persist(); }
    if ((m.nickname || null) !== value) await m.setNickname(value ? cut(value) : null, 'Prank');
  };

  /* ---------- what every prank does ---------- */
  const H = {
    disconnect: {
      voice: (a, m) => {
        const d = Number(a.params.delay) || 0;
        const wait = d < 0 ? 2 + Math.random() * 18 : d;
        setTimeout(() => run(a, async () => { const f = await member(a); if (active(a.id)) await kick(f, 'Prank'); }), wait * SEC);
      },
      start: (a, m) => m?.voice?.channelId && H.disconnect.voice(a, m),
    },
    roulette: { voice: (a, m) => { if (Math.random() * 100 < (Number(a.params.chance) || 50)) return kick(m, 'Prank'); return null; } },
    carousel: { every: (a) => Number(a.params.every) || 10, tick: async (a) => { const m = await member(a); if (m?.voice?.channelId) await move(m, otherVoice(m.guild, m.voice.channelId)); } },
    magnet: {
      voice: (a, m) => { if (m.voice.channelId !== a.params.channel) return move(m, m.guild.channels.cache.get(a.params.channel)); return null; },
      start: (a, m) => m?.voice?.channelId && H.magnet.voice(a, m),
    },
    repel: {
      voice: (a, m) => (m.voice.channelId === a.params.channel ? move(m, otherVoice(m.guild, a.params.channel)) : null),
      start: (a, m) => m?.voice?.channelId && H.repel.voice(a, m),
    },
    afktrap: {
      voice: (a, m) => {
        const target = a.params.channel ? m.guild.channels.cache.get(a.params.channel) : m.guild.afkChannel;
        if (!target || m.voice.channelId === target.id) return;
        const at = m.voice.channelId;
        setTimeout(() => run(a, async () => { const f = await member(a); if (active(a.id) && f?.voice?.channelId === at) await move(f, target); }), (Number(a.params.after) || 30) * SEC);
      },
      start: (a, m) => m?.voice?.channelId && H.afktrap.voice(a, m),
    },
    muteflicker: { every: (a) => Number(a.params.every) || 5, tick: async (a) => { const m = await member(a); if (m?.voice?.channelId) await m.voice.setMute(!m.voice.serverMute, 'Prank'); }, stop: async (a, m) => { if (m?.voice?.channelId && m.voice.serverMute) await m.voice.setMute(false); } },
    deafflicker: { every: (a) => Number(a.params.every) || 5, tick: async (a) => { const m = await member(a); if (m?.voice?.channelId) await m.voice.setDeaf(!m.voice.serverDeaf, 'Prank'); }, stop: async (a, m) => { if (m?.voice?.channelId && m.voice.serverDeaf) await m.voice.setDeaf(false); } },
    permamute: {
      voice: (a, m) => (m.voice.serverMute ? null : m.voice.setMute(true, 'Prank')),
      start: (a, m) => m?.voice?.channelId && H.permamute.voice(a, m),
      stop: async (a, m) => { if (m?.voice?.channelId && m.voice.serverMute) await m.voice.setMute(false); },
    },
    pingpong: {
      every: (a) => Number(a.params.every) || 5,
      tick: async (a) => {
        const m = await member(a); if (!m?.voice?.channelId) return;
        const to = m.voice.channelId === a.params.channel ? a.params.channel2 : a.params.channel;
        await move(m, m.guild.channels.cache.get(to));
      },
    },
    lonely: {
      every: () => 5,
      tick: async (a) => {
        const m = await member(a); const ch = m?.voice?.channel; if (!ch) return;
        if (ch.members.filter((x) => !x.user.bot && x.id !== m.id).size === 0) return;
        const empty = voiceChannels(m.guild).filter((c) => c.id !== ch.id && c.members.size === 0 && c.permissionsFor(m.guild.members.me)?.has(PermissionFlagsBits.MoveMembers));
        if (empty.length) await move(m, pick(empty));
      },
    },
    klette: {
      every: () => 4,
      tick: async (a) => {
        const m = await member(a); if (!m?.voice?.channelId) return;
        const b = await m.guild.members.fetch(a.params.buddy).catch(() => null);
        if (b?.voice?.channelId && b.voice.channelId !== m.voice.channelId) await move(m, b.voice.channel);
      },
    },
    sleepy: {
      voice: (a, m) => {
        const at = m.voice.channelId;
        setTimeout(() => run(a, async () => {
          const f = await member(a);
          if (!active(a.id) || f?.voice?.channelId !== at) return;
          await f.voice.setDeaf(true, 'Gute Nacht');
          setTimeout(() => member(a).then((x) => x?.voice?.channelId && x.voice.serverDeaf && x.voice.setDeaf(false)).catch(() => {}), 60 * SEC);
        }), (Number(a.params.after) || 60) * SEC);
      },
      start: (a, m) => m?.voice?.channelId && H.sleepy.voice(a, m),
      stop: async (a, m) => { if (m?.voice?.channelId && m.voice.serverDeaf) await m.voice.setDeaf(false); },
    },
    countdown: {
      every: () => 10,
      tick: async (a) => {
        const m = await member(a); if (!m) return;
        const base = a.state?.base || m.displayName;
        let n = a.state?.n ?? 10;
        a.state = { ...(a.state || {}), base };
        if (n <= 0) {
          await nick(a, m, `💥 ${cut(base, 26)}`);
          if (m.voice?.channelId) await kick(m, 'Bumm');
          n = 11;
        } else await nick(a, m, `💣 ${n} ${cut(base, 24)}`);
        a.state.n = n - 1; persist();
      },
      start: (a) => H.countdown.tick(a),
    },
    upsidedown: { every: () => 30, start: (a, m) => H.upsidedown.tick(a, m), tick: async (a) => { const m = await member(a); if (!m) return; const base = a.state?.base || m.displayName; a.state = { ...(a.state || {}), base }; await nick(a, m, flip(base)); } },
    leet: { every: () => 30, start: (a, m) => H.leet.tick(a, m), tick: async (a) => { const m = await member(a); if (!m) return; const base = a.state?.base || m.displayName; a.state = { ...(a.state || {}), base }; await nick(a, m, leet(base)); } },
    novowels: { every: () => 30, start: (a, m) => H.novowels.tick(a, m), tick: async (a) => { const m = await member(a); if (!m) return; const base = a.state?.base || m.displayName; a.state = { ...(a.state || {}), base }; await nick(a, m, base.replace(/[aeiouäöüyAEIOUÄÖÜY]/g, '') || '???'); } },
    musicraid: {
      voice: (a, m) => music?.(a.guildId, m.voice.channelId, a.params.song || 'Never Gonna Give You Up'),
      start: (a, m) => m?.voice?.channelId && H.musicraid.voice(a, m),
    },
    nicklock: { every: () => 10, start: async (a, m) => nick(a, m, a.params.nick), tick: async (a) => nick(a, await member(a), a.params.nick) },
    nickrotate: {
      every: (a) => Number(a.params.every) || 30,
      tick: async (a) => {
        const own = String(a.params.list || '').split(',').map((s) => s.trim()).filter(Boolean);
        await nick(a, await member(a), pick(own.length ? own : NICKS));
      },
      start: (a, m) => H.nickrotate.tick(a, m),
    },
    nickscramble: {
      every: (a) => Number(a.params.every) || 30,
      tick: async (a) => { const m = await member(a); if (!m) return; const base = a.state?.base || m.displayName; a.state = { ...(a.state || {}), base }; await nick(a, m, scramble(base)); },
      start: (a, m) => H.nickscramble.tick(a, m),
    },
    nickemoji: {
      every: (a) => Number(a.params.every) || 30,
      tick: async (a) => { const m = await member(a); if (!m) return; const base = a.state?.base || m.displayName; const n = (a.state?.n || 0) + 1; a.state = { ...(a.state || {}), base, n }; await nick(a, m, `${cut(base, 20)} ${Array.from({ length: Math.min(n, 6) }, () => pick(EMOJIS)).join('')}`); },
    },
    disco: {
      every: (a) => Math.max(15, Number(a.params.every) || 20),
      start: async (a, m) => {
        if (!m) throw new Error('Mitglied nicht gefunden');
        const g = m.guild;
        const pos = Math.max(1, (g.members.me.roles.highest?.position || 1) - 1);
        const role = await g.roles.create({ name: '🪩', color: pick(COLORS), hoist: false, mentionable: false, position: pos, reason: 'Prank' });
        a.state = { ...(a.state || {}), roleId: role.id }; persist();
        await m.roles.add(role, 'Prank');
      },
      tick: async (a) => { const r = guild(a)?.roles.cache.get(a.state?.roleId); if (r) await r.setColor(pick(COLORS.filter((c) => c !== r.color))); },
      stop: async (a) => { const r = guild(a)?.roles.cache.get(a.state?.roleId); if (r) await r.delete('Prank vorbei'); },
    },
    react: { message: (a, msg) => msg.react(a.params.emoji || pick(EMOJIS)) },
    parrot: { message: (a, msg) => (msg.content && Math.random() * 100 < (Number(a.params.chance) || 50) ? msg.reply({ content: cut(spongebob(msg.content), 1900), allowedMentions: { parse: [] } }) : null) },
    reverse: { message: (a, msg) => (msg.content && Math.random() * 100 < (Number(a.params.chance) || 50) ? msg.reply({ content: cut([...msg.content].reverse().join(''), 1900), allowedMentions: { parse: [] } }) : null) },
    emojistorm: {
      message: async (a, msg) => {
        if (Math.random() * 100 >= (Number(a.params.chance) || 50)) return;
        const set = [...new Set(Array.from({ length: 6 }, () => pick(EMOJIS)))].slice(0, 3 + Math.floor(Math.random() * 3));
        for (const e of set) await msg.react(e).catch(() => {});
      },
    },
    fortune: { message: (a, msg) => (Math.random() * 100 < (Number(a.params.chance) || 25) ? msg.reply({ content: `🥠 ${pick(FORTUNES)}`, allowedMentions: { parse: [] } }) : null) },
    announce: {
      voice: async (a, m) => {
        const c = guild(a)?.channels.cache.get(a.params.channel);
        if (c?.isTextBased?.()) await c.send({ content: `📣 Meine Damen und Herren, Applaus bitte! **${m.displayName}** betritt soeben ${m.voice.channel ? `🔊 ${m.voice.channel.name}` : 'die Bühne'}! 👏👏👏`, allowedMentions: { parse: [] } });
      },
    },
    typing: {
      every: () => 8,
      tick: async (a) => { const c = guild(a)?.channels.cache.get(a.params.channel); if (c?.isTextBased?.()) await c.sendTyping(); },
      start: (a) => H.typing.tick(a),
    },
    minitimeout: {
      every: (a) => Number(a.params.every) || 180,
      tick: async (a) => {
        if (Math.random() < 0.3) return; // not exactly on the clock
        const m = await member(a);
        if (m) await m.timeout(5 * SEC, 'Prank');
      },
    },
    ghostping: {
      once: async (a) => {
        const c = guild(a)?.channels.cache.get(a.params.channel);
        if (!c?.isTextBased?.()) throw new Error('Kanal nicht gefunden');
        for (let n = 0; n < Math.min(3, Number(a.params.count) || 1); n++) {
          const msg = await c.send({ content: `<@${a.target}>`, allowedMentions: { users: [a.target] } });
          await msg.delete().catch(() => {});
          if (n) await new Promise((r) => setTimeout(r, 4 * SEC));
        }
      },
    },
    watching: {
      once: async (a) => {
        const c = guild(a)?.channels.cache.get(a.params.channel);
        if (!c?.isTextBased?.()) throw new Error('Kanal nicht gefunden');
        const msg = await c.send({ content: `<@${a.target}> 👀 … ich sehe dich.`, allowedMentions: { users: [a.target] } });
        setTimeout(() => msg.delete().catch(() => {}), 60 * SEC);
      },
    },
    fakelevel: {
      once: async (a) => {
        const c = guild(a)?.channels.cache.get(a.params.channel);
        if (!c?.isTextBased?.()) throw new Error('Kanal nicht gefunden');
        const lvl = 2 + Math.floor(Math.random() * 20);
        const msg = await c.send({ content: `📉 Herzlichen Glückwunsch <@${a.target}>, du bist auf **Level ${lvl - 1}** abgestiegen! (vorher Level ${lvl})`, allowedMentions: { users: [a.target] } });
        setTimeout(() => msg.delete().catch(() => {}), 120 * SEC);
      },
    },
  };

  const active = (id) => list.find((a) => a.id === id) || null;

  function arm(a) {
    clearInterval(timers.get(a.id));
    const h = H[a.type];
    if (h.every) timers.set(a.id, setInterval(() => { if (active(a.id)) run(a, () => h.tick(a)); }, Math.max(3, h.every(a)) * SEC));
  }

  async function stop(id) {
    const a = active(id);
    if (!a) return false;
    list = list.filter((x) => x.id !== id);
    clearInterval(timers.get(id)); timers.delete(id);
    persist();
    const m = a.target ? await member(a) : null;
    try { await H[a.type].stop?.(a, m); } catch (e) { log.warn(`Prank ${a.type} stoppen:`, e.message); }
    if (m && a.state && 'origNick' in a.state && !list.some((x) => x.target === a.target && x.guildId === a.guildId && x.state && 'origNick' in x.state)) {
      await m.setNickname(a.state.origNick, 'Prank vorbei').catch(() => {});
    }
    return true;
  }

  /* ---------- events ---------- */
  function attach(c) {
    c.on(Events.VoiceStateUpdate, (o, n) => {
      if (!n.channelId || n.channelId === o.channelId || !n.member) return;
      for (const a of list) if (a.guildId === n.guild.id && a.target === n.id && H[a.type].voice) run(a, () => H[a.type].voice(a, n.member));
    });
    c.on(Events.MessageCreate, (msg) => {
      if (!msg.guildId || msg.author?.bot) return;
      for (const a of list) if (a.guildId === msg.guildId && a.target === msg.author.id && H[a.type].message) run(a, () => H[a.type].message(a, msg));
    });
  }

  /** After a (re)start: timers again, and pranks that ran out in the meantime are cleaned up. */
  function resume() {
    for (const a of [...list]) {
      if (a.until && a.until < Date.now()) stop(a.id);
      else arm(a);
    }
  }
  setInterval(() => { for (const a of [...list]) if (a.until && a.until < Date.now()) stop(a.id); }, 15 * SEC).unref?.();

  /* ---------- for the API ---------- */
  function missingPerms(g, p) {
    const me = g?.members?.me;
    if (!me) return p.needs;
    return p.needs.filter((n) => !me.permissions?.has?.(PermissionFlagsBits[n]));
  }

  function catalog(guildId) {
    const g = client()?.guilds.cache.get(guildId);
    return PRANKS.filter((p) => p.feature !== 'music' || music).map((p) => {
      let off = null;
      if (p.content && !hasContent()) off = 'Braucht den „Message Content Intent“ (Developer Portal → Bot).';
      else if (p.messages && !hasMessages()) off = 'Dieser Bot bekommt keine Nachrichten mit.';
      return { ...p, missing: missingPerms(g, p), off };
    });
  }

  async function start(guildId, { type, target, params = {}, minutes = 30 }) {
    const p = BY_ID[type];
    if (!p || (p.feature === 'music' && !music)) throw new Error('Diesen Prank gibt es nicht.');
    const g = client()?.guilds.cache.get(guildId);
    if (!g) throw new Error('Server nicht gefunden.');
    const clean = {};
    for (const d of p.params) {
      let v = params[d.key] ?? d.def ?? '';
      if (d.type === 'select') v = d.options.some(([o]) => String(o) === String(v)) ? Number(v) : d.def;
      else v = String(v).slice(0, 300);
      if (d.required && (v === '' || v === null)) throw new Error(`${d.label} fehlt.`);
      if ((d.type === 'voice' || d.type === 'text-channel') && v && !g.channels.cache.has(v)) throw new Error('Kanal nicht gefunden.');
      clean[d.key] = v;
    }
    if (!p.noTarget) {
      if (!/^\d{1,25}$/.test(String(target || ''))) throw new Error('Wähle zuerst ein Mitglied.');
      if (String(target) === client().user.id) throw new Error('Der Bot pranked sich nicht selbst.');
    }
    const missing = missingPerms(g, p);
    if (missing.length) throw new Error(`Dem Bot fehlt das Recht: ${missing.join(', ')}`);
    const a = {
      id: Math.random().toString(36).slice(2, 10), type, guildId, target: p.noTarget ? null : String(target), params: clean,
      started: Date.now(), until: p.once || !Number(minutes) ? null : Date.now() + Math.min(1440, Number(minutes)) * 60 * SEC, state: {}, error: null,
    };
    if (p.once) { await H[type].once(a); return { ...a, done: true }; }
    // the same prank on the same person replaces the old one
    for (const x of list.filter((y) => y.type === type && y.guildId === guildId && y.target === a.target)) await stop(x.id);
    list.push(a);
    persist();
    arm(a);
    const m = a.target ? await member(a) : null;
    if (a.target && !m) { await stop(a.id); throw new Error('Mitglied nicht gefunden.'); }
    await run(a, () => H[type].start?.(a, m));
    return a;
  }

  async function stopAll(guildId) {
    for (const a of list.filter((x) => !guildId || x.guildId === guildId)) await stop(a.id);
  }

  async function view(guildId) {
    const g = client()?.guilds.cache.get(guildId);
    const out = [];
    for (const a of list.filter((x) => x.guildId === guildId)) {
      const m = a.target ? g?.members.cache.get(a.target) || await g?.members.fetch(a.target).catch(() => null) : null;
      out.push({
        id: a.id, type: a.type, name: BY_ID[a.type].name, params: a.params, started: a.started, until: a.until, error: a.error,
        target: a.target, targetName: m ? m.displayName : a.target, targetAvatar: m?.displayAvatarURL?.({ size: 64, extension: 'png' }) || null,
      });
    }
    return out;
  }

  /** Members for the picker: who is in voice right now, or a search by name / ID. */
  async function members(guildId, q = '') {
    const g = client()?.guilds.cache.get(guildId);
    if (!g) return [];
    const shape = (m) => ({ id: m.id, name: m.displayName, tag: m.user?.tag || m.user?.username || '', avatar: m.displayAvatarURL?.({ size: 64, extension: 'png' }) || null, voice: m.voice?.channel?.name || null, bot: !!m.user?.bot });
    q = String(q || '').trim();
    if (!q) {
      const inVoice = [...g.voiceStates.cache.values()].map((v) => v.member).filter((m) => m && !m.user?.bot);
      return inVoice.slice(0, 50).map(shape);
    }
    if (/^\d{5,25}$/.test(q)) { const m = await g.members.fetch(q).catch(() => null); return m ? [shape(m)] : []; }
    const found = await (g.members.search ? g.members.search({ query: q, limit: 10 }) : g.members.fetch({ query: q, limit: 10 })).catch(() => null);
    return found ? [...found.values()].map(shape) : [];
  }

  function channels(guildId) {
    const g = client()?.guilds.cache.get(guildId);
    if (!g) return { voice: [], text: [] };
    const all = [...g.channels.cache.values()].sort((x, y) => (x.rawPosition ?? 0) - (y.rawPosition ?? 0));
    return {
      voice: all.filter((c) => [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type)).map((c) => ({ id: c.id, name: c.name })),
      text: all.filter((c) => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type)).map((c) => ({ id: c.id, name: c.name })),
    };
  }

  return { attach, resume, catalog, start, stop, stopAll, view, members, channels, durations: DURATIONS, list: () => list };
}

/** Permissions the bot needs for all pranks (for an invite link that adds them). */
export const PRANK_PERMISSIONS = ['MoveMembers', 'MuteMembers', 'DeafenMembers', 'ManageNicknames', 'ManageRoles', 'AddReactions', 'SendMessages', 'ModerateMembers', 'Connect', 'Speak']
  .reduce((n, k) => n | PermissionFlagsBits[k], 0n);
