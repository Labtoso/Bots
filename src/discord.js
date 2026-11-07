import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, Events, GatewayIntentBits,
  MessageFlags, REST, Routes, SlashCommandBuilder,
} from 'discord.js';
import { VoiceConnectionStatus, entersState, getVoiceConnection, joinVoiceChannel } from '@discordjs/voice';
import { config } from './config.js';
import { createToken } from './auth.js';
import { GuildPlayer } from './player.js';
import { log } from './log.js';

const ACCENT = 0x3b82f6;

export function createDiscordBot() {
  if (!config.token) throw new Error('DISCORD_TOKEN fehlt (in .env eintragen).');
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  const players = new Map();
  let publicUrl = '';

  function getPlayer(guildId) {
    if (!players.has(guildId)) {
      const player = new GuildPlayer(guildId, {
        connect: async (channelId, audio) => {
          const guild = await client.guilds.fetch(guildId);
          const channel = await guild.channels.fetch(channelId);
          const conn = joinVoiceChannel({
            channelId, guildId, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true,
          });
          await entersState(conn, VoiceConnectionStatus.Ready, 20_000);
          conn.subscribe(audio);
          conn.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
              await Promise.race([
                entersState(conn, VoiceConnectionStatus.Signalling, 5_000),
                entersState(conn, VoiceConnectionStatus.Connecting, 5_000),
              ]);
            } catch {
              conn.destroy();
              player.channel = null;
              player.stop();
            }
          });
          return { id: channel.id, name: channel.name };
        },
        disconnect: () => getVoiceConnection(guildId)?.destroy(),
      });
      players.set(guildId, player);
    }
    return players.get(guildId);
  }

  async function getGuildInfo(guildId) {
    const g = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    return { id: g.id, name: g.name, icon: g.iconURL({ size: 128, extension: 'png' }) };
  }

  async function getMember(guildId, userId) {
    const g = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
    const m = await g.members.fetch(userId).catch(() => null);
    return { id: userId, voiceChannelId: m?.voice?.channelId || null };
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
    c.user.setActivity('/web');
  });

  client.on(Events.InteractionCreate, async (i) => {
    if (!i.isChatInputCommand() || i.commandName !== 'web' || !i.guildId) return;
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
    getPlayer, getGuildInfo, getMember,
    getName: () => client.user?.username || null,
    setPublicUrl: (u) => { publicUrl = u; },
    start: () => client.login(config.token),
  };
}
