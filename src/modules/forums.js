import { ChannelType, Events } from 'discord.js';
import { buildMessage, guildVars, userVars } from '../render.js';

/*
 * Bugs and update suggestions in forum channels. The status of a post is one of its tags
 * (new, in development, fixed/finished); posts with the admin tag are notes of the team.
 */

export const KINDS = ['bugs', 'suggestions'];
export const STATUSES = ['new', 'dev', 'done'];
const DEFAULT_TAGS = {
  bugs: { new: ['new', '📣'], dev: ['in development', '💻'], done: ['fixed', '✅'], admin: ['admin', '⚡'] },
  suggestions: { new: ['new', '📣'], dev: ['in development', '💻'], done: ['finished', '✅'], admin: ['admin', '⚡'] },
};

async function forumOf(ctx, gid, kind) {
  const cfg = ctx.cfg(gid)[kind];
  if (!cfg?.channel) throw new Error('Bitte zuerst einen Forum-Kanal wählen und speichern.');
  const ch = await ctx.channel(cfg.channel);
  if (!ch || ch.type !== ChannelType.GuildForum) throw new Error('Der gewählte Kanal ist kein Forum.');
  return { ch, cfg };
}

function statusOf(cfg, tagIds) {
  if (cfg.tags.done && tagIds.includes(cfg.tags.done)) return 'done';
  if (cfg.tags.dev && tagIds.includes(cfg.tags.dev)) return 'dev';
  if (cfg.tags.new && tagIds.includes(cfg.tags.new)) return 'new';
  return 'none';
}

async function postInfo(ch, cfg, t, { full = false } = {}) {
  const tags = t.appliedTags || [];
  const names = tags.map((id) => ch.availableTags?.find((x) => x.id === id)?.name).filter(Boolean);
  const starter = await t.fetchStarterMessage?.().catch(() => null);
  const owner = t.guild.members.cache.get(t.ownerId) || await t.guild.members.fetch(t.ownerId).catch(() => null);
  const out = {
    id: t.id, title: t.name, url: `https://discord.com/channels/${t.guildId}/${t.id}`, guild: t.guildId,
    status: statusOf(cfg, tags), admin: !!(cfg.tags.admin && tags.includes(cfg.tags.admin)), tags: names,
    author: owner?.displayName || owner?.user?.username || t.ownerId, authorId: t.ownerId,
    created: t.createdTimestamp, archived: !!t.archived, messages: t.messageCount ?? null,
    text: starter?.content || '', images: starter ? [...starter.attachments.values()].map((a) => a.url) : [],
    reactions: starter ? [...starter.reactions.cache.values()].map((r) => `${r.emoji.name} ${r.count}`) : [],
  };
  if (full) {
    const msgs = await t.messages.fetch({ limit: 50 }).catch(() => null);
    out.thread = msgs ? [...msgs.values()].reverse().filter((m) => m.id !== starter?.id).map((m) => ({
      author: m.member?.displayName || m.author.username, bot: m.author.bot, at: m.createdTimestamp, text: m.content,
      images: [...m.attachments.values()].map((a) => a.url),
    })) : [];
  }
  return out;
}

/** Posts of a forum, newest first. `status`: list of statuses to keep (empty = all). */
export async function listPosts(ctx, gid, kind, { status = [], admin = false, limit = 50 } = {}) {
  const { ch, cfg } = await forumOf(ctx, gid, kind);
  const active = await ch.threads.fetchActive().catch(() => null);
  const archived = await ch.threads.fetchArchived({ limit: 50 }).catch(() => null);
  const all = new Map();
  for (const col of [active?.threads, archived?.threads]) for (const [id, t] of col || []) if (t.parentId === ch.id) all.set(id, t);
  const threads = [...all.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  const out = [];
  for (const t of threads) {
    if (out.length >= limit) break;
    const tags = t.appliedTags || [];
    const st = statusOf(cfg, tags);
    if (!admin && cfg.tags.admin && tags.includes(cfg.tags.admin)) continue;
    if (status.length && !status.includes(st) && !(st === 'none' && status.includes('new'))) continue;
    out.push(await postInfo(ch, cfg, t));
  }
  return out;
}

export async function getPost(ctx, gid, kind, id) {
  const { ch, cfg } = await forumOf(ctx, gid, kind);
  const t = ch.threads.cache.get(id) || await ctx.client.channels.fetch(id).catch(() => null);
  if (!t || t.parentId !== ch.id) throw new Error('Post nicht gefunden.');
  return postInfo(ch, cfg, t, { full: true });
}

/** Moves a post to new / dev / done: swaps the status tag and writes the status message into the post. */
export async function setStatus(ctx, gid, kind, id, status, { note = '', by = '' } = {}) {
  if (!STATUSES.includes(status)) throw new Error('Status muss new, dev oder done sein.');
  const { ch, cfg } = await forumOf(ctx, gid, kind);
  const t = ch.threads.cache.get(id) || await ctx.client.channels.fetch(id).catch(() => null);
  if (!t || t.parentId !== ch.id) throw new Error('Post nicht gefunden.');
  const want = cfg.tags[status];
  if (!want) throw new Error('Für diesen Status ist kein Tag eingestellt.');
  if (t.archived) await t.setArchived(false).catch(() => {});
  const statusTags = STATUSES.map((s) => cfg.tags[s]).filter(Boolean);
  const tags = [...(t.appliedTags || []).filter((x) => !statusTags.includes(x)), want].slice(-5);
  await t.setAppliedTags(tags, by ? `Status von ${by}` : 'Status');
  if (cfg.replyStatus && status !== 'new') {
    const owner = await t.guild.members.fetch(t.ownerId).catch(() => null);
    const vars = { ...guildVars(t.guild), ...userVars(owner?.user, owner), title: t.name, note, by };
    const body = buildMessage(status === 'dev' ? cfg.devMessage : cfg.doneMessage, vars, ctx.cfg(gid));
    if (body) await t.send(body).catch((e) => ctx.log.warn('Forum-Status:', e.message));
  }
  if (status === 'done' && cfg.closeDone) await t.setArchived(true).catch(() => {});
  return postInfo(ch, cfg, t);
}

/** Creates the tags new / in development / fixed (finished) / admin where they are missing and links them. */
export async function ensureTags(ctx, gid, kind) {
  const { ch, cfg } = await forumOf(ctx, gid, kind);
  const tags = [...(ch.availableTags || [])];
  const map = { ...cfg.tags };
  const add = [];
  for (const [key, [name, emoji]] of Object.entries(DEFAULT_TAGS[kind])) {
    if (map[key] && tags.some((t) => t.id === map[key])) continue;
    const found = tags.find((t) => t.name.toLowerCase() === name);
    if (found) map[key] = found.id;
    else add.push({ key, name, emoji });
  }
  if (add.length) {
    if (tags.length + add.length > 20) throw new Error('Ein Forum kann höchstens 20 Tags haben.');
    const next = await ch.setAvailableTags([...tags.map((t) => ({ id: t.id, name: t.name, moderated: t.moderated, emoji: t.emoji })), ...add.map((a) => ({ name: a.name, emoji: { id: null, name: a.emoji }, moderated: a.key !== 'new' }))]);
    for (const a of add) map[a.key] = (next.availableTags || []).find((t) => t.name === a.name)?.id || '';
  }
  return map;
}

function init(client, ctx) {
  client.on(Events.ThreadCreate, async (t, newly) => {
    if (!newly || !t.guildId) return;
    for (const kind of KINDS) {
      const cfg = ctx.cfg(t.guildId)[kind];
      if (!cfg?.enabled || t.parentId !== cfg.channel) continue;
      if (t.ownerId === client.user.id) return;
      await new Promise((r) => setTimeout(r, 1500)); // the first message of the post has to exist first
      const tags = t.appliedTags || [];
      if (cfg.tags.admin && tags.includes(cfg.tags.admin)) return;
      if (cfg.tagNew && cfg.tags.new && statusOf(cfg, tags) === 'none') {
        await t.setAppliedTags([...tags, cfg.tags.new].slice(-5), 'Neuer Post').catch((e) => ctx.log.warn('Forum-Tag:', e.message));
      }
      if (cfg.replyNew) {
        const owner = await t.guild.members.fetch(t.ownerId).catch(() => null);
        const body = buildMessage(cfg.newMessage, { ...guildVars(t.guild), ...userVars(owner?.user, owner), title: t.name, note: '', by: '' }, ctx.cfg(t.guildId));
        if (body) await t.send(body).catch((e) => ctx.log.warn('Forum-Antwort:', e.message));
      }
    }
  });
}

export default { name: 'forums', init };
