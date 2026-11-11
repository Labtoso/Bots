import { Events, MessageFlags } from 'discord.js';
import { buildMessage, guildVars, userVars } from '../render.js';

const cooldowns = new Map();
export const slashName = (n) => String(n || '').toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 32);

function vars(guild, member, user, channelId, args) {
  const parts = args.split(/\s+/).filter(Boolean);
  const v = { ...guildVars(guild), ...userVars(user, member), channel: `<#${channelId}>`, args, 'args.count': parts.length };
  parts.forEach((p, n) => { v[`args.${n + 1}`] = p; });
  return v;
}

/** Checks the conditions; returns an error text or null. */
function blocked(cmd, member, channelId) {
  if (cmd.channels?.length && !cmd.channels.includes(channelId)) return 'Dieser Befehl geht hier nicht.';
  if (cmd.requiredRoles?.length && !cmd.requiredRoles.some((r) => member.roles.cache.has(r))) return 'Dafür fehlt dir die Rolle.';
  const key = `${cmd.id}:${member.id}`;
  const left = (cooldowns.get(key) || 0) + (Number(cmd.cooldown) || 0) * 1000 - Date.now();
  if (left > 0) return `Warte noch ${Math.ceil(left / 1000)} Sekunden.`;
  cooldowns.set(key, Date.now());
  return null;
}

async function roles(cmd, member) {
  const add = (cmd.addRoles || []).filter((r) => member.guild.roles.cache.has(r));
  const rem = (cmd.removeRoles || []).filter((r) => member.guild.roles.cache.has(r));
  if (add.length) await member.roles.add(add, `Befehl ${cmd.name}`).catch(() => {});
  if (rem.length) await member.roles.remove(rem, `Befehl ${cmd.name}`).catch(() => {});
}

function pickResponse(cmd) {
  const extra = (cmd.random || []).filter((x) => x && String(x).trim());
  if (!extra.length) return cmd.response;
  const all = [cmd.response, ...extra.map((c) => ({ content: c, embed: { enabled: false } }))];
  return all[Math.floor(Math.random() * all.length)];
}

function guildCommands(guildId, ctx) {
  const cfg = ctx.cfg(guildId).customcmds;
  if (!cfg.enabled) return [];
  const seen = new Set();
  return cfg.commands.filter((c) => c.trigger === 'slash' && c.enabled !== false && slashName(c.name)).filter((c) => {
    const n = slashName(c.name);
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  }).slice(0, 90).map((c) => ({
    name: slashName(c.name), description: (c.description || 'Eigener Befehl').slice(0, 100), dm_permission: false,
    options: [{ type: 3, name: 'text', description: 'Zusätzlicher Text ({args})', required: false }],
  }));
}

async function guildCommand(i, ctx) {
  const all = ctx.cfg(i.guildId);
  const cmd = all.customcmds.enabled && all.customcmds.commands.find((c) => c.trigger === 'slash' && c.enabled !== false && slashName(c.name) === i.commandName);
  if (!cmd) return false;
  const err = blocked(cmd, i.member, i.channelId);
  if (err) { await i.reply({ content: err, flags: MessageFlags.Ephemeral }); return true; }
  const body = buildMessage(pickResponse(cmd), vars(i.guild, i.member, i.user, i.channelId, i.options.getString('text') || ''), all) || { content: '✅' };
  await roles(cmd, i.member);
  if (cmd.dm) {
    await i.user.send(body).catch(() => {});
    await i.reply({ content: '📬', flags: MessageFlags.Ephemeral });
  } else await i.reply({ ...body, ...(cmd.ephemeral ? { flags: MessageFlags.Ephemeral } : {}) });
  return true;
}

function init(client, ctx) {
  client.on(Events.MessageCreate, async (m) => {
    if (!m.guild || m.author.bot || !m.content) return;
    const all = ctx.cfg(m.guild.id);
    const cfg = all.customcmds;
    if (!cfg.enabled || !cfg.commands.length) return;
    const text = m.content.trim();
    const lower = text.toLowerCase();
    let args = '';
    const cmd = cfg.commands.find((c) => {
      if (c.enabled === false || !c.name) return false;
      const n = String(c.name).toLowerCase();
      switch (c.trigger) {
        case 'prefix': {
          const p = `${cfg.prefix}${n}`;
          if (lower === p || lower.startsWith(`${p} `)) { args = text.slice(p.length).trim(); return true; }
          return false;
        }
        case 'exact': return lower === n;
        case 'startswith': if (lower.startsWith(n)) { args = text.slice(n.length).trim(); return true; } return false;
        case 'contains': return lower.includes(n);
        default: return false;
      }
    });
    if (!cmd) return;
    const member = m.member || await m.guild.members.fetch(m.author.id).catch(() => null);
    if (!member) return;
    const err = blocked(cmd, member, m.channelId);
    if (err) { if (cmd.trigger === 'prefix') m.reply({ content: err, allowedMentions: { repliedUser: false } }).catch(() => {}); return; }
    const body = buildMessage(pickResponse(cmd), vars(m.guild, member, m.author, m.channelId, args), all);
    await roles(cmd, member);
    if (body) {
      if (cmd.dm) await m.author.send(body).catch(() => {});
      else if (cmd.reply) await m.reply({ ...body, allowedMentions: { ...body.allowedMentions, repliedUser: true } }).catch(() => {});
      else await m.channel.send(body).catch(() => {});
    }
    if (cmd.deleteTrigger) await m.delete().catch(() => {});
  });
}

export default { name: 'customcmds', init, guildCommands, guildCommand };
