import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { guildData, saveData } from '../store.js';
import { guildVars, userVars } from '../render.js';

export const bdays = (gid) => guildData(gid, 'birthdays', () => ({ users: {}, lastDay: '', withRole: [] }));
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const commands = [
  new SlashCommandBuilder().setName('geburtstag').setDescription('Geburtstage').setDMPermission(false)
    .addSubcommand((s) => s.setName('setzen').setDescription('Deinen Geburtstag eintragen')
      .addIntegerOption((o) => o.setName('tag').setDescription('Tag').setMinValue(1).setMaxValue(31).setRequired(true))
      .addIntegerOption((o) => o.setName('monat').setDescription('Monat').setMinValue(1).setMaxValue(12).setRequired(true))
      .addIntegerOption((o) => o.setName('jahr').setDescription('Jahr (optional, für das Alter)').setMinValue(1900).setMaxValue(2030)))
    .addSubcommand((s) => s.setName('entfernen').setDescription('Deinen Geburtstag löschen'))
    .addSubcommand((s) => s.setName('liste').setDescription('Die nächsten Geburtstage')),
];

function next(b) {
  const now = new Date();
  let d = new Date(now.getFullYear(), b.m - 1, b.d);
  if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(now.getFullYear() + 1, b.m - 1, b.d);
  return d;
}

async function command(i, ctx) {
  if (!ctx.cfg(i.guildId).birthdays.enabled) return i.reply({ content: 'Geburtstage sind auf diesem Server aus (Panel: /aio).', flags: MessageFlags.Ephemeral });
  const d = bdays(i.guildId);
  const sub = i.options.getSubcommand();
  if (sub === 'setzen') {
    const day = i.options.getInteger('tag'); const m = i.options.getInteger('monat'); const y = i.options.getInteger('jahr') || null;
    const test = new Date(2000, m - 1, day);
    if (test.getMonth() !== m - 1) return i.reply({ content: 'Dieses Datum gibt es nicht.', flags: MessageFlags.Ephemeral });
    d.users[i.user.id] = { d: day, m, y };
    saveData(i.guildId, 'birthdays');
    return i.reply({ content: `Gespeichert: ${day}. ${MONTHS[m - 1]}${y ? ` ${y}` : ''} 🎂`, flags: MessageFlags.Ephemeral });
  }
  if (sub === 'entfernen') {
    delete d.users[i.user.id];
    saveData(i.guildId, 'birthdays');
    return i.reply({ content: 'Dein Geburtstag ist gelöscht.', flags: MessageFlags.Ephemeral });
  }
  const list = Object.entries(d.users).map(([id, b]) => ({ id, b, at: next(b) })).sort((a, b) => a.at - b.at).slice(0, 15);
  const text = list.map((x) => `**${x.b.d}. ${MONTHS[x.b.m - 1]}** · <@${x.id}>`).join('\n') || 'Noch keine Geburtstage eingetragen. Nutze `/geburtstag setzen`.';
  return i.reply({ embeds: [ctx.styled(i.guildId, { title: '🎂 Nächste Geburtstage', description: text })], allowedMentions: { parse: [] } });
}

function ready(ctx) {
  setInterval(async () => {
    const now = new Date();
    const day = now.toLocaleDateString('sv-SE');
    const time = now.toTimeString().slice(0, 5);
    for (const g of ctx.client.guilds.cache.values()) {
      const cfg = ctx.cfg(g.id).birthdays;
      if (!cfg.enabled) continue;
      const d = bdays(g.id);
      if (d.lastDay === day || time < cfg.time) continue;
      d.lastDay = day;
      for (const id of d.withRole || []) await g.members.fetch(id).then((m) => m.roles.remove(cfg.role)).catch(() => {});
      d.withRole = [];
      for (const [id, b] of Object.entries(d.users)) {
        if (b.d !== now.getDate() || b.m !== now.getMonth() + 1) continue;
        const member = await g.members.fetch(id).catch(() => null);
        if (!member) continue;
        const age = b.y ? now.getFullYear() - b.y : null;
        if (cfg.channel) await ctx.sendMessage(cfg.channel, cfg.message, { ...guildVars(g), ...userVars(member.user, member), age: age ? ` (${age})` : '', 'age.number': age ?? '' }, g.id);
        if (cfg.role && g.roles.cache.has(cfg.role)) { await member.roles.add(cfg.role, 'Geburtstag').catch(() => {}); d.withRole.push(id); }
      }
      saveData(g.id, 'birthdays');
    }
  }, 60_000);
}

export default { name: 'birthdays', commands, command, ready };
