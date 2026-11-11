import { AuditLogEvent, Events } from 'discord.js';

const CAT = {
  messageDelete: 'messages', messageEdit: 'messages', bulkDelete: 'messages',
  memberJoin: 'members', memberLeave: 'members', memberBan: 'members', memberUnban: 'members', nickname: 'members', roles: 'members', timeout: 'members',
  channelCreate: 'server', channelDelete: 'server', roleCreate: 'server', roleDelete: 'server', invites: 'server',
  voice: 'voice',
};

const ts = (t) => `<t:${Math.floor(t / 1000)}:R>`;

function init(client, ctx) {
  const post = (guild, event, embed, channelId) => {
    if (!guild) return;
    const cfg = ctx.cfg(guild.id).logs;
    if (!cfg.enabled || !cfg.events[event]) return;
    if (channelId && (cfg.ignoreChannels.includes(channelId))) return;
    const target = cfg.channels[CAT[event]] || cfg.channel;
    if (!target || target === channelId) return;
    ctx.logTo(guild.id, target, embed);
  };
  const skipBot = (guild, user) => user?.bot && ctx.cfg(guild.id).logs.ignoreBots;

  client.on(Events.MessageDelete, (m) => {
    if (!m.guild || skipBot(m.guild, m.author)) return;
    post(m.guild, 'messageDelete', {
      title: 'Nachricht gelöscht', color: '#ef4444',
      description: `${m.author ? `Von <@${m.author.id}>` : 'Unbekannter Autor'} in <#${m.channelId}>\n\n${(m.content || (m.partial ? '_nicht im Speicher_' : '_kein Text_')).slice(0, 3500)}`,
      fields: m.attachments?.size ? [{ name: 'Anhänge', value: [...m.attachments.values()].map((a) => a.name).join(', ').slice(0, 1000) }] : [],
      footer: m.author ? `ID ${m.author.id}` : '',
    }, m.channelId);
  });
  client.on(Events.MessageUpdate, (o, m) => {
    if (!m.guild || skipBot(m.guild, m.author) || o.content === m.content || o.partial) return;
    post(m.guild, 'messageEdit', {
      title: 'Nachricht bearbeitet', color: '#f59e0b',
      description: `Von <@${m.author.id}> in <#${m.channelId}> · [Zur Nachricht](${m.url})`,
      fields: [{ name: 'Vorher', value: (o.content || '-').slice(0, 1000) }, { name: 'Nachher', value: (m.content || '-').slice(0, 1000) }],
    }, m.channelId);
  });
  client.on(Events.MessageBulkDelete, (msgs, ch) => {
    post(ch.guild, 'bulkDelete', { title: 'Mehrere Nachrichten gelöscht', color: '#ef4444', description: `${msgs.size} Nachrichten in <#${ch.id}>` }, ch.id);
  });
  client.on(Events.GuildMemberAdd, (m) => post(m.guild, 'memberJoin', {
    title: 'Mitglied beigetreten', color: '#22c55e', thumbnail: m.displayAvatarURL({ size: 128 }),
    description: `<@${m.id}> (${m.user.tag})\nKonto erstellt ${ts(m.user.createdTimestamp)}`, footer: `ID ${m.id} · ${m.guild.memberCount} Mitglieder`,
  }));
  client.on(Events.GuildMemberRemove, (m) => post(m.guild, 'memberLeave', {
    title: 'Mitglied gegangen', color: '#64748b', thumbnail: m.displayAvatarURL?.({ size: 128 }),
    description: `<@${m.id}> (${m.user?.tag || m.id})${m.joinedTimestamp ? `\nWar dabei seit ${ts(m.joinedTimestamp)}` : ''}${m.roles?.cache?.size > 1 ? `\nRollen: ${m.roles.cache.filter((r) => r.id !== m.guild.id).map((r) => `<@&${r.id}>`).join(' ').slice(0, 900)}` : ''}`,
    footer: `ID ${m.id}`,
  }));
  client.on(Events.GuildBanAdd, async (ban) => {
    let by = '';
    try {
      const logs = await ban.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 });
      const e = logs.entries.first();
      if (e && e.target?.id === ban.user.id) by = `\nVon <@${e.executor.id}>${e.reason ? `: ${e.reason}` : ''}`;
    } catch { /* no audit log access */ }
    post(ban.guild, 'memberBan', { title: 'Mitglied gebannt', color: '#b91c1c', description: `<@${ban.user.id}> (${ban.user.tag})${by}` });
  });
  client.on(Events.GuildBanRemove, (ban) => post(ban.guild, 'memberUnban', { title: 'Bann aufgehoben', color: '#22c55e', description: `<@${ban.user.id}> (${ban.user.tag})` }));
  client.on(Events.GuildMemberUpdate, (o, m) => {
    if (o.partial) return;
    if (o.nickname !== m.nickname) {
      post(m.guild, 'nickname', { title: 'Nickname geändert', color: '#3b82f6', description: `<@${m.id}>\n**Vorher:** ${o.nickname || '-'}\n**Nachher:** ${m.nickname || '-'}` });
    }
    const added = m.roles.cache.filter((r) => !o.roles.cache.has(r.id));
    const removed = o.roles.cache.filter((r) => !m.roles.cache.has(r.id));
    if (added.size || removed.size) {
      post(m.guild, 'roles', {
        title: 'Rollen geändert', color: '#8b5cf6', description: `<@${m.id}>`,
        fields: [
          ...(added.size ? [{ name: 'Dazu', value: added.map((r) => `<@&${r.id}>`).join(' ').slice(0, 1000) }] : []),
          ...(removed.size ? [{ name: 'Weg', value: removed.map((r) => `<@&${r.id}>`).join(' ').slice(0, 1000) }] : []),
        ],
      });
    }
    if (o.communicationDisabledUntilTimestamp !== m.communicationDisabledUntilTimestamp) {
      const until = m.communicationDisabledUntilTimestamp;
      post(m.guild, 'timeout', {
        title: until && until > Date.now() ? 'Timeout' : 'Timeout beendet', color: '#f97316',
        description: `<@${m.id}>${until && until > Date.now() ? ` bis ${ts(until)}` : ''}`,
      });
    }
  });
  client.on(Events.ChannelCreate, (c) => c.guild && post(c.guild, 'channelCreate', { title: 'Kanal erstellt', color: '#22c55e', description: `<#${c.id}> (${c.name})` }));
  client.on(Events.ChannelDelete, (c) => c.guild && post(c.guild, 'channelDelete', { title: 'Kanal gelöscht', color: '#ef4444', description: `#${c.name}` }));
  client.on(Events.GuildRoleCreate, (r) => post(r.guild, 'roleCreate', { title: 'Rolle erstellt', color: '#22c55e', description: `<@&${r.id}> (${r.name})` }));
  client.on(Events.GuildRoleDelete, (r) => post(r.guild, 'roleDelete', { title: 'Rolle gelöscht', color: '#ef4444', description: r.name }));
  client.on(Events.InviteCreate, (inv) => inv.guild && post(inv.guild, 'invites', {
    title: 'Einladung erstellt', color: '#3b82f6',
    description: `discord.gg/${inv.code} von ${inv.inviter ? `<@${inv.inviter.id}>` : '?'} für <#${inv.channelId}>${inv.maxUses ? ` · max. ${inv.maxUses}x` : ''}`,
  }));
  client.on(Events.VoiceStateUpdate, (o, n) => {
    if (o.channelId === n.channelId || skipBot(n.guild, n.member?.user)) return;
    const who = `<@${n.id}>`;
    const description = !o.channelId ? `${who} ist <#${n.channelId}> beigetreten`
      : !n.channelId ? `${who} hat <#${o.channelId}> verlassen` : `${who}: <#${o.channelId}> → <#${n.channelId}>`;
    post(n.guild, 'voice', { title: 'Sprachkanal', color: '#0ea5e9', description });
  });
}

export default { name: 'logs', init };
