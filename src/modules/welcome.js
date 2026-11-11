import { Events } from 'discord.js';
import { buildMessage, guildVars, userVars } from '../render.js';

function init(client, ctx) {
  client.on(Events.GuildMemberAdd, async (m) => {
    const all = ctx.cfg(m.guild.id);
    const cfg = all.welcome;
    if (!cfg.enabled) return;
    const vars = { ...guildVars(m.guild), ...userVars(m.user, m) };
    const roles = (m.user.bot ? cfg.botRoles : cfg.autoRoles).filter((r) => m.guild.roles.cache.has(r));
    if (roles.length) {
      const give = () => m.roles.add(roles, 'Auto-Rolle').catch((e) => ctx.log.warn('Auto-Rolle:', e.message));
      if (cfg.autoRoleDelay > 0) setTimeout(give, cfg.autoRoleDelay * 1000); else give();
    }
    if (m.user.bot) return;
    if (cfg.channel) await ctx.sendMessage(cfg.channel, cfg.message, vars, m.guild.id);
    if (cfg.dmEnabled) {
      const body = buildMessage(cfg.dm, vars, all);
      if (body) await m.send(body).catch(() => {});
    }
  });
  client.on(Events.GuildMemberRemove, async (m) => {
    const cfg = ctx.cfg(m.guild.id).welcome;
    if (!cfg.enabled || !cfg.goodbyeEnabled || m.user?.bot) return;
    const vars = { ...guildVars(m.guild), ...userVars(m.user, m) };
    await ctx.sendMessage(cfg.goodbyeChannel || cfg.channel, cfg.goodbye, vars, m.guild.id);
  });
}

export default { name: 'welcome', init };
