import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

/*
 * /role give|remove target role: gives a role to one member, to all members of a role,
 * or to everyone (@everyone). Mass runs go one member after the other (discord.js waits for
 * the rate limits) and the reply shows the progress. /role stop ends a running job.
 */

const jobs = new Map(); // guild id -> { stop, done, total, by }
const EDIT_EVERY = 3000; // ms between progress edits
const TOKEN_TIME = 14 * 60_000; // an interaction reply can only be edited for 15 minutes

const target = (o) => o.setName('target').setDescription('@everyone, a role or a member').setRequired(true);
const role = (o) => o.setName('role').setDescription('The role').setRequired(true);
const bots = (o) => o.setName('bots').setDescription('Include bots (default: no)');

const commands = [
  new SlashCommandBuilder().setName('role').setDescription('Give or remove a role for a member, a role or everyone')
    .setDMPermission(false).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) => s.setName('give').setDescription('Give a role').addMentionableOption(target).addRoleOption(role).addBooleanOption(bots))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove a role').addMentionableOption(target).addRoleOption(role).addBooleanOption(bots))
    .addSubcommand((s) => s.setName('stop').setDescription('Stop the running role job')),
];

/** Why the bot or the member may not hand out this role, or '' if it is fine. */
export function roleProblem(guild, role, member) {
  if (role.id === guild.id) return '@everyone kann nicht vergeben werden.';
  if (role.managed) return 'Diese Rolle gehört zu einer Integration und kann nicht vergeben werden.';
  const me = guild.members.me;
  if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return 'Dem Bot fehlt das Recht "Rollen verwalten".';
  if ((me.roles?.highest?.position ?? 0) <= role.position) return 'Die Rolle steht über der höchsten Rolle des Bots. Zieh die Bot-Rolle in den Servereinstellungen nach oben.';
  if (member && guild.ownerId !== member.id && (member.roles?.highest?.position ?? 0) <= role.position) return 'Die Rolle steht über deiner höchsten Rolle.';
  return '';
}

const bar = (n, total) => {
  const w = 16; const f = total ? Math.round((n / total) * w) : w;
  return `${'█'.repeat(f)}${'░'.repeat(w - f)} ${n}/${total}`;
};

/** Changes the role for every member in `members`; `report` is called now and then with the counts. */
export async function runJob(guild, members, roleId, add, { reason = '', report = async () => {}, job = { stop: false } } = {}) {
  const res = { done: 0, failed: 0, total: members.length, stopped: false };
  let last = Date.now();
  for (const m of members) {
    if (job.stop) { res.stopped = true; break; }
    try {
      if (add) await m.roles.add(roleId, reason); else await m.roles.remove(roleId, reason);
      res.done += 1;
    } catch { res.failed += 1; }
    job.done = res.done + res.failed;
    if (Date.now() - last > EDIT_EVERY) { last = Date.now(); await report(res).catch(() => {}); }
  }
  return res;
}

async function command(i, ctx) {
  const g = i.guild;
  const sub = i.options.getSubcommand();
  if (sub === 'stop') {
    const job = jobs.get(g.id);
    if (!job) return i.reply({ content: 'Gerade läuft kein Rollen-Auftrag.', flags: MessageFlags.Ephemeral });
    job.stop = true;
    return i.reply({ content: `Wird gestoppt (${job.done}/${job.total} erledigt).`, flags: MessageFlags.Ephemeral });
  }
  const add = sub === 'give';
  const r = i.options.getRole('role', true);
  const t = i.options.getMentionable('target', true);
  const withBots = i.options.getBoolean('bots') ?? false;
  const problem = roleProblem(g, r, i.member);
  if (problem) return i.reply({ content: problem, flags: MessageFlags.Ephemeral });
  const reason = `/role ${sub} von ${i.user.username}`;

  // a single member
  const isRole = t && 'position' in t && !('user' in t);
  if (!isRole) {
    const m = t.roles?.cache ? t : await g.members.fetch(t.user?.id || t.id).catch(() => null);
    if (!m?.roles) return i.reply({ content: 'Mitglied nicht gefunden.', flags: MessageFlags.Ephemeral });
    if (add === m.roles.cache.has(r.id)) return i.reply({ content: `<@${m.id}> ${add ? 'hat' : 'hat nicht'} <@&${r.id}> schon.`, allowedMentions: { parse: [] } });
    if (add) await m.roles.add(r.id, reason); else await m.roles.remove(r.id, reason);
    return i.reply({ content: `${add ? '✅' : '➖'} <@${m.id}> ${add ? 'hat jetzt' : 'hat nicht mehr'} <@&${r.id}>.`, allowedMentions: { parse: [] } });
  }

  // everyone or the members of a role
  if (ctx.missingIntents?.includes('Server Members Intent')) return i.reply({ content: 'Für viele Mitglieder auf einmal braucht der Bot den „Server Members Intent“: Developer Portal → dein Bot → Bot → Privileged Gateway Intents → Server Members Intent an und speichern. Der Bot merkt das in 2 Minuten selbst und startet neu.', flags: MessageFlags.Ephemeral });
  if (jobs.has(g.id)) return i.reply({ content: 'Es läuft schon ein Rollen-Auftrag. Mit /role stop beenden.', flags: MessageFlags.Ephemeral });
  const job = { stop: false, done: 0, total: 0, by: i.user.id };
  jobs.set(g.id, job);
  try {
    await i.deferReply();
    const all = await g.members.fetch();
    const everyone = t.id === g.id;
    const list = [...all.values()].filter((m) => (withBots || !m.user.bot)
      && (everyone || m.roles.cache.has(t.id)) && add !== m.roles.cache.has(r.id));
    job.total = list.length;
    const who = everyone ? '@everyone' : `<@&${t.id}>`;
    const head = `${add ? 'Gebe' : 'Entferne'} <@&${r.id}> ${add ? 'an' : 'bei'} ${who}`;
    if (!list.length) return i.editReply({ content: `Nichts zu tun: alle passenden Mitglieder ${add ? 'haben' : 'haben nicht'} <@&${r.id}> schon.`, allowedMentions: { parse: [] } });
    const started = Date.now();
    const show = (content) => (Date.now() - started < TOKEN_TIME ? i.editReply({ content, allowedMentions: { parse: [] } }) : Promise.resolve());
    await show(`${head}…\n\`${bar(0, list.length)}\``);
    const res = await runJob(g, list, r.id, add, { reason, job, report: (x) => show(`${head}…\n\`${bar(x.done + x.failed, x.total)}\``) });
    const lines = [`${res.stopped ? '⏹️ Gestoppt' : '✅ Fertig'}: ${head}`, `\`${bar(res.done + res.failed, res.total)}\``, `${res.done} geändert${res.failed ? `, ${res.failed} fehlgeschlagen` : ''}.`];
    if (Date.now() - started < TOKEN_TIME) await i.editReply({ content: lines.join('\n'), allowedMentions: { parse: [] } });
    else await i.channel?.send({ content: `<@${i.user.id}> ${lines.join('\n')}`, allowedMentions: { users: [i.user.id] } }).catch(() => {});
    ctx.log.info(`/role ${sub} ${r.name}: ${res.done} geändert, ${res.failed} Fehler (${g.name})`);
  } finally {
    jobs.delete(g.id);
  }
}

export default { name: 'rolecmd', commands, command };
