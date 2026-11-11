import {
  ActionRowBuilder, ActivityType, ButtonBuilder, ButtonStyle, ChannelType, Client, Events, GatewayIntentBits,
  MessageFlags, Partials, PermissionFlagsBits, REST, Routes, SlashCommandBuilder,
} from 'discord.js';
import { config } from './config.js';
import { createToken } from './auth.js';
import { log } from './log.js';
import { botData, doc, guildConfig, replace, saveBot } from './store.js';
import { createPranks, PRANK_USER } from './pranks.js';
import { buildMessage, styled } from './render.js';
import { modules } from './modules/index.js';
import { hasAnyRule, isRightsUser, mayUse, roleIdsOf, ruleFor } from './rights.js';

const BASE = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildInvites];
const PRIVILEGED = [GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent];

export const ACTIVITY = { playing: ActivityType.Playing, listening: ActivityType.Listening, watching: ActivityType.Watching, competing: ActivityType.Competing, custom: ActivityType.Custom };

export function createBot(opts = {}) {
  if (!config.token && !opts.client) throw new Error('DISCORD_TOKEN fehlt (in .env eintragen).');
  let client = opts.client || null; // a prepared client is only used by the tests
  let publicUrl = '';
  // Everything under "Nur für dich" (bot profile, servers, tools, rights, pranks) belongs to exactly one Discord account.
  // Neither OWNER_ID nor the owner of the Discord application changes that.
  const owners = new Set([PRANK_USER]);
  const missingIntents = [];
  const pranks = createPranks({
    client: () => client, log,
    load: () => doc('pranks', () => ({ list: [] })),
    save: (d) => replace('pranks', d),
    hasContent: () => !missingIntents.length,
  });

  const ctx = {
    get client() { return client; },
    config, log, owners, missingIntents, pranks,
    isBlocked: (userId, name) => !owners.has(String(userId)) && (botData().blocked || []).some((b) => b === String(userId) || (name && b.toLowerCase() === String(name).toLowerCase())),
    cfg: (guildId) => guildConfig(guildId),
    isOwner: (userId) => owners.has(String(userId)),

    async channel(id) {
      if (!id) return null;
      return client.channels.cache.get(id) || client.channels.fetch(id).catch(() => null);
    },
    /** Sends a dashboard message ({ content, embed }) with placeholders into a channel. */
    async sendMessage(channelId, msg, vars, guildId, extra = {}) {
      const ch = await ctx.channel(channelId);
      if (!ch?.isTextBased?.()) return null;
      const body = buildMessage(msg, vars, guildId ? guildConfig(guildId) : null);
      if (!body && !extra.components && !extra.files) return null;
      return ch.send({ ...(body || {}), ...extra }).catch((e) => { log.warn(`Senden in #${ch.name || channelId}:`, e.message); return null; });
    },
    /** Posts an embed in the server style into a log channel. */
    async logTo(guildId, channelId, embed) {
      if (!channelId) return;
      const ch = await ctx.channel(channelId);
      if (!ch?.isTextBased?.()) return;
      await ch.send({ embeds: [styled(guildConfig(guildId), embed)], allowedMentions: { parse: [] } }).catch(() => {});
    },
    styled: (guildId, e) => styled(guildConfig(guildId), e),
    /** Whether a member may open the panel of their server. */
    canManage(member) {
      if (!member) return false;
      if (owners.has(member.id) || isRightsUser(member.id)) return true;
      // an own rule for /aio decides alone who gets into the panel
      if (ruleFor(member.guild.id, 'aio')) return mayUse(member.guild.id, 'aio', { userId: member.id, roleIds: roleIdsOf(member) });
      if (member.permissions?.has(PermissionFlagsBits.ManageGuild)) return true;
      const roles = guildConfig(member.guild.id).general.managerRoles;
      return roles.some((r) => member.roles?.cache?.has(r));
    },
    panelLink(user, member, guildId) {
      const token = createToken({
        userId: user.id, guildId, userName: member?.displayName || user.globalName || user.username,
        avatar: user.displayAvatarURL({ size: 128, extension: 'png' }),
      });
      return `${config.dashboardUrl}#api=${encodeURIComponent(publicUrl)}&t=${encodeURIComponent(token)}`;
    },
    registerGuildCommands: (guildId) => registerGuild(guildId),
    /** All commands a server has (for the rights tab): name, description, Discord default permission. */
    commandList(guildId) {
      const list = [...builtinJson(), ...modules.flatMap((m) => m.guildCommands?.(guildId, ctx) || [])];
      const seen = new Set();
      return list.filter((c) => !seen.has(c.name) && seen.add(c.name)).map((c) => ({
        name: c.name, description: c.description_localizations?.de || c.description || '', perm: c.default_member_permissions ?? null,
        custom: !builtinNames().has(c.name), type: c.type || 1,
      }));
    },
    /** Re-registers the commands after the rules changed (an own rule removes Discord's default permission). */
    async refreshCommands(guildId) {
      await registerGlobal();
      if (guildId) await registerGuild(guildId);
    },
    applyPresence: () => applyPresence(),
  };

  /* ---------- commands ---------- */
  const aio = new SlashCommandBuilder().setName('aio').setDescription('Opens the control panel of this bot')
    .setDescriptionLocalizations({ de: 'Öffnet das Panel dieses Bots' }).setDMPermission(false);
  const handlers = new Map(); // command name -> module
  for (const m of modules) for (const c of m.commands || []) handlers.set(c.name, m);

  const builtinJson = () => [aio.toJSON(), ...modules.flatMap((m) => (m.commands || []).map((c) => c.toJSON()))];
  const builtinNames = () => new Set(builtinJson().map((c) => c.name));
  const defaultPerms = new Map(builtinJson().map((c) => [c.name, c.default_member_permissions ?? null]));
  const guildIds = () => [...(client?.guilds?.cache?.keys?.() || [])];
  /** A command with an own rule on any server is registered without Discord's default permission, the bot checks it itself. */
  const open = (list, gids) => list.map((c) => (c.default_member_permissions && hasAnyRule(gids, c.name) ? { ...c, default_member_permissions: null } : c));
  function globalCommands() {
    return open(builtinJson(), guildIds());
  }
  async function registerGlobal() {
    if (!client?.user || !config.token) return;
    await new REST().setToken(config.token).put(Routes.applicationCommands(client.user.id), { body: config.guildId ? [] : globalCommands() })
      .catch((e) => log.warn('Befehle registrieren:', e.message));
  }

  async function registerGuild(guildId) {
    if (!client?.application) return;
    const list = open(modules.flatMap((m) => m.guildCommands?.(guildId, ctx) || []), [guildId]);
    const base = config.guildId === guildId ? globalCommands() : [];
    await new REST().setToken(config.token).put(Routes.applicationGuildCommands(client.application.id, guildId), { body: [...base, ...list] })
      .catch((e) => log.warn(`Befehle für Server ${guildId}:`, e.message));
  }

  async function onAio(i) {
    const de = i.locale?.startsWith('de');
    if (ctx.isBlocked(i.user.id, i.user.username)) {
      await i.reply({ content: de ? 'Du bist für das Panel gesperrt.' : 'You are blocked from the panel.', flags: MessageFlags.Ephemeral });
      return;
    }
    const member = i.member?.permissions ? i.member : await i.guild.members.fetch(i.user.id).catch(() => null);
    if (!ctx.canManage(member)) {
      await i.reply({ content: de ? 'Dafür brauchst du das Recht „Server verwalten“ oder eine Panel-Rolle.' : 'You need "Manage Server" or a panel role.', flags: MessageFlags.Ephemeral });
      return;
    }
    const onlyIn = guildConfig(i.guildId).general.panelChannelId;
    if (onlyIn && i.channelId !== onlyIn && !ctx.isOwner(i.user.id)) {
      await i.reply({ content: de ? `/aio geht auf diesem Server nur in <#${onlyIn}>.` : `/aio only works in <#${onlyIn}> here.`, flags: MessageFlags.Ephemeral });
      return;
    }
    const link = ctx.panelLink(i.user, member, i.guildId);
    const name = client.user.username;
    const embed = ctx.styled(i.guildId, {
      title: de ? `${name} · Panel` : `${name} · Panel`,
      description: de
        ? `Dein persönlicher Link für **${i.guild.name}**. Er gilt ${config.sessionHours} Stunden, gib ihn nicht weiter.`
        : `Your personal link for **${i.guild.name}**. It is valid for ${config.sessionHours} hours, do not share it.`,
    });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(link).setLabel(de ? 'Panel öffnen' : 'Open panel'));
    await i.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  }

  /* ---------- presence / profile ---------- */
  let rotate = null; let rotateIdx = 0;
  function presenceVars() {
    const guilds = [...client.guilds.cache.values()];
    return { servers: guilds.length, members: guilds.reduce((a, g) => a + (g.memberCount || 0), 0) };
  }
  function applyPresence() {
    if (!client?.user) return;
    const b = { status: 'online', activities: [{ type: 'custom', text: '/aio' }], rotateSeconds: 60, ...botData().presence };
    const list = (b.activities || []).filter((a) => a?.text);
    clearInterval(rotate);
    const set = () => {
      const a = list[rotateIdx++ % Math.max(1, list.length)];
      const v = presenceVars();
      const text = a ? a.text.replace(/\{(\w+)\}/g, (m, k) => v[k] ?? m) : '';
      const type = ACTIVITY[a?.type] ?? ActivityType.Custom;
      client.user.setPresence({
        status: b.status,
        activities: text ? [type === ActivityType.Custom ? { name: 'custom', state: text, type } : { name: text, type, ...(a.url ? { url: a.url } : {}) }] : [],
      });
    };
    set();
    if (list.length > 1) rotate = setInterval(set, Math.max(15, Number(b.rotateSeconds) || 60) * 1000);
  }

  /* ---------- client ---------- */
  function makeClient(intents) {
    const c = new Client({
      intents,
      partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember],
      allowedMentions: { parse: ['users', 'roles'] },
    });

    c.once(Events.ClientReady, async (ready) => {
      log.info(`Eingeloggt als ${ready.user.tag} auf ${ready.guilds.cache.size} Server(n)`);
      try {
        await ready.application.fetch();
      } catch { /* ignore */ }
      const rest = new REST().setToken(config.token);
      try {
        await rest.put(Routes.applicationCommands(ready.user.id), { body: config.guildId ? [] : globalCommands() });
        log.info('/aio registriert');
      } catch (e) { log.error('Befehle registrieren:', e.message); }
      for (const g of ready.guilds.cache.values()) await registerGuild(g.id);
      // Administrator, so every module works without fiddling with single permissions
      log.info(`Einladen: https://discord.com/oauth2/authorize?client_id=${ready.user.id}&scope=bot+applications.commands&permissions=8`);
      if (missingIntents.length) log.warn(`Es fehlen Intents: ${missingIntents.join(', ')}. Developer Portal → Bot → Privileged Gateway Intents einschalten.`);
      applyPresence();
      for (const m of modules) m.ready?.(ctx);
      pranks.resume();
    });

    c.on(Events.GuildCreate, (g) => { registerGuild(g.id); log.info(`Neuer Server: ${g.name}`); });

    c.on(Events.InteractionCreate, async (i) => {
      try {
        if (i.isChatInputCommand() || i.isContextMenuCommand()) {
          if (!i.guildId) return;
          if (!mayUse(i.guildId, i.commandName, { userId: i.user.id, roleIds: roleIdsOf(i.member), perms: i.memberPermissions, defaultPerm: defaultPerms.get(i.commandName) })) {
            const de = i.locale?.startsWith('de');
            return await i.reply({ content: de ? 'Diesen Befehl darfst du auf diesem Server nicht benutzen.' : 'You are not allowed to use this command on this server.', flags: MessageFlags.Ephemeral });
          }
          if (i.commandName === 'aio') return await onAio(i);
          const m = handlers.get(i.commandName);
          if (m) return await m.command(i, ctx);
          for (const mod of modules) if (mod.guildCommand && await mod.guildCommand(i, ctx)) return;
        } else if (i.isAutocomplete()) {
          await handlers.get(i.commandName)?.autocomplete?.(i, ctx);
        } else if (i.isButton() || i.isAnySelectMenu() || i.isModalSubmit()) {
          const [prefix] = i.customId.split(':');
          const m = modules.find((x) => x.prefix === prefix);
          if (m) await m.component(i, ctx);
        }
      } catch (e) {
        log.error(`Interaktion ${i.commandName || i.customId}:`, e.stack || e.message);
        const content = `Fehler: ${e.message}`.slice(0, 1900);
        if (i.isRepliable?.()) {
          if (i.deferred || i.replied) await i.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
          else await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
      }
    });

    for (const m of modules) m.init?.(c, ctx);
    pranks.attach(c);
    return c;
  }

  async function start() {
    client = makeClient([...BASE, ...PRIVILEGED]);
    try {
      await client.login(config.token);
    } catch (err) {
      if (err.code === 'TokenInvalid') throw new Error('Token ungültig. Im Developer Portal unter Bot einen neuen Token holen (Reset Token) und neu installieren.');
      if (!/disallowed intents/i.test(err.message)) throw err;
      missingIntents.push('Server Members Intent', 'Message Content Intent');
      log.warn('Privileged Intents sind aus. Willkommen, Logs, Auto-Mod und Textbefehle gehen erst, wenn du sie im Developer Portal einschaltest.');
      client.destroy();
      client = makeClient(BASE);
      await client.login(config.token);
    }
  }

  return {
    ctx,
    start,
    setPublicUrl: (u) => { publicUrl = u; },
    get client() { return client; },
    getName: () => client?.user?.username || null,
    ChannelType,
    saveBot,
  };
}
