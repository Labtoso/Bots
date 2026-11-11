import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, Events, GatewayIntentBits,
  MessageFlags, PermissionFlagsBits, REST, Routes, SlashCommandBuilder,
} from 'discord.js';
import { VoiceConnectionStatus, entersState, getVoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { config } from './config.js';
import { createToken } from './auth.js';
import { GuildPlayer } from './player.js';
import { log } from './log.js';
import { settings } from './settings.js';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';
import { createPranks } from './pranks.js';
import { resolve } from './resolve.js';

/** Invite with Administrator (like AIO), so music and every prank work without picking single permissions. */
export const INVITE_PERMISSIONS = '8';
const prankFile = path.join(ROOT, 'data', 'pranks.json');

const ACCENT = 0x3b82f6;

export function createDiscordBot() {
  if (!config.token) throw new Error('DISCORD_TOKEN fehlt (in .env eintragen).');
  // GuildMessages (not privileged) only so the message pranks can react; message content is never read
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages] });
  const players = new Map();
  let publicUrl = '';

  /** Leaves voice in a guild, also when this process has no connection object (e.g. after a restart). */
  function leaveVoice(guildId) {
    const conn = getVoiceConnection(guildId);
    if (conn && conn.state.status !== VoiceConnectionStatus.Destroyed) { conn.destroy(); return; }
    const guild = client.guilds.cache.get(guildId);
    if (guild?.members.me?.voice.channelId) {
      guild.shard.send({ op: 4, d: { guild_id: guildId, channel_id: null, self_mute: false, self_deaf: false } });
    }
  }

  function getPlayer(guildId) {
    if (!players.has(guildId)) {
      const player = new GuildPlayer(guildId, {
        connect: async (channelId, audio) => {
          const guild = await client.guilds.fetch(guildId);
          const channel = await guild.channels.fetch(channelId).catch(() => null);
          if (!channel?.isVoiceBased()) throw new Error('CHANNEL_GONE');
          const perms = channel.permissionsFor(guild.members.me);
          if (!perms?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) throw new Error('NO_VOICE_PERMS');
          const conn = joinVoiceChannel({
            channelId, guildId, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true,
          });
          try {
            await entersState(conn, VoiceConnectionStatus.Ready, 20_000);
          } catch {
            // never got a working voice connection: leave again instead of sitting silent in the channel
            if (conn.state.status !== VoiceConnectionStatus.Destroyed) conn.destroy();
            log.warn(`Sprachverbindung kam nicht zustande (Status: ${conn.state.status}). UDP nach außen blockiert?`);
            throw new Error('keine Verbindung zum Sprachkanal (UDP nach außen blockiert?)');
          }
          conn.subscribe(audio);
          if (conn.msikHooked) return { id: channel.id, name: channel.name };
          conn.msikHooked = true;
          conn.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
              await Promise.race([
                entersState(conn, VoiceConnectionStatus.Signalling, 5_000),
                entersState(conn, VoiceConnectionStatus.Connecting, 5_000),
              ]);
            } catch {
              player.channel = null;
              player.stop();
              if (conn.state.status !== VoiceConnectionStatus.Destroyed) conn.destroy();
            }
          });
          return { id: channel.id, name: channel.name };
        },
        disconnect: () => leaveVoice(guildId),
      });
      player.on('trackStart', (track) => postNowPlaying(guildId, track).catch((e) => log.warn('Jetzt läuft posten:', e.message)));
      players.set(guildId, player);
    }
    return players.get(guildId);
  }

  const pranks = createPranks({
    client: () => client, log,
    load: () => { try { return JSON.parse(fs.readFileSync(prankFile, 'utf8')); } catch { return { list: [] }; } },
    save: (d) => { try { fs.mkdirSync(path.dirname(prankFile), { recursive: true }); fs.writeFileSync(`${prankFile}.tmp`, JSON.stringify(d)); fs.renameSync(`${prankFile}.tmp`, prankFile); } catch (e) { log.warn('Pranks speichern:', e.message); } },
    // Musik-Überfall: the bot follows into the channel and plays the song right away
    music: async (guildId, channelId, query) => {
      const player = getPlayer(guildId);
      await player.moveTo(channelId);
      const r = await resolve(query);
      if (r.tracks[0]) await player.add([{ ...r.tracks[0], requester: '' }], { now: true });
    },
  });
  pranks.attach(client);

  /** Bot profile (owner only): global name and picture, nickname on one server. */
  async function getProfile(guildId) {
    const g = client.guilds.cache.get(guildId);
    return { id: client.user.id, name: client.user.username, avatar: client.user.displayAvatarURL({ size: 256, extension: 'png' }), nick: g?.members.me?.nickname || '' };
  }
  async function setProfile(guildId, { name, avatar, nick }) {
    if (name && name !== client.user.username) await client.user.setUsername(String(name).slice(0, 32));
    if (avatar) await client.user.setAvatar(String(avatar));
    if (typeof nick === 'string') {
      const g = client.guilds.cache.get(guildId);
      if (g?.members.me && (g.members.me.nickname || '') !== nick.trim()) await g.members.me.setNickname(nick.trim().slice(0, 32) || null);
    }
    return getProfile(guildId);
  }

  async function getGuildInfo(guildId) {
    const g = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    return { id: g.id, name: g.name, icon: g.iconURL({ size: 128, extension: 'png' }) };
  }

  async function getMember(guildId, userId) {
    const g = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    // the gateway keeps voice states up to date, so this needs no request to Discord
    const vs = g.voiceStates.cache.get(userId);
    if (vs) return { id: userId, voiceChannelId: vs.channelId || null };
    const m = await g.members.fetch(userId).catch(() => null);
    return { id: userId, voiceChannelId: m?.voice?.channelId || null };
  }

  /** Posts the song that just started into the chosen text channel (if turned on). */
  async function postNowPlaying(guildId, track) {
    const st = settings.get(guildId);
    if (!st.npEnabled || !st.npChannelId) return;
    const g = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    const ch = await g.channels.fetch(st.npChannelId).catch(() => null);
    if (!ch?.isTextBased()) return;
    const mm = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const embed = new EmbedBuilder().setColor(ACCENT).setAuthor({ name: 'Jetzt läuft' }).setTitle(track.title.slice(0, 250));
    if (track.url) embed.setURL(track.url);
    const lines = [track.artist, track.duration ? mm(track.duration) : '', track.requester ? `von ${track.requester}` : ''].filter(Boolean);
    if (lines.length) embed.setDescription(lines.join(' · '));
    if (track.thumbnail) embed.setThumbnail(track.thumbnail);
    await ch.send({ embeds: [embed] });
  }

  /** Text channels the bot can post in. */
  async function getTextChannels(guildId) {
    const g = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    const all = await g.channels.fetch();
    const me = g.members.me || await g.members.fetchMe();
    return [...all.values()]
      .filter((c) => c && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement))
      .filter((c) => c.permissionsFor(me)?.has(PermissionFlagsBits.ViewChannel))
      .sort((a, b) => (a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1) || a.rawPosition - b.rawPosition)
      .map((c) => ({
        id: c.id, name: c.name, category: c.parent?.name || null,
        canPost: !!c.permissionsFor(me)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]),
      }));
  }

  /** Overview of servers and playback. */
  function getStats() {
    return {
      user: client.user?.tag || null,
      guilds: [...client.guilds.cache.values()].map((g) => {
        const p = players.get(g.id);
        return { id: g.id, name: g.name, members: g.memberCount, playing: p?.current?.title || null, channel: p?.channel?.name || null, queue: p?.queue.length || 0 };
      }),
    };
  }

  /** Voice channels the bot may join, sorted like in Discord. */
  async function getVoiceChannels(guildId) {
    const g = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    const all = await g.channels.fetch();
    const me = g.members.me || await g.members.fetchMe();
    return [...all.values()]
      .filter((c) => c && (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice))
      .filter((c) => c.permissionsFor(me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect]))
      .sort((a, b) => (a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1) || a.rawPosition - b.rawPosition)
      .map((c) => ({
        id: c.id, name: c.name, category: c.parent?.name || null,
        users: c.members.filter((m) => !m.user.bot).size,
        canSpeak: !!c.permissionsFor(me)?.has(PermissionFlagsBits.Speak),
      }));
  }

  const command = new SlashCommandBuilder()
    .setName('web')
    .setDescription('Open the music dashboard')
    .setDescriptionLocalizations({ de: 'Öffnet das Musik-Dashboard' })
    .setDMPermission(false);

  client.once(Events.ClientReady, async (c) => {
    log.info(`Eingeloggt als ${c.user.tag} auf ${c.guilds.cache.size} Server(n)`);
    const rest = new REST().setToken(config.token);
    const route = config.guildId ? Routes.applicationGuildCommands(c.user.id, config.guildId) : Routes.applicationCommands(c.user.id);
    // Only /web exists. Registering the full list also removes old commands.
    await rest.put(route, { body: [command.toJSON()] });
    if (config.guildId) await rest.put(Routes.applicationCommands(c.user.id), { body: [] });
    log.info('/web registriert');
    // Administrator, so music and the pranks work without fiddling with single permissions
    log.info(`Einladen: https://discord.com/oauth2/authorize?client_id=${c.user.id}&scope=bot+applications.commands&permissions=${INVITE_PERMISSIONS}`);
    c.user.setActivity('/web');
    pranks.resume();
    // still sitting in a voice channel from before a restart: leave, nothing is playing there
    for (const g of c.guilds.cache.values()) {
      if (g.members.me?.voice.channelId && !getVoiceConnection(g.id)) {
        log.info(`Verlasse alten Sprachkanal auf ${g.name}`);
        leaveVoice(g.id);
      }
    }
  });

  client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand() || i.commandName !== 'web' || !i.guildId) return;
    const isOwner = i.user.id === config.ownerId;
    if (!isOwner && [i.member?.displayName, i.user.username, i.user.globalName].some((n) => n && settings.isBlocked(i.user.id, n))) {
      await i.reply({ content: i.locale?.startsWith('de') ? 'Du darfst /web nicht benutzen.' : 'You are not allowed to use /web.', flags: MessageFlags.Ephemeral });
      return;
    }
    const onlyIn = settings.get(i.guildId).webChannelId;
    if (onlyIn && i.channelId !== onlyIn && !isOwner) {
      const de0 = i.locale?.startsWith('de');
      await i.reply({ content: de0 ? `/web geht auf diesem Server nur in <#${onlyIn}>.` : `/web only works in <#${onlyIn}> on this server.`, flags: MessageFlags.Ephemeral });
      return;
    }
    const token = createToken({
      userId: i.user.id, guildId: i.guildId, userName: i.member?.displayName || i.user.username,
      avatar: i.user.displayAvatarURL({ size: 128, extension: 'png' }),
    });
    const link = `${config.dashboardUrl}#api=${encodeURIComponent(publicUrl)}&t=${encodeURIComponent(token)}`;
    const de = i.locale?.startsWith('de');
    const player = getPlayer(i.guildId);
    const embed = new EmbedBuilder()
      .setColor(ACCENT)
      .setTitle(de ? 'Musik-Dashboard' : 'Music dashboard')
      .setDescription(de
        ? `Dein persönlicher Link für **${i.guild.name}**. Er gilt ${config.sessionHours} Stunden, gib ihn nicht weiter.`
        : `Your personal link for **${i.guild.name}**. It is valid for ${config.sessionHours} hours, do not share it.`);
    if (player.current) {
      embed.addFields({ name: de ? 'Läuft gerade' : 'Now playing', value: `${player.current.title}${player.current.artist ? ` · ${player.current.artist}` : ''}` });
      if (player.current.thumbnail) embed.setThumbnail(player.current.thumbnail);
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(link).setLabel(de ? 'Dashboard öffnen' : 'Open dashboard'),
    );
    await i.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  });

  // Leave when the bot is alone in its voice channel.
  const aloneTimers = new Map();
  client.on(Events.VoiceStateUpdate, (oldS, newS) => {
    const guild = newS.guild;
    const me = guild.members.me?.voice?.channel;
    if (!me) return;
    const humans = me.members.filter((m) => !m.user.bot).size;
    clearTimeout(aloneTimers.get(guild.id));
    if (humans === 0) {
      aloneTimers.set(guild.id, setTimeout(() => players.get(guild.id)?.leave(), config.idleMinutes * 60_000));
    }
    if (newS.id === client.user.id && !newS.channelId) {
      const p = players.get(guild.id);
      if (p) { p.channel = null; p.stop(); }
    }
  });

  return {
    getPlayer,
    getGuildInfo, getMember, getVoiceChannels, getTextChannels, getStats,
    stopAll: () => { for (const p of players.values()) p.leave(); },
    activeCount: () => [...players.values()].filter((p) => p.current && !p.paused).length,
    getName: () => client.user?.username || null,
    pranks, getProfile, setProfile,
    inviteUrl: () => (client.user ? `https://discord.com/oauth2/authorize?client_id=${client.user.id}&scope=bot+applications.commands&permissions=${INVITE_PERMISSIONS}` : null),
    setPublicUrl: (u) => { publicUrl = u; },
    start: () => client.login(config.token).catch((err) => {
      if (err.code === 'TokenInvalid') throw new Error('Token ungültig. Im Developer Portal unter Bot einen neuen Token holen (Reset Token) und in .env eintragen.');
      if (/disallowed intents/i.test(err.message)) throw new Error('Intents nicht erlaubt. Der Bot braucht keine Privileged Intents.');
      throw err;
    }),
  };
}
