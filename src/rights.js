/* Who may use which command, per server. Only one Discord account (config.rightsUser) can see and change this. */
import { config } from './config.js';
import { guildData, saveData } from './store.js';

export const MODES = ['default', 'custom', 'off'];
const ids = (a) => (Array.isArray(a) ? [...new Set(a.map(String).filter((x) => /^\d{1,25}$/.test(x)))].slice(0, 100) : []);

export const isRightsUser = (userId) => !!config.rightsUser && String(userId) === config.rightsUser;
export const rightsData = (gid) => guildData(gid, 'rights', () => ({ commands: {} }));

/** The rule for one command, or null when the normal Discord permissions apply. */
export function ruleFor(gid, name) {
  const r = rightsData(gid).commands[name];
  return r && r.mode !== 'default' ? r : null;
}

/** Whether any server has its own rule for this command (then the command is registered without Discord's default permissions). */
export function hasAnyRule(guildIds, name) {
  return guildIds.some((g) => ruleFor(g, name));
}

/** Role ids of an interaction member or a GuildMember. */
export function roleIdsOf(member) {
  if (!member?.roles) return [];
  if (Array.isArray(member.roles)) return member.roles.map(String);
  return [...(member.roles.cache?.keys?.() || [])];
}

/**
 * Decides if a user may run a command.
 * default: Discord permissions of the command (checked here as well, because the command may be registered without them),
 * custom: only the chosen roles or users, off: nobody. The rights account may always.
 */
export function mayUse(gid, name, { userId, roleIds = [], perms = null, defaultPerm = null }) {
  if (isRightsUser(userId)) return true;
  const r = ruleFor(gid, name);
  if (!r) {
    if (!defaultPerm) return true;
    try { return !!perms?.has?.(BigInt(defaultPerm)); } catch { return true; }
  }
  if (r.mode === 'off') return false;
  return r.users.includes(String(userId)) || r.roles.some((x) => roleIds.includes(x));
}

/** Saves the rules sent by the panel; unknown commands are dropped. */
export function saveRights(gid, input, known) {
  const out = {};
  for (const [name, r] of Object.entries(input || {})) {
    if (!known.has(name) || !r || !MODES.includes(r.mode)) continue;
    const roles = ids(r.roles); const users = ids(r.users);
    if (r.mode === 'default' && !roles.length && !users.length) continue;
    out[name] = { mode: r.mode, roles, users };
  }
  const d = rightsData(gid);
  d.commands = out;
  saveData(gid, 'rights');
  return d;
}
