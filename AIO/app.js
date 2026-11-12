/* AIO panel: talks to the bot API that /aio links to. */
'use strict';

/* ---------- small helpers ---------- */
const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(`aio.${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`aio.${k}`, JSON.stringify(v)); } catch { /* private mode */ } },
};
function h(tag, attrs, ...kids) {
  const [t, ...cls] = tag.split('.');
  const e = document.createElement(t || 'div');
  if (cls.length) e.className = cls.join(' ');
  if (attrs !== null && attrs !== undefined && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className += ` ${v}`;
    else if (k === 'html') e.innerHTML = v;
    else if (k in e && k !== 'list' && k !== 'type') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
const ICONS = {
  prank: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/><path d="M7 4.5 5 2M17 4.5 19 2"/>',
  tool: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01"/>',
  embed: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 4v16"/><path d="M8 9h8M8 13h6"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  robot: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  logs: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  wave: '<path d="M7 11V6a2 2 0 1 1 4 0v5"/><path d="M11 10V4a2 2 0 1 1 4 0v6"/><path d="M15 10V6a2 2 0 1 1 4 0v8a7 7 0 0 1-14 0v-2a2 2 0 1 1 4 0"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  roles: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M19 8v6M16 11h6"/>',
  cmd: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  cube: '<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cake: '<path d="M4 21h16v-8H4z"/><path d="M4 16c2 1 4 1 6 0s4-1 6 0 3 1 4 0"/><path d="M12 13V9M12 6V5"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z"/><path d="M13 6v14"/>',
  gift: '<rect x="3" y="8" width="18" height="5"/><path d="M5 13v8h14v-8M12 8v13"/><path d="M12 8C9 8 7 4 9 3s3 5 3 5 1-6 3-5-0 5-3 5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  caret: '<path d="m9 6 6 6-6 6"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
};
const icon = (n) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'i'); s.innerHTML = ICONS[n] || ''; return s; };
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = (t) => {
  if (!t) return '-';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'gerade eben';
  if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`;
  return `vor ${Math.round(s / 86400)} Tagen`;
};
const fmtDate = (t) => (t ? new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');

let toastTimer = null;
function toast(text, err = false) {
  document.querySelector('.toast')?.remove();
  const t = h('div.toast', { class: err ? 'err' : '' }, text);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), err ? 6000 : 2800);
}

/* ---------- backends + session from the /aio link ---------- */
const norm = (u) => String(u || '').trim().replace(/\/+$/, '');
let backends = store.get('backends', []);
let activeApi = store.get('active', backends[0]?.api || null);
const saveBackends = () => { store.set('backends', backends); store.set('active', activeApi); };
function upsertBackend(api, data = {}) {
  api = norm(api);
  let b = backends.find((x) => x.api === api);
  if (!b) { b = { api }; backends.push(b); }
  Object.assign(b, data);
  saveBackends();
  return b;
}
function readLink() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (!p.get('api') || !p.get('t')) return false;
  upsertBackend(p.get('api'), { token: p.get('t').replace(/\s+/g, '') });
  activeApi = norm(p.get('api'));
  saveBackends();
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}
readLink();
window.addEventListener('hashchange', () => {
  if (readLink()) boot();
  else if (location.hash === '#anleitung') go('anleitung');
});

async function loadPresetBackends() {
  try {
    const res = await fetch('backends.json', { cache: 'no-store' });
    if (!res.ok) return;
    for (const p of await res.json()) {
      if (!/^https:\/\//.test(p.api || '')) continue;
      if (!backends.find((x) => x.api === norm(p.api))) backends.push({ api: norm(p.api), name: p.name, preset: true });
    }
    if (!activeApi && backends[0]) activeApi = backends[0].api;
    saveBackends();
  } catch { /* optional */ }
}

const health = new Map();
async function checkHealth(b) {
  try {
    const res = await fetch(`${b.api}/health`, { signal: AbortSignal.timeout(5000) });
    const d = await res.json();
    health.set(b.api, { ok: !!d.ok && d.name === 'aio', name: d.backend || d.bot });
    if (d.backend) b.name = d.backend;
  } catch { health.set(b.api, { ok: false }); }
  renderBackends();
}
function renderBackends() {
  const list = $('backendList');
  list.replaceChildren(...backends.map((b) => {
    const hh = health.get(b.api);
    let host = b.api;
    try { host = new URL(b.api).host; } catch { /* keep */ }
    return h('li', { class: b.api === activeApi ? 'active' : '' },
      h('span.dot', { class: hh ? (hh.ok ? 'on' : 'off') : '' }),
      h('button.bk', { type: 'button', title: b.api, onclick: () => { activeApi = b.api; saveBackends(); boot(); } },
        h('b', b.name || hh?.name || host), h('span', b.token ? host : `${host} · kein Link, nutze /aio`)),
      h('button.icon-btn', { title: 'Entfernen', onclick: () => { backends = backends.filter((x) => x !== b); if (activeApi === b.api) activeApi = backends[0]?.api || null; saveBackends(); renderBackends(); } }, icon('x')));
  }));
  if (!backends.length) list.append(h('li.muted', 'Noch kein Backend.'));
}
$('backendAdd').onclick = () => {
  const v = norm($('backendInput').value);
  if (!/^https?:\/\/\S+$/.test(v)) return toast('Ungültige Adresse (https://…)', true);
  upsertBackend(v);
  activeApi = v;
  saveBackends();
  $('backendInput').value = '';
  backends.forEach(checkHealth);
  boot();
};
$('backendBtn').onclick = () => showGate('switch');

let session = null;
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(session.api + path, {
    method,
    headers: { Authorization: `Bearer ${session.token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    const kind = { expired: 'expired', revoked: 'revoked', missing: 'none' }[data.reason] || 'invalid';
    showGate(kind);
    if (data.error && kind !== 'none') $('gateText').textContent = data.error;
    const err = new Error(data.error || 'Link ungültig');
    err.gate = true;
    throw err;
  }
  if (!res.ok) { const err = new Error(data.error || `Fehler ${res.status}`); err.status = res.status; throw err; }
  return data;
}
const tryApi = async (...a) => { try { return await api(...a); } catch (e) { toast(e.message, true); throw e; } };

/* ---------- app state ---------- */
const S = { me: null, guild: null, bot: null, cfg: null, saved: {}, info: { channels: [], roles: [], emojis: [] }, page: 'overview', missing: [] };

function showGate(kind) {
  document.body.classList.add('gate-mode');
  renderGateNav();
  $('shell').hidden = true;
  $('gate').hidden = false;
  $('server').hidden = true;
  $('userAvatar').hidden = true;
  const texts = {
    none: ['Kein Panel-Link', 'Schreib /aio auf deinem Discord-Server. Der Link öffnet das Panel und verbindet das Backend automatisch.'],
    expired: ['Link abgelaufen', 'Hol dir mit /aio auf deinem Server einen neuen Link.'],
    revoked: ['Link zurückgezogen', 'Hol dir mit /aio auf deinem Server einen neuen Link.'],
    invalid: ['Link passt nicht', 'Der Link gehört zu einem anderen Backend oder der Bot wurde neu eingerichtet. Hol dir mit /aio einen neuen Link.'],
    starting: ['Bot startet', 'Der Bot verbindet sich gerade mit Discord. Das Panel lädt gleich von selbst.'],
    error: ['Panel konnte nicht laden', ''],
    offline: ['Backend nicht erreichbar', 'Läuft der Bot? Nach einem Neustart ändert sich bei einem Cloudflare-Tunnel die Adresse, dann einfach /aio nochmal eingeben.'],
    switch: ['Backend wählen', 'Klick auf ein Backend, um es zu benutzen, oder füge eins hinzu.'],
  }[kind] || ['', ''];
  $('gateTitle').textContent = texts[0];
  $('gateText').textContent = texts[1];
  renderBackends();
  backends.forEach(checkHealth);
}
$('gateGuide').onclick = (e) => { e.preventDefault(); openGuideStandalone(); };

let bootTry = 0;
async function boot() {
  const b = backends.find((x) => x.api === activeApi);
  session = b?.token ? { api: b.api, token: b.token } : null;
  if (!session) {
    if (location.hash === '#anleitung') return openGuideStandalone();
    return showGate(b ? 'none' : 'none');
  }
  try {
    const s = await api('/api/session');
    const [cfg, info] = await Promise.all([api('/api/config'), api('/api/guild')]);
    S.me = s.user; S.guild = s.guild; S.bot = s.bot; S.missing = s.missingIntents || [];
    S.cfg = cfg; S.info = info;
    S.saved = Object.fromEntries(Object.entries(cfg).map(([k, v]) => [k, JSON.stringify(v)]));
  } catch (e) {
    if (e.gate) return;
    if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(e.message) && !e.status) return showGate('offline');
    if (e.status === 503 && bootTry++ < 40) { showGate('starting'); setTimeout(boot, 3000); return; }
    showGate('error');
    $('gateText').textContent = e.message;
    return;
  }
  bootTry = 0;
  document.body.classList.remove('gate-mode');
  $('gate').hidden = true;
  $('shell').hidden = false;
  $('server').hidden = false;
  $('serverIcon').src = S.guild.icon || 'icon.svg';
  $('serverName').textContent = S.guild.name;
  $('userAvatar').src = S.me.avatar || 'icon.svg';
  $('userAvatar').hidden = false;
  $('userAvatar').title = S.me.name;
  setBotHeader();
  renderNav();
  go(location.hash === '#anleitung' ? 'anleitung' : store.get('page', 'overview'));
}
function setBotHeader() {
  const name = S.bot.nickname || S.bot.name;
  $('botName').textContent = name;
  $('botAvatar').src = S.bot.avatar || 'icon.svg';
  document.title = `${name} · ${S.guild?.name || 'Panel'}`;
}

/* ---------- dirty state + save bar ---------- */
let current = null; // current page definition
const dirtyMods = () => (current?.mods || []).filter((m) => JSON.stringify(S.cfg[m]) !== S.saved[m]);
function changed() { $('savebar').classList.toggle('show', dirtyMods().length > 0); }
async function saveNow() {
  const mods = dirtyMods();
  if (!mods.length) return true;
  $('save').disabled = true;
  try {
    for (const m of mods) {
      const out = await api(`/api/config/${m}`, { method: 'PUT', body: S.cfg[m] });
      S.cfg[m] = out;
      S.saved[m] = JSON.stringify(out);
    }
    toast('Gespeichert');
    if (mods.includes('general')) { S.bot.nickname = S.cfg.general.nickname; setBotHeader(); }
    renderNav();
    rerender();
    return true;
  } catch (e) {
    toast(e.message, true);
    return false;
  } finally {
    $('save').disabled = false;
    changed();
  }
}
$('save').onclick = saveNow;
$('discard').onclick = () => { for (const m of current?.mods || []) S.cfg[m] = JSON.parse(S.saved[m]); changed(); rerender(); };
window.addEventListener('beforeunload', (e) => { if (dirtyMods().length) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && dirtyMods().length) { e.preventDefault(); saveNow(); } });

/* ---------- form controls (bound to obj[key]) ---------- */
function field(label, control, hint) {
  return h('div.field', label ? h('label', label) : null, control, hint ? h('p.hint', hint) : null);
}
function toggle(obj, key, label, hint, onchange) {
  const input = h('input', { type: 'checkbox', checked: !!obj[key], onchange: (e) => { obj[key] = e.target.checked; changed(); onchange?.(e.target.checked); } });
  return h('label.switch', input, h('span.track'), h('span.txt', h('span', label), hint ? h('span.hint', hint) : null));
}
function text(obj, key, { ph = '', type = 'text', max } = {}) {
  return h('input', { type, value: obj[key] ?? '', placeholder: ph, maxLength: max, oninput: (e) => { obj[key] = e.target.value; changed(); } });
}
function area(obj, key, { ph = '', rows = 3, max, vars } = {}) {
  const ta = h('textarea', { rows, placeholder: ph, maxLength: max, oninput: (e) => { obj[key] = e.target.value; changed(); } });
  ta.value = obj[key] ?? '';
  return vars ? h('div', ta, varButtons(ta, vars, () => { obj[key] = ta.value; changed(); })) : ta;
}
function varButtons(input, vars, after) {
  return h('div.vars', vars.map((v) => h('button', {
    type: 'button', title: 'Einfügen', onclick: () => {
      const s = input.selectionStart ?? input.value.length;
      input.value = input.value.slice(0, s) + `{${v}}` + input.value.slice(input.selectionEnd ?? s);
      input.focus();
      input.selectionStart = input.selectionEnd = s + v.length + 2;
      after();
      input.dispatchEvent(new Event('input'));
    },
  }, `{${v}}`)));
}
function num(obj, key, { min, max, step = 1, suffix } = {}) {
  const i = h('input', { type: 'number', value: obj[key] ?? 0, min, max, step, oninput: (e) => { const v = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(v)) { obj[key] = v; changed(); } } });
  return suffix ? h('div.with-suffix', i, h('span', suffix)) : i;
}
function color(obj, key, { allowEmpty = true } = {}) {
  const valid = (v) => /^#[0-9a-f]{6}$/i.test(v);
  const t = h('input', { type: 'text', value: obj[key] || '', placeholder: allowEmpty ? 'Standard' : '#7c5cff', maxLength: 7 });
  const c = h('input', { type: 'color', value: valid(obj[key]) ? obj[key] : '#7c5cff' });
  c.oninput = () => { obj[key] = c.value; t.value = c.value; changed(); };
  t.oninput = () => { const v = t.value.trim(); if (!v && allowEmpty) obj[key] = ''; else if (valid(v)) { obj[key] = v; c.value = v; } else return; changed(); };
  return h('div.color-row', c, t);
}
function sel(obj, key, options, onchange) {
  const s = h('select', { onchange: (e) => { obj[key] = typeof obj[key] === 'number' ? Number(e.target.value) : e.target.value; changed(); onchange?.(obj[key]); } },
    options.map(([v, l]) => h('option', { value: v, selected: String(obj[key]) === String(v) }, l)));
  return s;
}
const KIND = { text: ['text', 'announcement'], voice: ['voice', 'stage'], category: ['category'], any: ['text', 'announcement', 'voice', 'stage', 'forum'] };
function channelOptions(kinds = 'text') {
  const want = KIND[kinds] || kinds;
  const cats = new Map(S.info.channels.filter((c) => c.type === 'category').map((c) => [c.id, c.name]));
  const groups = new Map();
  for (const c of S.info.channels.filter((x) => want.includes(x.type))) {
    const g = c.type === 'category' ? '' : (cats.get(c.parent) || '');
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }
  const pre = (c) => ({ voice: '🔊 ', stage: '🎙 ', category: '📁 ', announcement: '📢 ', forum: '💬 ' }[c.type] || '# ');
  return [...groups].map(([g, list]) => {
    const opts = list.map((c) => h('option', { value: c.id }, `${pre(c)}${c.name}${c.canPost === false && ['text', 'announcement'].includes(c.type) ? ' (kein Zugriff)' : ''}`));
    return g ? h('optgroup', { label: g }, opts) : opts;
  });
}
function chan(obj, key, { kinds = 'text', empty = 'Kein Kanal', onchange } = {}) {
  const s = h('select', { onchange: (e) => { obj[key] = e.target.value; changed(); onchange?.(e.target.value); } }, h('option', { value: '' }, empty), channelOptions(kinds));
  s.value = obj[key] || '';
  if (obj[key] && s.value !== obj[key]) { s.append(h('option', { value: obj[key] }, '(gelöschter Kanal)')); s.value = obj[key]; }
  return s;
}
const roleById = (id) => S.info.roles.find((r) => r.id === id);
const chanById = (id) => S.info.channels.find((c) => c.id === id);
function roleOptions(extra = []) {
  return [...extra.map(([v, l]) => h('option', { value: v }, l)), ...S.info.roles.map((r) => h('option', { value: r.id, disabled: r.managed }, `@${r.name}${!r.assignable ? ' (über dem Bot)' : ''}`))];
}
function role(obj, key, { empty = 'Keine Rolle', extra = [] } = {}) {
  const s = h('select', { onchange: (e) => { obj[key] = e.target.value; changed(); } }, h('option', { value: '' }, empty), roleOptions(extra));
  s.value = obj[key] || '';
  return s;
}
function multi(obj, key, { kind = 'roles', kinds = 'text', ph } = {}) {
  const wrap = h('div.chips');
  const draw = () => {
    const list = obj[key] || (obj[key] = []);
    wrap.replaceChildren(...list.map((id) => {
      const r = kind === 'roles' ? roleById(id) : chanById(id);
      const label = r ? (kind === 'roles' ? `@${r.name}` : `${r.type === 'category' ? '📁 ' : '#'}${r.name}`) : '(gelöscht)';
      return h('span.chip', kind === 'roles' ? h('i', { style: `background:${r?.color || 'var(--muted)'}` }) : null, label,
        h('button', { type: 'button', title: 'Entfernen', onclick: () => { obj[key] = list.filter((x) => x !== id); changed(); draw(); } }, '×'));
    }), h('select', {
      onchange: (e) => { if (e.target.value && !list.includes(e.target.value)) { list.push(e.target.value); changed(); } draw(); },
    }, h('option', { value: '' }, ph || '+ hinzufügen'), kind === 'roles' ? roleOptions() : channelOptions(kinds)));
  };
  draw();
  return wrap;
}
const roles = (obj, key, o = {}) => multi(obj, key, { kind: 'roles', ...o });
const chans = (obj, key, o = {}) => multi(obj, key, { kind: 'channels', ...o });

const COMMON_EMOJI = '😀 😂 😍 😎 🤔 😴 😡 👍 👎 👋 🙏 🎉 🎁 🎂 🎮 🎵 🎧 🎨 📢 📌 📝 📦 🔔 🔒 🔓 ✅ ❌ ⚠️ ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 ⭐ 🔥 💎 🏆 🥇 🚀 🌍 🌙 ☀️ ⚡ 🍀 🐱 🐶 🦊 🐉 ⚔️ 🛡️ 🏹 ⛏️ 🧱 🟢 🔴 🟡 🔵 🟣 🟠 ⚪ ⚫'.split(' ');
function emoji(obj, key, { ph = '🎉' } = {}) {
  const input = h('input', { type: 'text', value: obj[key] || '', placeholder: ph, oninput: (e) => { obj[key] = e.target.value.trim(); changed(); } });
  const btn = h('button.icon-btn', { type: 'button', title: 'Emoji wählen' }, icon('smile'));
  btn.onclick = (ev) => {
    ev.stopPropagation();
    document.querySelector('.pop')?.remove();
    const pick = (v) => { obj[key] = v; input.value = v; changed(); pop.remove(); input.dispatchEvent(new Event('input')); };
    const pop = h('div.pop', ...S.info.emojis.map((e) => h('button', { type: 'button', title: e.name, onclick: () => pick(e.text) }, h('img', { src: e.url, alt: e.name }))),
      ...COMMON_EMOJI.map((e) => h('button', { type: 'button', onclick: () => pick(e) }, e)));
    const r = btn.getBoundingClientRect();
    pop.style.top = `${r.bottom + window.scrollY + 4}px`;
    pop.style.left = `${Math.max(8, Math.min(r.left + window.scrollX - 240, window.innerWidth - 296))}px`;
    document.body.append(pop);
    setTimeout(() => document.addEventListener('click', function close(e2) { if (!pop.contains(e2.target)) { pop.remove(); document.removeEventListener('click', close); } }), 0);
  };
  return h('div.row', { style: 'flex-wrap:nowrap' }, input, btn);
}
function strList(obj, key, { ph = '' } = {}) {
  const ta = h('textarea', { rows: 4, placeholder: ph, oninput: (e) => { obj[key] = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean); changed(); } });
  ta.value = (obj[key] || []).join('\n');
  return ta;
}

/** Editor for an array of objects. */
function listEditor(obj, key, { title, sum, add, render, addLabel = 'Hinzufügen', max = 100, empty = 'Noch nichts angelegt.', openNew = true }) {
  const wrap = h('div');
  const openSet = new Set();
  const draw = () => {
    const list = obj[key] || (obj[key] = []);
    wrap.replaceChildren();
    if (!list.length) wrap.append(h('div.empty', empty));
    list.forEach((it, n) => {
      const body = h('div.body');
      const item = h('div.list-item', { class: openSet.has(it) ? 'open' : '' });
      const move = (d) => { const j = n + d; if (j < 0 || j >= list.length) return; [list[n], list[j]] = [list[j], list[n]]; changed(); draw(); };
      const head = h('header', { onclick: (e) => { if (e.target.closest('button')) return; item.classList.toggle('open'); if (item.classList.contains('open')) openSet.add(it); else openSet.delete(it); } },
        h('span.caret', icon('caret')), h('b', title(it, n) || '(ohne Name)'), h('span.sum', sum ? sum(it) : ''), h('span.spacer'),
        h('button.icon-btn', { type: 'button', title: 'Nach oben', onclick: () => move(-1) }, icon('up')),
        h('button.icon-btn', { type: 'button', title: 'Nach unten', onclick: () => move(1) }, icon('down')),
        h('button.icon-btn', { type: 'button', title: 'Löschen', onclick: () => { list.splice(n, 1); changed(); draw(); } }, icon('trash')));
      item.append(head, body);
      render(it, body, () => { head.querySelector('b').textContent = title(it, n) || '(ohne Name)'; if (sum) head.querySelector('.sum').textContent = sum(it); });
      wrap.append(item);
    });
    if (list.length < max) {
      wrap.append(h('button.btn', { type: 'button', onclick: () => { const it = add(); list.push(it); if (openNew) openSet.add(it); changed(); draw(); } }, icon('plus'), addLabel));
    }
  };
  draw();
  return wrap;
}
/** Re-calls `update` whenever an input inside `el` changes (for list titles). */
const live = (el, update) => { el.addEventListener('input', update); el.addEventListener('change', update); return el; };

/* ---------- Discord-like preview ---------- */
function sampleVars(extra = {}) {
  return {
    user: `@${S.me?.name || 'Max'}`, 'user.mention': `@${S.me?.name || 'Max'}`, 'user.name': S.me?.name || 'Max', 'user.username': (S.me?.name || 'max').toLowerCase(),
    'user.tag': S.me?.name || 'max', 'user.id': S.me?.id || '123', 'user.avatar': S.me?.avatar || '', 'user.created': 'vor 3 Jahren', 'user.joined': 'gerade eben',
    server: S.guild?.name || 'Server', 'server.name': S.guild?.name || 'Server', 'server.id': S.guild?.id || '', 'server.icon': S.guild?.icon || '',
    members: S.guild?.members || 100, 'server.members': S.guild?.members || 100, boosts: 3, date: new Date().toLocaleDateString('de-DE'), time: new Date().toTimeString().slice(0, 5),
    level: 5, xp: 1234, rank: 3, channel: '#allgemein', args: 'Text', reason: 'Spam', action: 'Timeout', duration: '10 Min.', ticket: 42, age: ' (21)',
    title: 'Neues Video!', link: 'https://example.com', author: 'Kanal', name: 'Kanal', platform: 'YouTube', game: 'Minecraft',
    'server.emoji': '🟢', 'server.players': 5, 'server.max': 20, 'server.version': '1.21.4', 'server.address': 'play.example.com', 'server.motd': 'Willkommen', 'server.ping': 32, 'server.list': 'Steve, Alex',
    online: 1, total: 2, interval: 60, humans: 90, bots: 10, roles: 12, channels: 30, emojis: 5, tier: 1,
    ...extra,
  };
}
const fillVars = (s, vars) => String(s || '').replace(/\{([\w.]+)\}/g, (m, k) => (vars[k] ?? vars[k.toLowerCase()] ?? m));
function md(s) {
  let t = esc(s);
  t = t.replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => `<span class="mention">@${esc(roleById(id)?.name || 'Rolle')}</span>`)
    .replace(/&lt;@!?(\d+)&gt;/g, () => `<span class="mention">@Mitglied</span>`)
    .replace(/&lt;#(\d+)&gt;/g, (_, id) => `<span class="mention">#${esc(chanById(id)?.name || 'kanal')}</span>`)
    .replace(/&lt;t:(\d+)(?::\w)?&gt;/g, (_, n) => new Date(Number(n) * 1000).toLocaleString('de-DE'))
    .replace(/&lt;a?:(\w+):(\d+)&gt;/g, (_, n, id) => `<img src="https://cdn.discordapp.com/emojis/${id}.webp?size=44" alt=":${n}:" style="width:20px;height:20px;vertical-align:-4px">`)
    .replace(/(^|\s)(@everyone|@here)/g, '$1<span class="mention">$2</span>')
    .replace(/(^|\s)(@[\wäöüÄÖÜß .-]{1,32}?)(?=\s|$|[,!.?])/g, (m, a, b) => (b.length > 1 ? `${a}<span class="mention">${b}</span>` : m))
    .replace(/```([\s\S]*?)```/g, '<code style="display:block;white-space:pre-wrap;padding:6px">$1</code>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<u>$1</u>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^### (.*)$/gm, '<b style="font-size:16px">$1</b>').replace(/^## (.*)$/gm, '<b style="font-size:18px">$1</b>').replace(/^# (.*)$/gm, '<b style="font-size:21px">$1</b>')
    .replace(/^&gt; (.*)$/gm, '<span style="border-left:3px solid #4e5058;padding-left:8px;display:inline-block">$1</span>');
  return t;
}
const isUrl = (u) => /^https?:\/\/\S+$/i.test(u || '');
function resolveEmbed(e) {
  const profiles = S.cfg?.embeds?.profiles || [];
  const p = profiles.find((x) => x.id === (e.profile || S.cfg?.general?.profile)) || profiles.find((x) => x.id === S.cfg?.general?.profile) || {};
  return {
    color: e.color || p.color || '', author: { name: e.author?.name || p.author?.name || '', icon: e.author?.icon || p.author?.icon || '', url: e.author?.url || p.author?.url || '' },
    title: e.title, url: e.url, description: e.description, fields: e.fields || [], thumbnail: e.thumbnail || p.thumbnail || '', image: e.image || p.image || '',
    footer: { text: e.footer?.text || p.footer?.text || '', icon: e.footer?.icon || p.footer?.icon || '' }, timestamp: e.timestamp || p.timestamp,
  };
}
function embedEl(raw, vars) {
  const e = resolveEmbed(raw);
  const f = (s) => fillVars(s, vars);
  const main = h('div.e-main');
  if (e.author.name) main.append(h('div.e-author', isUrl(f(e.author.icon)) ? h('img', { src: f(e.author.icon), alt: '' }) : null, f(e.author.name)));
  if (e.title) main.append(h('div.e-title', { html: isUrl(f(e.url)) ? `<a href="${esc(f(e.url))}" target="_blank" rel="noopener">${md(f(e.title))}</a>` : md(f(e.title)) }));
  if (e.description) main.append(h('div.e-desc', { html: md(f(e.description)) }));
  const fields = e.fields.filter((x) => x.name || x.value);
  if (fields.length) main.append(h('div.e-fields', fields.map((x) => h('div.e-field', { class: x.inline ? 'inline' : '' }, h('b', { html: md(f(x.name)) }), h('div', { html: md(f(x.value)) })))));
  const el = h('div.embed', { style: e.color ? `border-left-color:${e.color}` : '' }, main);
  el.append(isUrl(f(e.thumbnail)) ? h('img.e-thumb', { src: f(e.thumbnail), alt: '' }) : h('span'));
  if (isUrl(f(e.image))) el.append(h('img.e-image', { src: f(e.image), alt: '' }));
  if (e.footer.text || e.timestamp) {
    el.append(h('div.e-footer', isUrl(f(e.footer.icon)) ? h('img', { src: f(e.footer.icon), alt: '' }) : null,
      [f(e.footer.text), e.timestamp ? `Heute um ${new Date().toTimeString().slice(0, 5)}` : ''].filter(Boolean).join(' • ')));
  }
  return el;
}
function preview(msg, { vars = sampleVars(), buttons = [] } = {}) {
  const box = h('div.msg', h('div.who', S.bot?.nickname || S.bot?.name || 'AIO', h('span.tag', 'APP'), h('time', `Heute um ${new Date().toTimeString().slice(0, 5)}`)));
  if (msg?.content) box.append(h('div.txt', { html: md(fillVars(msg.content, vars)) }));
  if (msg?.embed?.enabled) box.append(embedEl(msg.embed, vars));
  if (!msg?.content && !msg?.embed?.enabled) box.append(h('div.txt.muted', '(leere Nachricht)'));
  if (buttons.length) box.append(h('div.buttons', buttons.map((b) => h('span', { class: b.style || '' }, b.label))));
  return h('div.dc', h('img.av', { src: S.bot?.avatar || 'icon.svg', alt: '' }), box);
}

const EMPTY_EMBED = () => ({ enabled: false, profile: '', color: '', author: { name: '', icon: '', url: '' }, title: '', url: '', description: '', fields: [], thumbnail: '', image: '', footer: { text: '', icon: '' }, timestamp: false });
const BASE_VARS = ['user', 'user.name', 'user.avatar', 'server', 'members'];

/** Text + embed editor with live preview. obj[key] = { content, embed } */
function messageEditor(obj, key, { vars = BASE_VARS, buttons = null, compact = false, sample = {} } = {}) {
  const m = obj[key] || (obj[key] = { content: '', embed: EMPTY_EMBED() });
  if (!m.embed) m.embed = EMPTY_EMBED();
  const pv = h('div');
  const refresh = () => pv.replaceChildren(preview(m, { vars: sampleVars(sample), buttons: typeof buttons === 'function' ? buttons() : buttons || [] }));
  const e = m.embed;
  const embedBox = h('div', { hidden: !e.enabled });
  const profiles = (S.cfg.embeds.profiles || []).map((p) => [p.id, p.name || p.id]);
  embedBox.append(
    h('div.grid', { style: 'margin-top:12px' },
      field('Stil-Profil', sel(e, 'profile', [['', 'Server-Standard'], ...profiles])),
      field('Farbe', color(e, 'color'))),
    h('div.grid', field('Autor', text(e.author, 'name', { ph: 'Name (optional)' })), field('Autor-Bild (URL)', text(e.author, 'icon', { ph: 'https://… oder {user.avatar}' }))),
    h('div.grid', field('Titel', text(e, 'title', { max: 256 })), field('Titel-Link', text(e, 'url', { ph: 'https://…' }))),
    field('Beschreibung', area(e, 'description', { rows: 4, max: 4096, vars })),
    field('Felder', listEditor(e, 'fields', {
      title: (f) => f.name, sum: (f) => (f.inline ? 'nebeneinander' : ''), add: () => ({ name: 'Feld', value: 'Text', inline: false }), addLabel: 'Feld', max: 25, empty: 'Keine Felder.',
      render: (f, body, upd) => body.append(live(h('div',
        h('div.grid', { style: 'margin-top:10px' }, field('Name', text(f, 'name', { max: 256 })), field('', toggle(f, 'inline', 'Nebeneinander'))),
        field('Wert', area(f, 'value', { rows: 2, max: 1024 }))), upd)),
    })),
    h('div.grid', field('Vorschaubild rechts (URL)', text(e, 'thumbnail', { ph: 'https://… oder {user.avatar}' })), field('Großes Bild (URL)', text(e, 'image', { ph: 'https://…' }))),
    h('div.grid', field('Fußzeile', text(e.footer, 'text', { max: 2048 })), field('Fußzeilen-Bild (URL)', text(e.footer, 'icon', { ph: 'https://…' }))),
    h('div', { style: 'margin-top:12px' }, toggle(e, 'timestamp', 'Zeitstempel anzeigen')),
  );
  const form = h('div',
    field('Text', area(m, 'content', { rows: compact ? 2 : 3, max: 2000, vars })),
    h('div', { style: 'margin-top:12px' }, toggle(e, 'enabled', 'Embed verwenden', null, (v) => { embedBox.hidden = !v; refresh(); })),
    embedBox);
  live(form, refresh);
  form.addEventListener('click', () => setTimeout(refresh, 0));
  refresh();
  return h('div.composer', form, h('div.preview-wrap', h('div.field', h('label', 'Vorschau'), pv)));
}

/* ---------- navigation ---------- */
const PAGES = [];
const page = (def) => PAGES.push(def);
function renderNav() {
  const nav = $('nav');
  nav.replaceChildren();
  let group = null;
  for (const p of PAGES) {
    if (p.owner && !S.me?.owner) continue;
    if (p.rights && !S.me?.rights) continue;
    if (p.prank && !S.me?.prank) continue;
    if (p.group !== group) { group = p.group; if (group) nav.append(h('h4', group)); }
    const mod = p.mods?.[0];
    const on = mod && S.cfg?.[mod] && typeof S.cfg[mod].enabled === 'boolean' ? S.cfg[mod].enabled : null;
    nav.append(h('button', { class: S.page === p.id ? 'on' : '', onclick: () => go(p.id) }, icon(p.icon), h('span', p.title), on !== null ? h('span.state', { class: on ? 'on' : '', title: on ? 'An' : 'Aus' }) : null));
  }
}
async function go(id) {
  let p = PAGES.find((x) => x.id === id) || PAGES[0];
  if ((p.rights && !S.me?.rights) || (p.owner && !S.me?.owner) || (p.prank && !S.me?.prank)) p = PAGES[0];
  if (current && current.id !== p.id && dirtyMods().length) {
    if (!confirm('Ungespeicherte Änderungen verwerfen?')) return;
    for (const m of current.mods || []) S.cfg[m] = JSON.parse(S.saved[m]);
  }
  current = p;
  S.page = p.id;
  store.set('page', p.id);
  document.body.classList.remove('nav-open');
  renderNav();
  changed();
  rerender();
  window.scrollTo(0, 0);
}
function rerender() {
  const p = current;
  const root = $('page');
  root.replaceChildren();
  if (S.missing.length && ['overview', 'welcome', 'automod', 'logs', 'customcmds', 'levels'].includes(p.id)) {
    root.append(h('div.notice', 'Dem Bot fehlen Rechte von Discord: ', h('b', S.missing.join(' und ')), '. Schalte sie im ', h('a', { href: 'https://discord.com/developers/applications', target: '_blank' }, 'Developer Portal'), ' unter Bot → Privileged Gateway Intents ein und starte den Bot neu. Bis dahin gehen Willkommen, Logs, Auto-Mod und Textbefehle nur teilweise.'));
  }
  const head = h('div.page-head', h('div', h('h1', p.title), p.desc ? h('p', p.desc) : null));
  const end = h('div.end');
  const mod = p.mods?.[0];
  if (mod && typeof S.cfg[mod]?.enabled === 'boolean' && p.toggle !== false) end.append(toggle(S.cfg[mod], 'enabled', 'Aktiv', null, () => renderNav()));
  head.append(end);
  root.append(head);
  Promise.resolve(p.render(root, end)).catch((e) => root.append(h('div.notice', e.message)));
}
$('menuBtn').onclick = () => { closeSettings(); document.body.classList.toggle('nav-open'); };
document.addEventListener('click', (e) => { if (document.body.classList.contains('nav-open') && !e.target.closest('nav.side') && !e.target.closest('#menuBtn')) document.body.classList.remove('nav-open'); });
/** Menu while there is no session (no panel link yet): backends, guide, all bots. */
function renderGateNav() {
  const close = () => document.body.classList.remove('nav-open');
  $('gateNav').replaceChildren(
    h('button', { onclick: () => { close(); $('backendInput').focus(); $('gate').scrollIntoView({ behavior: 'smooth' }); } }, icon('server'), h('span', 'Backends')),
    h('button', { onclick: () => { close(); openGuideStandalone(); } }, icon('help'), h('span', 'Anleitung & Installation')),
    h('button', { onclick: () => { location.href = '../'; } }, icon('home'), h('span', 'Alle Bots')),
  );
}

/* ---------- gear: accent colour ---------- */
const ACCENTS = ['violet', 'blue', 'green', 'pink'];
function applyAccent(a) {
  if (!ACCENTS.includes(a)) a = 'violet';
  if (a === 'violet') delete document.body.dataset.accent; else document.body.dataset.accent = a;
  document.querySelectorAll('.sw').forEach((b) => b.classList.toggle('active', b.dataset.accent === a));
}
function closeSettings() { $('settingsPop').hidden = true; $('gearBtn').setAttribute('aria-expanded', 'false'); }
$('gearBtn').onclick = (e) => {
  e.stopPropagation();
  const open = $('settingsPop').hidden;
  document.body.classList.remove('nav-open');
  $('settingsPop').hidden = !open;
  $('gearBtn').setAttribute('aria-expanded', String(open));
};
document.querySelectorAll('.sw').forEach((b) => b.addEventListener('click', () => { store.set('accent', b.dataset.accent); applyAccent(b.dataset.accent); }));
document.addEventListener('click', (e) => { if (!$('settingsPop').hidden && !e.target.closest('#settingsPop')) closeSettings(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeSettings(); document.body.classList.remove('nav-open'); } });
applyAccent(store.get('accent', 'violet'));

const card = (title, hint, ...kids) => h('div.card', title ? h('h3', title) : null, hint ? h('p.hint', hint) : null, ...kids);
const ACTIONS = [['delete', 'Nur löschen'], ['warn', 'Löschen + verwarnen'], ['timeout', 'Löschen + Timeout'], ['kick', 'Löschen + kicken'], ['ban', 'Löschen + bannen']];

/* =================== pages =================== */

page({
  id: 'overview', title: 'Übersicht', icon: 'home', group: null,
  async render(root) {
    const o = await tryApi('/api/overview');
    root.append(h('div.stats',
      h('div.stat', h('b', o.members), h('span', 'Mitglieder')),
      h('div.stat', h('b', o.cases), h('span', `Mod-Fälle · ${o.warns} aktive Verwarnungen`)),
      h('div.stat', h('b', o.xpUsers), h('span', 'Mitglieder mit XP')),
      h('div.stat', h('b', o.tickets), h('span', 'offene Tickets')),
      h('div.stat', h('b', o.giveaways), h('span', 'laufende Gewinnspiele'))));
    if (o.mc.length) {
      root.append(card('Minecraft', null, h('div.chips', o.mc.map((s) => h('span.chip', { style: 'padding-right:9px;cursor:pointer', onclick: () => go('minecraft') },
        h('i', { style: `background:${s.online === null ? 'var(--muted)' : s.online ? 'var(--ok)' : 'var(--bad)'}` }), `${s.emoji ? `${s.emoji} ` : ''}${s.name}`, s.online ? ` · ${s.players}/${s.max}` : '')))));
    }
    root.append(card('Module', 'Klick auf ein Modul, um es einzurichten. Grün = aktiv.', h('div.modgrid', PAGES.filter((p) => p.mods && p.id !== 'bot' && p.id !== 'embeds').map((p) => {
      const en = o.enabled[p.mods[0]];
      return h('button.mod', { onclick: () => go(p.id) }, h('span.ico', icon(p.icon)), h('span', h('b', p.title), h('small', p.short || '')),
        en === null || en === undefined ? null : h('span.badge', { class: en ? 'on' : '', style: 'margin-left:auto' }, en ? 'an' : 'aus'));
    }))));
    root.append(card('Letzte Änderungen im Panel', null, o.activity.length
      ? h('div', o.activity.map((a) => h('div.who-cell', { style: 'padding:6px 0' }, h('img', { src: a.avatar || 'icon.svg', alt: '' }), h('span', h('b', a.name), ` ${a.action}`), h('span.spacer'), h('span.muted.small', ago(a.t)))))
      : h('p.muted', 'Noch nichts geändert.')));
  },
});

page({
  id: 'bot', title: 'Bot & Allgemein', icon: 'bot', group: 'Allgemein', mods: ['general'], toggle: false,
  desc: 'Name des Bots, Standard-Stil für alle Nachrichten und wer das Panel öffnen darf.',
  async render(root) {
    const g = S.cfg.general;
    root.append(card('Auf diesem Server', null,
      h('div.grid',
        field('Name des Bots auf diesem Server', text(g, 'nickname', { ph: S.bot.name, max: 32 }), 'Leer = normaler Name. Ändert den Server-Nicknamen des Bots.'),
        field('Standard-Stil für Embeds', sel(g, 'profile', [['', 'Keiner'], ...S.cfg.embeds.profiles.map((p) => [p.id, p.name])]), 'Profile legst du im Embed-Editor an.')),
      h('div.grid',
        field('Panel zusätzlich für diese Rollen', roles(g, 'managerRoles'), 'Mitglieder mit „Server verwalten“ dürfen immer.'),
        field('/aio nur in diesem Kanal', chan(g, 'panelChannelId', { empty: 'Überall' })))));
    if (!S.me.owner) return;
    const b = await tryApi('/api/bot');
    const prof = { name: b.name, avatar: '' };
    const avatarImg = h('img', { src: b.avatar, alt: '', style: 'width:72px;height:72px;border-radius:50%;background:var(--panel-2)' });
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', hidden: true, onchange: () => {
      const f = file.files[0];
      if (!f) return;
      if (f.size > 8e6) return toast('Bild zu groß (max. 8 MB)', true);
      const r = new FileReader();
      r.onload = () => { prof.avatar = r.result; avatarImg.src = r.result; };
      r.readAsDataURL(f);
    } });
    root.append(card('Bot-Profil (überall)', 'Nur du siehst das. Discord erlaubt höchstens 2 Namensänderungen pro Stunde.',
      h('div.row', { style: 'gap:16px;align-items:flex-start' }, h('div', avatarImg, h('div', { style: 'margin-top:6px' }, h('button.btn.sm', { type: 'button', onclick: () => file.click() }, 'Bild wählen')), file),
        h('div', { style: 'flex:1;min-width:220px' },
          field('Name des Bots', text(prof, 'name', { max: 32 })),
          field('…oder Bild-Adresse', text(prof, 'avatar', { ph: 'https://…png' })),
          h('div.row.end', { style: 'margin-top:12px' }, h('button.btn.primary', { type: 'button', onclick: async (e) => {
            e.target.disabled = true;
            try {
              const r = await api('/api/bot/profile', { method: 'POST', body: { name: prof.name, avatar: prof.avatar || undefined } });
              S.bot.name = r.name; S.bot.avatar = r.avatar; setBotHeader(); toast('Profil gespeichert');
            } catch (er) { toast(er.message, true); } finally { e.target.disabled = false; }
          } }, 'Profil speichern'))))));
    const pres = clone(b.presence);
    root.append(card('Status', 'Mehrere Einträge wechseln sich ab. Platzhalter: {servers}, {members}.',
      h('div.grid', field('Online-Status', sel(pres, 'status', [['online', '🟢 Online'], ['idle', '🌙 Abwesend'], ['dnd', '⛔ Bitte nicht stören'], ['invisible', '⚫ Unsichtbar']])),
        field('Wechseln alle', num(pres, 'rotateSeconds', { min: 15, max: 3600, suffix: 'Sekunden' }))),
      field('Aktivitäten', listEditor(pres, 'activities', {
        title: (a) => a.text, sum: (a) => ({ custom: 'Status', playing: 'Spielt', listening: 'Hört', watching: 'Schaut', competing: 'Tritt an', streaming: 'Streamt' }[a.type] || ''),
        add: () => ({ type: 'custom', text: '/aio', url: '' }), addLabel: 'Aktivität', max: 20,
        render: (a, body, upd) => body.append(live(h('div.grid', { style: 'margin-top:10px' },
          field('Art', sel(a, 'type', [['custom', 'Eigener Status'], ['playing', 'Spielt …'], ['listening', 'Hört …'], ['watching', 'Schaut …'], ['competing', 'Tritt an in …']])),
          field('Text', text(a, 'text', { max: 128 }))), upd)),
      })),
      h('div.row.end', { style: 'margin-top:12px' }, h('button.btn.primary', { type: 'button', onclick: async () => { await tryApi('/api/bot/presence', { method: 'PUT', body: pres }); toast('Status gespeichert'); } }, 'Status speichern'))));
  },
});

page({
  id: 'embeds', title: 'Embed-Editor', icon: 'embed', group: 'Allgemein', mods: ['embeds'], toggle: false,
  desc: 'Nachrichten mit Embeds bauen und senden, bestehende Bot-Nachrichten bearbeiten und Stil-Profile (Farben, Autor, Fußzeile) speichern.',
  async render(root) {
    const draft = S.draft || (S.draft = { channel: '', messageId: '', name: '', message: { content: '', embed: { ...EMPTY_EMBED(), enabled: true, title: 'Titel', description: 'Beschreibung' } } });
    const tabs = h('div.tabs');
    const body = h('div');
    const tab = S.embedTab || 'compose';
    const show = (t) => { S.embedTab = t; rerender(); };
    for (const [k, l] of [['compose', 'Nachricht'], ['profiles', 'Stil-Profile'], ['templates', 'Vorlagen'], ['sent', 'Gesendet']]) tabs.append(h('button', { class: tab === k ? 'on' : '', onclick: () => show(k) }, l));
    root.append(tabs, body);

    if (tab === 'compose') {
      const load = { link: '' };
      body.append(card(draft.messageId ? 'Nachricht bearbeiten' : 'Neue Nachricht', null,
        h('div.grid', field('Kanal', chan(draft, 'channel')), field('Name (nur für dich)', text(draft, 'name', { ph: 'z. B. Regeln' }))),
        h('div', { style: 'margin-top:14px' }, messageEditor(draft, 'message', { vars: BASE_VARS })),
        h('div.row', { style: 'margin-top:14px' },
          draft.messageId ? h('span.badge', `bearbeitet Nachricht ${draft.messageId}`) : null,
          draft.messageId ? h('button.btn.sm.ghost', { type: 'button', onclick: () => { draft.messageId = ''; rerender(); } }, 'Als neue senden') : null,
          h('span.spacer'),
          h('button.btn', { type: 'button', onclick: async () => {
            const name = prompt('Name der Vorlage', draft.name || 'Vorlage');
            if (!name) return;
            S.cfg.embeds.templates.push({ id: uid(), name, message: clone(draft.message) });
            changed(); await saveNow();
          } }, 'Als Vorlage speichern'),
          h('button.btn.primary', { type: 'button', onclick: async (e) => {
            if (!draft.channel) return toast('Bitte einen Kanal wählen', true);
            e.target.disabled = true;
            try {
              const r = await api('/api/message', { method: 'POST', body: draft });
              draft.messageId = r.id;
              toast('Gesendet');
              rerender();
            } catch (er) { toast(er.message, true); } finally { e.target.disabled = false; }
          } }, icon('send'), draft.messageId ? 'Aktualisieren' : 'Senden'))));
      body.append(card('Bestehende Nachricht laden', 'Rechtsklick auf eine Nachricht in Discord → Nachrichtenlink kopieren. Nachrichten des Bots kannst du danach bearbeiten, andere als Kopie neu senden.',
        h('div.row', h('input', { type: 'url', placeholder: 'https://discord.com/channels/…', style: 'flex:1', oninput: (e) => { load.link = e.target.value; } }),
          h('button.btn', { type: 'button', onclick: async () => {
            const r = await tryApi('/api/message/load', { method: 'POST', body: load });
            S.draft = { channel: r.channel, messageId: r.own ? r.messageId : '', name: '', message: r.message };
            toast(r.own ? 'Geladen, du kannst sie jetzt bearbeiten' : 'Geladen (fremde Nachricht, wird als neue gesendet)');
            rerender();
          } }, 'Laden'))));
    }

    if (tab === 'profiles') {
      const e = S.cfg.embeds;
      body.append(card('Stil-Profile', 'Ein Profil legt Farbe, Autor, Fußzeile und Bilder fest. Jede Nachricht kann ein Profil nutzen, leere Felder der Nachricht kommen dann aus dem Profil. Das Server-Standardprofil stellst du unter „Bot & Allgemein“ ein.',
        listEditor(e, 'profiles', {
          title: (p) => p.name, sum: (p) => (p.id === S.cfg.general.profile ? 'Server-Standard' : ''), addLabel: 'Profil',
          add: () => ({ id: uid(), name: 'Neues Profil', color: '#7c5cff', author: { name: '', icon: '', url: '' }, footer: { text: '', icon: '' }, thumbnail: '', image: '', timestamp: false }),
          render: (p, b2, upd) => {
            const pv = h('div');
            const sample = () => pv.replaceChildren(preview({ content: '', embed: { ...EMPTY_EMBED(), enabled: true, profile: p.id, title: 'Beispiel', description: `So sehen Nachrichten mit dem Profil **${p.name}** aus.` } }));
            const form = live(h('div',
              h('div.grid', { style: 'margin-top:10px' }, field('Name', text(p, 'name')), field('Farbe', color(p, 'color'))),
              h('div.grid', field('Autor', text(p.author, 'name', { ph: '{server}' })), field('Autor-Bild', text(p.author, 'icon', { ph: '{server.icon}' }))),
              h('div.grid', field('Fußzeile', text(p.footer, 'text', { ph: '{server} · {date}' })), field('Fußzeilen-Bild', text(p.footer, 'icon', { ph: 'https://…' }))),
              h('div.grid', field('Vorschaubild', text(p, 'thumbnail', { ph: 'https://…' })), field('Großes Bild', text(p, 'image', { ph: 'https://…' }))),
              h('div', { style: 'margin-top:10px' }, toggle(p, 'timestamp', 'Zeitstempel'))), () => { upd(); sample(); });
            sample();
            b2.append(h('div.composer', form, h('div.preview-wrap', field('Vorschau', pv))));
          },
        })));
    }

    if (tab === 'templates') {
      const list = S.cfg.embeds.templates;
      body.append(card('Vorlagen', 'Gespeicherte Nachrichten. „Öffnen“ lädt sie in den Editor.', list.length ? h('div', list.map((t, n) => h('div.row', { style: 'padding:8px 0;border-bottom:1px solid var(--line)' },
        h('b', t.name), h('span.spacer'),
        h('button.btn.sm', { type: 'button', onclick: () => { S.draft = { channel: S.draft?.channel || '', messageId: '', name: t.name, message: clone(t.message) }; S.embedTab = 'compose'; rerender(); } }, 'Öffnen'),
        h('button.icon-btn', { type: 'button', title: 'Löschen', onclick: async () => { list.splice(n, 1); changed(); await saveNow(); } }, icon('trash'))))) : h('p.muted', 'Noch keine Vorlagen.')));
    }

    if (tab === 'sent') {
      const sent = await tryApi('/api/sent');
      body.append(card('Gesendete Nachrichten', null, sent.length ? h('div.tbl-wrap', h('table.tbl', h('tr', h('th', 'Name'), h('th', 'Kanal'), h('th', 'Wann'), h('th', '')),
        sent.map((m) => h('tr', h('td', m.name), h('td', `#${chanById(m.channel)?.name || '?'}`), h('td.muted', ago(m.at)),
          h('td', h('button.btn.sm', { type: 'button', onclick: () => { S.draft = { channel: m.channel, messageId: m.id, name: m.name, message: clone(m.message) }; S.embedTab = 'compose'; rerender(); } }, icon('edit'), 'Bearbeiten')))))) : h('p.muted', 'Noch nichts gesendet.')));
    }
  },
});

page({
  id: 'moderation', title: 'Moderation', icon: 'shield', group: 'Moderation', mods: ['moderation'], short: 'Bann, Kick, Timeout, Verwarnungen',
  desc: 'Befehle: /ban /unban /kick /softban /timeout /untimeout /warn /warnings /delwarn /clearwarns /purge /slowmode /lock /unlock. Wer welche Befehle sieht, regelst du in Discord unter Servereinstellungen → Integrationen.',
  async render(root) {
    const m = S.cfg.moderation;
    root.append(card('Einstellungen', null,
      h('div.grid', field('Mod-Log Kanal', chan(m, 'logChannel')), field('Standard-Timeout', num(m, 'muteDefaultMinutes', { min: 1, max: 40320, suffix: 'Minuten' }))),
      h('div.grid', { style: 'margin-top:12px' },
        toggle(m, 'requireReason', 'Grund ist Pflicht'), toggle(m, 'publicReply', 'Antworten für alle sichtbar', 'Sonst sieht nur der Moderator die Bestätigung'),
        field('Verwarnungen verfallen nach', num(m, 'warnExpireDays', { min: 0, max: 3650, suffix: 'Tagen (0 = nie)' })))));
    root.append(card('Automatische Strafen bei Verwarnungen', 'Erreicht jemand die Anzahl, passiert automatisch die Aktion.',
      listEditor(m, 'warnActions', {
        title: (a) => `${a.count} Verwarnungen`, sum: (a) => ({ timeout: `Timeout ${a.minutes} Min.`, kick: 'Kick', ban: a.minutes ? `Bann für ${a.minutes} Min.` : 'Bann', none: 'nichts' }[a.action] || a.action),
        add: () => ({ count: 3, action: 'timeout', minutes: 60 }), addLabel: 'Stufe',
        render: (a, b, upd) => b.append(live(h('div.grid.three', { style: 'margin-top:10px' },
          field('Ab Verwarnungen', num(a, 'count', { min: 1, max: 100 })), field('Aktion', sel(a, 'action', [['timeout', 'Timeout'], ['kick', 'Kick'], ['ban', 'Bann'], ['none', 'Nichts']])),
          field('Dauer', num(a, 'minutes', { min: 0, max: 525600, suffix: 'Min. (Bann: 0 = für immer)' }))), upd)),
      })));
    root.append(card('Nachricht an das Mitglied', 'Geht per DM raus, bevor die Strafe greift. Platzhalter: {action}, {reason}, {duration}, {server}.',
      toggle(m, 'dmUser', 'Mitglied per DM informieren'),
      h('div', { style: 'margin-top:12px' }, messageEditor(m, 'dmMessage', { vars: ['action', 'reason', 'duration', 'server', 'user'] }))));
    const cases = await tryApi('/api/cases');
    const filter = { q: '' };
    const tbody = h('tbody');
    const NAMES = { warn: 'Verwarnung', timeout: 'Timeout', untimeout: 'Timeout weg', kick: 'Kick', ban: 'Bann', tempban: 'Zeitbann', unban: 'Entbannt', softban: 'Softban' };
    const draw = () => {
      const q = filter.q.toLowerCase();
      tbody.replaceChildren(...cases.filter((c) => !q || `${c.userName} ${c.user} ${c.reason} ${c.modName}`.toLowerCase().includes(q)).slice(0, 200).map((c) => h('tr', { style: c.removed ? 'opacity:.45' : '' },
        h('td', `#${c.n}`), h('td', h('span.badge', NAMES[c.type] || c.type)), h('td', c.userName), h('td', c.reason || h('span.muted', '-')), h('td.muted', c.modName), h('td.muted', fmtDate(c.at)),
        h('td', c.type === 'warn' && !c.removed ? h('button.btn.sm', { type: 'button', onclick: async () => { await tryApi(`/api/cases/${c.n}/remove`, { method: 'POST', body: {} }); c.removed = true; draw(); } }, 'Entfernen') : ''))));
    };
    draw();
    root.append(card(`Fälle (${cases.length})`, null, h('input', { type: 'search', placeholder: 'Suchen nach Name, ID, Grund …', oninput: (e) => { filter.q = e.target.value; draw(); }, style: 'margin-bottom:10px' }),
      h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', h('th', 'Fall'), h('th', 'Art'), h('th', 'Mitglied'), h('th', 'Grund'), h('th', 'Von'), h('th', 'Wann'), h('th', ''))), tbody))));
  },
});

page({
  id: 'automod', title: 'Auto-Mod', icon: 'robot', group: 'Moderation', mods: ['automod'], short: 'Filter gegen Spam, Links, Beleidigungen',
  desc: 'Löscht Nachrichten, die gegen Regeln verstoßen, und bestraft auf Wunsch. Mitglieder mit „Nachrichten verwalten“ sind ausgenommen.',
  render(root) {
    const a = S.cfg.automod;
    root.append(card('Allgemein', null,
      h('div.grid', field('Log-Kanal', chan(a, 'logChannel')), field('Hinweis löschen nach', num(a, 'notifySeconds', { min: 2, max: 120, suffix: 'Sekunden' }))),
      field('Hinweis im Kanal (leer = keiner)', area(a, 'notify', { rows: 2, vars: ['user', 'reason'] })),
      h('div.grid', field('Ausgenommene Rollen', roles(a, 'exemptRoles')), field('Ausgenommene Kanäle', chans(a, 'exemptChannels', { kinds: ['text', 'announcement', 'category', 'forum'] })))));
    const rule = (key, title, hint, extra = []) => {
      const r = a[key];
      return h('div.card.sub', { style: 'margin-bottom:10px' }, toggle(r, 'on', title, hint),
        h('div.grid.three', { style: 'margin-top:10px' }, ...extra, field('Aktion', sel(r, 'action', ACTIONS)), field('Dauer (Timeout/Bann)', num(r, 'minutes', { min: 0, max: 40320, suffix: 'Min.' }))));
    };
    root.append(card('Regeln', null,
      rule('badwords', 'Verbotene Wörter', 'Erkennt auch Tricks wie 4 statt a. * = beliebige Buchstaben', [field('Wörter (eins pro Zeile)', strList(a.badwords, 'words', { ph: 'wort\nsch*ße' })), field('', toggle(a.badwords, 'wildcard', 'Auch als Teil von Wörtern'))]),
      rule('invites', 'Discord-Einladungen', 'discord.gg/… und ähnliche'),
      rule('links', 'Links', 'Alle Links außer erlaubten Domains', [field('Erlaubte Domains', strList(a.links, 'allow', { ph: 'youtube.com' }))]),
      rule('spam', 'Spam (viele Nachrichten schnell)', null, [field('Nachrichten', num(a.spam, 'count', { min: 2, max: 50 })), field('in Sekunden', num(a.spam, 'seconds', { min: 1, max: 60 }))]),
      rule('duplicates', 'Gleiche Nachricht wiederholt', null, [field('Wiederholungen', num(a.duplicates, 'count', { min: 2, max: 20 }))]),
      rule('mentions', 'Massen-Erwähnungen', null, [field('Max. Erwähnungen', num(a.mentions, 'max', { min: 1, max: 50 }))]),
      rule('caps', 'Großbuchstaben', null, [field('Ab Anteil', num(a.caps, 'percent', { min: 30, max: 100, suffix: '%' })), field('Mindestlänge', num(a.caps, 'min', { min: 3, max: 200, suffix: 'Buchstaben' }))]),
      rule('emojis', 'Emoji-Spam', null, [field('Max. Emojis', num(a.emojis, 'max', { min: 1, max: 100 }))]),
      rule('newlines', 'Zu viele Zeilen', null, [field('Max. Zeilen', num(a.newlines, 'max', { min: 2, max: 200 }))]),
      rule('zalgo', 'Zalgo-Text', 'Text mit übereinandergestapelten Zeichen')));
    const s = a.strikes;
    root.append(card('Wiederholungstäter', null, toggle(s, 'on', 'Zusätzliche Strafe nach mehreren Verstößen'),
      h('div.grid', { style: 'margin-top:10px' }, field('Verstöße', num(s, 'count', { min: 2, max: 50 })), field('innerhalb von', num(s, 'hours', { min: 1, max: 168, suffix: 'Stunden' })),
        field('Aktion', sel(s, 'action', [['timeout', 'Timeout'], ['kick', 'Kick'], ['ban', 'Bann']])), field('Dauer', num(s, 'minutes', { min: 0, max: 40320, suffix: 'Min.' })))));
  },
});

page({
  id: 'logs', title: 'Logs', icon: 'logs', group: 'Moderation', mods: ['logs'], short: 'Gelöschte Nachrichten, Beitritte, Rollen …',
  desc: 'Schreibt mit, was auf dem Server passiert. Jede Kategorie kann einen eigenen Kanal haben.',
  render(root) {
    const l = S.cfg.logs;
    root.append(card('Kanäle', null,
      h('div.grid', field('Standard-Kanal', chan(l, 'channel')), field('Nachrichten', chan(l.channels, 'messages', { empty: 'Standard-Kanal' })),
        field('Mitglieder', chan(l.channels, 'members', { empty: 'Standard-Kanal' })), field('Server', chan(l.channels, 'server', { empty: 'Standard-Kanal' })), field('Sprachkanäle', chan(l.channels, 'voice', { empty: 'Standard-Kanal' }))),
      h('div.grid', field('Diese Kanäle nicht loggen', chans(l, 'ignoreChannels', { kinds: ['text', 'announcement', 'category', 'voice'] })), field('', toggle(l, 'ignoreBots', 'Bots ignorieren')))));
    const E = [['messageDelete', 'Nachricht gelöscht'], ['messageEdit', 'Nachricht bearbeitet'], ['bulkDelete', 'Mehrere gelöscht'], ['memberJoin', 'Beitritt'], ['memberLeave', 'Verlassen'],
      ['memberBan', 'Bann'], ['memberUnban', 'Entbannt'], ['nickname', 'Nickname'], ['roles', 'Rollen eines Mitglieds'], ['timeout', 'Timeout'], ['channelCreate', 'Kanal erstellt'],
      ['channelDelete', 'Kanal gelöscht'], ['roleCreate', 'Rolle erstellt'], ['roleDelete', 'Rolle gelöscht'], ['voice', 'Sprachkanal betreten/verlassen'], ['invites', 'Einladung erstellt']];
    root.append(card('Was geloggt wird', null, h('div.grid.three', E.map(([k, t]) => toggle(l.events, k, t)))));
  },
});

page({
  id: 'welcome', title: 'Willkommen', icon: 'wave', group: 'Community', mods: ['welcome'], short: 'Begrüßung, Abschied, Auto-Rollen',
  desc: 'Begrüßt neue Mitglieder, verabschiedet Gehende und gibt automatisch Rollen.',
  render(root) {
    const w = S.cfg.welcome;
    const vars = ['user', 'user.name', 'user.avatar', 'user.created', 'server', 'members'];
    root.append(card('Begrüßung', null, field('Kanal', chan(w, 'channel', { empty: 'Keine Begrüßung im Kanal' })), h('div', { style: 'margin-top:12px' }, messageEditor(w, 'message', { vars }))));
    root.append(card('Private Nachricht', null, toggle(w, 'dmEnabled', 'Neuen Mitgliedern eine DM schicken'), h('div', { style: 'margin-top:12px' }, messageEditor(w, 'dm', { vars }))));
    root.append(card('Abschied', null, toggle(w, 'goodbyeEnabled', 'Nachricht, wenn jemand geht'), field('Kanal', chan(w, 'goodbyeChannel', { empty: 'Wie Begrüßung' })),
      h('div', { style: 'margin-top:12px' }, messageEditor(w, 'goodbye', { vars }))));
    root.append(card('Auto-Rollen', 'Die Bot-Rolle muss in der Rollenliste über diesen Rollen stehen.',
      h('div.grid', field('Rollen für neue Mitglieder', roles(w, 'autoRoles')), field('Rollen für neue Bots', roles(w, 'botRoles'))),
      field('Verzögerung', num(w, 'autoRoleDelay', { min: 0, max: 86400, suffix: 'Sekunden (z. B. für Regel-Bestätigung)' }))));
  },
});

page({
  id: 'levels', title: 'Level & XP', icon: 'star', group: 'Community', mods: ['levels'], short: 'XP für Aktivität, Rang-Rollen',
  desc: 'Mitglieder sammeln XP für Nachrichten (und Sprachkanäle) und steigen auf. Befehle: /rank, /leaderboard, /xp.',
  async render(root) {
    const l = S.cfg.levels;
    root.append(card('XP', null,
      h('div.grid.three', field('XP pro Nachricht von', num(l, 'xpMin', { min: 0, max: 1000 })), field('bis', num(l, 'xpMax', { min: 0, max: 1000 })), field('Abstand', num(l, 'cooldown', { min: 0, max: 3600, suffix: 'Sekunden' }))),
      h('div.grid', { style: 'margin-top:12px' }, toggle(l, 'voiceXp', 'XP in Sprachkanälen', 'Nur wenn mindestens 2 Menschen da sind'), field('XP pro Minute im Sprachkanal', num(l, 'voiceXpPerMinute', { min: 1, max: 100 })), toggle(l, 'resetOnLeave', 'XP löschen, wenn jemand geht')),
      h('div.grid', field('Keine XP für Rollen', roles(l, 'noXpRoles')), field('Keine XP in Kanälen', chans(l, 'noXpChannels', { kinds: ['text', 'announcement', 'voice', 'category'] }))),
      field('XP-Bonus für Rollen', listEditor(l, 'multipliers', {
        title: (x) => (roleById(x.role) ? `@${roleById(x.role).name}` : 'Rolle wählen'), sum: (x) => `×${x.factor}`, add: () => ({ role: '', factor: 2 }), addLabel: 'Bonus',
        render: (x, b, upd) => b.append(live(h('div.grid', { style: 'margin-top:10px' }, field('Rolle', role(x, 'role')), field('Faktor', num(x, 'factor', { min: 1, max: 10, step: 0.1, suffix: '× XP' }))), upd)),
      }))));
    root.append(card('Level-Aufstieg', null,
      h('div.grid', field('Meldung', sel(l, 'announce', [['current', 'Im Kanal der Nachricht'], ['channel', 'In festem Kanal'], ['dm', 'Per DM'], ['off', 'Keine Meldung']])), field('Fester Kanal', chan(l, 'announceChannel'))),
      h('div', { style: 'margin-top:12px' }, messageEditor(l, 'levelUp', { vars: ['user', 'user.name', 'level', 'xp', 'rank', 'server'] }))));
    root.append(card('Rang-Rollen', 'Rollen, die man mit einem Level bekommt.',
      toggle(l, 'stackRewards', 'Alle bisherigen Rollen behalten', 'Aus = nur die höchste Rolle'),
      h('div', { style: 'margin-top:10px' }, listEditor(l, 'rewards', {
        title: (x) => `Level ${x.level}`, sum: (x) => (roleById(x.role) ? `@${roleById(x.role).name}` : ''), add: () => ({ level: 5, role: '' }), addLabel: 'Rang-Rolle',
        render: (x, b, upd) => b.append(live(h('div.grid', { style: 'margin-top:10px' }, field('Ab Level', num(x, 'level', { min: 1, max: 500 })), field('Rolle', role(x, 'role'))), upd)),
      }))));
    const lb = await tryApi('/api/levels');
    const body = h('tbody', lb.list.map((u) => h('tr',
      h('td', `#${u.rank}`), h('td', h('div.who-cell', h('img', { src: u.avatar || 'icon.svg', alt: '' }), u.name)), h('td', `Level ${u.level}`),
      h('td', h('div.bar', h('i', { style: `width:${Math.round((u.into / u.next) * 100)}%` })), h('span.muted.small', `${u.into}/${u.next}`)), h('td', `${u.xp} XP`), h('td.muted', u.msgs),
      h('td', h('button.btn.sm', { type: 'button', onclick: async () => {
        const v = prompt(`Neue XP für ${u.name}`, u.xp);
        if (v === null) return;
        await tryApi('/api/levels/set', { method: 'POST', body: { user: u.id, xp: Number(v) } });
        toast('Geändert'); rerender();
      } }, 'XP ändern')))));
    root.append(card(`Rangliste (${lb.total})`, null, lb.list.length ? h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', h('th', ''), h('th', 'Mitglied'), h('th', 'Level'), h('th', 'Fortschritt'), h('th', 'XP'), h('th', 'Nachr.'), h('th', ''))), body)) : h('p.muted', 'Noch niemand hat XP.'),
      h('div.row.end', { style: 'margin-top:10px' }, h('button.btn.sm.danger', { type: 'button', onclick: async () => {
        if (prompt('Alle XP auf diesem Server löschen? Tippe RESET') !== 'RESET') return;
        await tryApi('/api/levels/reset', { method: 'POST', body: { confirm: 'RESET' } });
        toast('Alle XP gelöscht'); rerender();
      } }, 'Alle XP zurücksetzen'))));
  },
});

page({
  id: 'reactionroles', title: 'Reaction Roles', icon: 'roles', group: 'Community', mods: ['reactionroles'], short: 'Rollen per Reaktion, Button oder Menü', toggle: false,
  desc: 'Mitglieder holen sich Rollen selbst: per Reaktion, Button oder Auswahlmenü. Nach Änderungen „Veröffentlichen“ klicken.',
  render(root) {
    const r = S.cfg.reactionroles;
    const STY = { blue: 'blue', grey: '', green: 'green', red: 'red' };
    root.append(card('Panels', null, listEditor(r, 'panels', {
      title: (p) => p.name, sum: (p) => `${{ reactions: 'Reaktionen', buttons: 'Buttons', select: 'Menü' }[p.type]} · ${p.items.length} Rollen${p.messageId ? ' · veröffentlicht' : ''}`,
      add: () => ({ id: uid(), name: 'Rollen', channel: '', messageId: '', type: 'buttons', mode: 'normal', placeholder: 'Rollen auswählen', message: { content: '', embed: { ...EMPTY_EMBED(), enabled: true, title: 'Rollen', description: 'Hol dir deine Rollen mit den Buttons unten.' } }, items: [] }),
      addLabel: 'Panel',
      render: (p, b, upd) => {
        const buttons = () => (p.type === 'buttons' ? p.items.map((it) => ({ label: `${it.emoji ? `${it.emoji.startsWith('<') ? '' : it.emoji} ` : ''}${it.label || roleById(it.role)?.name || 'Rolle'}`, style: STY[it.style] }))
          : p.type === 'select' ? [{ label: `▾ ${p.placeholder || 'Rollen auswählen'}` }] : p.items.map((it) => ({ label: `${it.emoji || '?'} 1` })));
        b.append(live(h('div',
          h('div.grid', { style: 'margin-top:10px' }, field('Name', text(p, 'name')), field('Kanal', chan(p, 'channel'))),
          h('div.grid', field('Art', sel(p, 'type', [['buttons', 'Buttons'], ['select', 'Auswahlmenü'], ['reactions', 'Reaktionen']])),
            field('Verhalten', sel(p, 'mode', [['normal', 'An/aus schalten'], ['unique', 'Nur eine Rolle aus diesem Panel'], ['add', 'Nur geben (Verifizierung)'], ['remove', 'Nur wegnehmen']])),
            field('Text im Menü', text(p, 'placeholder'))),
          h('div', { style: 'margin-top:12px' }, messageEditor(p, 'message', { vars: ['server', 'members'], buttons })),
          field('Rollen', listEditor(p, 'items', {
            title: (it) => (roleById(it.role) ? `${it.emoji ? `${it.emoji} ` : ''}@${roleById(it.role).name}` : 'Rolle wählen'), sum: (it) => it.label || '', add: () => ({ emoji: '', role: '', label: '', style: 'grey', description: '' }), addLabel: 'Rolle', max: 25,
            render: (it, b2, upd2) => b2.append(live(h('div.grid', { style: 'margin-top:10px' }, field('Rolle', role(it, 'role')), field('Emoji', emoji(it, 'emoji')),
              field('Beschriftung', text(it, 'label', { max: 80 })), field('Farbe (Buttons)', sel(it, 'style', [['grey', 'Grau'], ['blue', 'Blau'], ['green', 'Grün'], ['red', 'Rot']])),
              field('Beschreibung (Menü)', text(it, 'description', { max: 100 }))), upd2)),
          })),
          h('div.row.end', { style: 'margin-top:12px' }, h('button.btn.primary', { type: 'button', onclick: async () => {
            if (!p.channel) return toast('Bitte einen Kanal wählen', true);
            if (!await saveNow()) return;
            const res = await tryApi(`/api/rr/${p.id}/publish`, { method: 'POST', body: {} });
            const all = await api('/api/config'); S.cfg.reactionroles = all.reactionroles; S.saved.reactionroles = JSON.stringify(all.reactionroles);
            toast(`Veröffentlicht`); rerender();
            void res;
          } }, icon('send'), p.messageId ? 'Aktualisieren' : 'Veröffentlichen'))), upd));
      },
    })));
  },
});

const TRIGGERS = [['prefix', 'Präfix-Befehl (!name)'], ['slash', 'Slash-Befehl (/name)'], ['exact', 'Nachricht ist genau'], ['startswith', 'Nachricht beginnt mit'], ['contains', 'Nachricht enthält']];
page({
  id: 'customcmds', title: 'Eigene Befehle', icon: 'cmd', group: 'Community', mods: ['customcmds'], short: 'Eigene Befehle und Auto-Antworten',
  desc: 'Eigene Befehle mit Text oder Embed, als /Slash-Befehl, !Präfix-Befehl oder automatische Antwort auf Wörter. Können auch Rollen geben oder nehmen.',
  render(root) {
    const c = S.cfg.customcmds;
    root.append(card(null, null, field('Präfix für Präfix-Befehle', text(c, 'prefix', { max: 5 }))));
    root.append(card('Befehle', null, listEditor(c, 'commands', {
      title: (x) => (x.trigger === 'slash' ? `/${x.name}` : x.trigger === 'prefix' ? `${c.prefix}${x.name}` : `„${x.name}“`), sum: (x) => `${TRIGGERS.find((t) => t[0] === x.trigger)?.[1] || ''}${x.enabled === false ? ' · aus' : ''}`,
      add: () => ({ id: uid(), name: 'hallo', trigger: 'prefix', description: '', enabled: true, response: { content: 'Hallo {user}!', embed: EMPTY_EMBED() }, random: [], reply: false, dm: false, deleteTrigger: false, ephemeral: false, addRoles: [], removeRoles: [], requiredRoles: [], channels: [], cooldown: 0 }),
      addLabel: 'Befehl',
      render: (x, b, upd) => b.append(live(h('div',
        h('div.grid', { style: 'margin-top:10px' }, field('Auslöser', sel(x, 'trigger', TRIGGERS)), field('Name / Text', text(x, 'name', { max: 100 }), 'Slash-Befehle: nur Kleinbuchstaben, Zahlen, - und _'),
          field('Beschreibung (Slash)', text(x, 'description', { max: 100 }))),
        h('div', { style: 'margin-top:12px' }, messageEditor(x, 'response', { vars: ['user', 'user.name', 'args', 'args.1', 'channel', 'server', 'members'] })),
        field('Zufällige andere Antworten (eine pro Zeile, optional)', strList(x, 'random')),
        h('div.grid.three', { style: 'margin-top:12px' }, toggle(x, 'enabled', 'Aktiv'), toggle(x, 'reply', 'Als Antwort'), toggle(x, 'dm', 'Per DM'), toggle(x, 'deleteTrigger', 'Auslöser löschen'), toggle(x, 'ephemeral', 'Nur für Auslöser sichtbar (Slash)')),
        h('div.grid', field('Gibt Rollen', roles(x, 'addRoles')), field('Nimmt Rollen', roles(x, 'removeRoles')), field('Nur mit Rolle', roles(x, 'requiredRoles')), field('Nur in Kanälen', chans(x, 'channels'))),
        field('Abklingzeit', num(x, 'cooldown', { min: 0, max: 86400, suffix: 'Sekunden pro Mitglied' }))), upd)),
    })));
  },
});

page({
  id: 'birthdays', title: 'Geburtstage', icon: 'cake', group: 'Community', mods: ['birthdays'], short: 'Glückwünsche und Geburtstagsrolle',
  desc: 'Mitglieder tragen ihren Geburtstag mit /geburtstag setzen ein. Am Tag gratuliert der Bot und gibt für 24 Stunden eine Rolle.',
  async render(root) {
    const b = S.cfg.birthdays;
    root.append(card('Einstellungen', null, h('div.grid', field('Kanal', chan(b, 'channel')), field('Geburtstagsrolle', role(b, 'role')), field('Uhrzeit', text(b, 'time', { type: 'time' }))),
      h('div', { style: 'margin-top:12px' }, messageEditor(b, 'message', { vars: ['user', 'user.name', 'age', 'age.number', 'server'] }))));
    const list = await tryApi('/api/birthdays');
    const M = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    root.append(card(`Eingetragen (${list.length})`, null, list.length ? h('div.chips', list.sort((x, y) => x.m - y.m || x.d - y.d).map((x) => h('span.chip', { style: 'padding-right:9px' }, `${x.d}. ${M[x.m - 1]} · ${x.name}`))) : h('p.muted', 'Noch niemand.')));
  },
});

page({
  id: 'giveaways', title: 'Gewinnspiele', icon: 'gift', group: 'Community', mods: ['giveaways'], short: 'Gewinnspiele mit Button', toggle: false,
  desc: 'Mitglieder machen per Button mit, am Ende zieht der Bot die Gewinner. Auch mit /giveaway start.',
  async render(root) {
    const g = S.cfg.giveaways;
    const f = S.gwDraft || (S.gwDraft = { channel: '', prize: '', duration: '1d', winners: 1, role: '', description: '' });
    root.append(card('Neues Gewinnspiel', null,
      h('div.grid', field('Kanal', chan(f, 'channel')), field('Preis', text(f, 'prize', { ph: 'z. B. Nitro', max: 200 })), field('Dauer', text(f, 'duration', { ph: '30m, 2h, 3d' })),
        field('Gewinner', num(f, 'winners', { min: 1, max: 20 })), field('Nur mit Rolle', role(f, 'role', { empty: 'Alle' }))),
      field('Beschreibung', area(f, 'description', { rows: 2 })),
      h('div.row.end', { style: 'margin-top:12px' }, h('button.btn.primary', { type: 'button', onclick: async () => {
        await tryApi('/api/giveaways', { method: 'POST', body: f });
        S.gwDraft = null; toast('Gewinnspiel gestartet'); rerender();
      } }, icon('gift'), 'Starten'))));
    root.append(card('Aussehen', null, h('div.grid', field('Emoji', emoji(g, 'emoji')), field('Farbe', color(g, 'color')))));
    const list = await tryApi('/api/giveaways');
    root.append(card('Gewinnspiele', null, list.length ? h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', h('th', 'Preis'), h('th', 'Status'), h('th', 'Teilnehmer'), h('th', 'Gewinner'), h('th', ''))),
      h('tbody', list.map((x) => h('tr', h('td', h('b', x.prize), h('div.muted.small', `#${chanById(x.channel)?.name || '?'} · ID ${x.id}`)),
        h('td', x.ended ? h('span.badge', 'beendet') : h('span.badge.on', `endet ${fmtDate(x.ends)}`)), h('td', x.entries.length), h('td.small', (x.won || []).map((id) => `<@${id}>`).join(', ') || '-'),
        h('td', h('div.row', x.ended ? h('button.btn.sm', { type: 'button', onclick: async () => { await tryApi(`/api/giveaways/${x.id}/reroll`, { method: 'POST', body: {} }); toast('Neu gezogen'); rerender(); } }, 'Neu ziehen')
          : h('button.btn.sm', { type: 'button', onclick: async () => { await tryApi(`/api/giveaways/${x.id}/end`, { method: 'POST', body: {} }); toast('Beendet'); rerender(); } }, 'Jetzt beenden'),
        h('button.icon-btn', { type: 'button', title: 'Aus der Liste löschen', onclick: async () => { await tryApi(`/api/giveaways/${x.id}`, { method: 'DELETE' }); rerender(); } }, icon('trash'))))))))) : h('p.muted', 'Noch keine.')));
  },
});

page({
  id: 'starboard', title: 'Starboard', icon: 'star', group: 'Community', mods: ['starboard'], short: 'Beliebte Nachrichten sammeln',
  desc: 'Nachrichten mit genug ⭐-Reaktionen landen automatisch im Starboard-Kanal.',
  render(root) {
    const s = S.cfg.starboard;
    root.append(card(null, null, h('div.grid', field('Kanal', chan(s, 'channel')), field('Emoji', emoji(s, 'emoji', { ph: '⭐' })), field('Ab Reaktionen', num(s, 'threshold', { min: 1, max: 100 }))),
      h('div.grid', { style: 'margin-top:12px' }, toggle(s, 'selfStar', 'Eigene Reaktion zählt'), field('Kanäle ignorieren', chans(s, 'ignoreChannels')))));
  },
});

/* ---------- minecraft ---------- */
function timeline(events, from, to) {
  const bar = h('div.timeline');
  const span = to - from;
  let state = null; let t = from;
  const first = events[0]?.t ?? to;
  if (first > from) bar.append(h('i.unknown', { style: `left:0;width:${((Math.min(first, to) - from) / span) * 100}%`, title: 'keine Daten' }));
  const seg = (a, b, on) => { if (on && b > a) bar.append(h('i', { style: `left:${((a - from) / span) * 100}%;width:${((b - a) / span) * 100}%`, title: `online ${fmtDate(a)} – ${fmtDate(b)}` })); };
  for (const e of events) {
    if (e.t <= from) { state = e.on; continue; }
    if (state !== null) seg(t, e.t, state);
    state = e.on; t = Math.max(e.t, from);
  }
  if (state !== null) seg(t, to, state);
  bar.append(h('span.now'));
  return bar;
}
function sparkline(samples, from, to) {
  const pts = samples.filter((s) => s.t >= from);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'spark'); svg.setAttribute('viewBox', '0 0 300 46'); svg.setAttribute('preserveAspectRatio', 'none');
  const max = Math.max(1, ...pts.map((p) => p.p));
  let d = ''; let pen = false;
  for (const p of pts) {
    if (p.p < 0) { pen = false; continue; }
    const x = ((p.t - from) / (to - from)) * 300; const y = 44 - (p.p / max) * 40;
    d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `; pen = true;
  }
  svg.innerHTML = `<path d="${d}" fill="none" stroke="var(--accent)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
  return h('div', { style: 'position:relative' }, svg, h('span.muted.small', { style: 'position:absolute;top:6px;left:2px' }, `Spieler (max. ${max})`));
}

page({
  id: 'minecraft', title: 'Minecraft', icon: 'cube', group: 'Benachrichtigungen', mods: ['minecraft'], short: 'Wann welcher Server online ist',
  desc: 'Zeigt live, welche Minecraft-Server (Java und Bedrock) online sind, wer spielt und wann sie online waren. Mit Statusnachricht, die sich selbst aktualisiert, Meldungen und Kanalnamen-Zählern. Befehl: /mc.',
  async render(root) {
    const m = S.cfg.minecraft;
    const range = S.mcRange || '24h';
    const liveBox = h('div');
    const drawLive = (list) => {
      const to = Date.now(); const from = to - (range === '7d' ? 7 * 864e5 : 864e5);
      liveBox.replaceChildren(...(list.length ? list.map((s) => {
        const st = s.status;
        const badge = !st ? h('span.badge', 'wird geprüft') : st.online ? h('span.badge.on', 'online') : h('span.badge.off', 'offline');
        const last = s.events.at(-1);
        return h('div.card',
          h('div.mc',
            h('div.fav', st?.favicon ? h('img', { src: st.favicon, alt: '', style: 'width:100%;height:100%;border-radius:10px;image-rendering:pixelated' }) : (s.emoji || '⛏️')),
            h('div', h('h3', s.name, badge, h('span.badge', s.edition === 'bedrock' ? 'Bedrock' : 'Java')),
              st?.motd ? h('div.motd', st.motd) : null,
              h('div.muted.small', { style: 'margin-top:4px' }, [
                last ? `${st?.online ? 'online' : 'offline'} seit ${fmtDate(last.t)}` : '',
                !st?.online && s.lastOnline ? `zuletzt online ${ago(s.lastOnline)}` : '',
                st?.version ? `Version ${st.version}` : '', st?.online && st.ping ? `${st.ping} ms` : '', st?.error && !st.online ? st.error : '',
              ].filter(Boolean).join(' · '))),
            h('div.nums', st?.online ? [h('b', `${st.players}`), h('span.muted', ` / ${st.max}`), h('div.muted.small', 'Spieler')] : h('span.muted', '–'))),
          st?.list?.length ? h('div.players', st.list.map((n) => h('span', h('img', { src: `https://mc-heads.net/avatar/${encodeURIComponent(n)}/18`, alt: '', loading: 'lazy' }), n))) : null,
          timeline(s.events, from, to),
          h('div.tl-axis', h('span', range === '7d' ? 'vor 7 Tagen' : 'vor 24 Std.'), h('span', `Online: ${(range === '7d' ? s.uptime7 : s.uptime24) ?? '–'} %`), h('span', 'jetzt')),
          s.samples.length > 1 ? sparkline(s.samples, from, to) : null);
      }) : [h('div.empty', 'Noch keine Server. Trag unten welche ein und speichere.')]));
    };
    const reload = async (refresh) => drawLive(await tryApi(refresh ? '/api/mc/refresh' : '/api/mc', refresh ? { method: 'POST', body: {} } : undefined));
    root.append(h('div.row', { style: 'margin-bottom:10px' }, h('div.seg-tabs', [['24h', '24 Stunden'], ['7d', '7 Tage']].map(([k, l]) => h('button', { class: range === k ? 'on' : '', onclick: () => { S.mcRange = k; rerender(); } }, l))),
      h('span.spacer'), h('button.btn.sm', { type: 'button', onclick: () => reload(true) }, icon('refresh'), 'Jetzt prüfen')), liveBox);
    reload(false);
    clearInterval(S.mcTimer);
    S.mcTimer = setInterval(() => { if (S.page === 'minecraft' && !document.hidden) reload(false).catch(() => {}); else clearInterval(S.mcTimer); }, 20_000);

    root.append(card('Server', 'Adresse wie im Minecraft-Client. Bei Java werden SRV-Einträge erkannt.', listEditor(m, 'servers', {
      title: (s) => `${s.emoji ? `${s.emoji} ` : ''}${s.name || s.host || 'Server'}`, sum: (s) => `${s.host}${s.port ? `:${s.port}` : ''} · ${s.edition === 'bedrock' ? 'Bedrock' : 'Java'}`,
      add: () => ({ id: uid(), name: '', host: '', port: 0, edition: 'java', emoji: '', hideAddress: false }), addLabel: 'Server', max: 25,
      render: (s, b, upd) => {
        const result = h('div.hint');
        b.append(live(h('div',
          h('div.grid', { style: 'margin-top:10px' }, field('Name', text(s, 'name', { ph: 'Survival' })), field('Adresse', text(s, 'host', { ph: 'play.example.com' })),
            field('Port (0 = Standard)', num(s, 'port', { min: 0, max: 65535 })), field('Edition', sel(s, 'edition', [['java', 'Java'], ['bedrock', 'Bedrock']])), field('Emoji', emoji(s, 'emoji', { ph: '🟩' }))),
          h('div.row', { style: 'margin-top:10px' }, toggle(s, 'hideAddress', 'Adresse nicht öffentlich zeigen'), h('span.spacer'),
            h('button.btn.sm', { type: 'button', onclick: async () => {
              result.textContent = 'Prüfe …';
              const r = await tryApi('/api/mc/test', { method: 'POST', body: s });
              result.textContent = r.online ? `✅ Online · ${r.players}/${r.max} Spieler · ${r.version} · ${r.ping} ms${r.motd ? ` · ${r.motd.split('\n')[0]}` : ''}` : `❌ Nicht erreichbar: ${r.error}`;
            } }, 'Testen')), result), upd));
      },
    })));
    root.append(card('Abfrage', null, h('div.grid', field('Alle', num(m, 'interval', { min: 20, max: 3600, suffix: 'Sekunden prüfen' })), field('Offline erst nach', num(m, 'offlineAfter', { min: 1, max: 10, suffix: 'Fehlversuchen' })))));
    const o = m.status;
    root.append(card('Statusnachricht', 'Eine Nachricht im Kanal, die der Bot immer aktuell hält.',
      field('Kanal', chan(m, 'statusChannel', { empty: 'Keine Statusnachricht' })),
      h('div.grid', field('Titel', text(o, 'title')), field('Fußzeile', text(o, 'footer'), 'Platzhalter: {interval}, {online}, {total}')),
      field('Beschreibung', area(o, 'description', { rows: 2, vars: ['online', 'total'] })),
      h('div.grid.three', field('Farbe alle online', color(o, 'colorOnline', { allowEmpty: false })), field('Farbe alle offline', color(o, 'colorOffline', { allowEmpty: false })), field('Farbe gemischt', color(o, 'colorMixed', { allowEmpty: false })),
        field('Text online', text(o, 'onlineText')), field('Text offline', text(o, 'offlineText'))),
      h('div.grid.three', { style: 'margin-top:12px' }, toggle(o, 'showPlayers', 'Spielerzahl'), toggle(o, 'showPlayerList', 'Spielernamen'), toggle(o, 'showVersion', 'Version'),
        toggle(o, 'showMotd', 'MOTD'), toggle(o, 'showPing', 'Ping'), toggle(o, 'showAddress', 'Adresse'), toggle(o, 'showUptime', 'Online/offline seit'))));
    const sv = ['server.name', 'server.emoji', 'server.players', 'server.max', 'server.version', 'server.address'];
    root.append(card('Meldungen', 'Nachricht, wenn ein Server online oder offline geht.',
      h('div.grid', field('Kanal', chan(m, 'announceChannel', { empty: 'Keine Meldungen' })), field('Rolle erwähnen', role(m, 'announceRole', { empty: 'Niemanden' }))),
      field('Wenn online', messageEditor(m, 'announceOnline', { vars: sv, compact: true, sample: { 'server.name': m.servers[0]?.name || 'Survival' } })),
      field('Wenn offline', messageEditor(m, 'announceOffline', { vars: sv, compact: true, sample: { 'server.name': m.servers[0]?.name || 'Survival', 'server.emoji': '🔴' } }))));
    root.append(card('Kanalnamen-Zähler', 'Benennt einen (Sprach-)Kanal nach dem Status, z. B. „🟢 Survival: 5/20“. Discord erlaubt nur 2 Umbenennungen pro 10 Minuten.', listEditor(m, 'counters', {
      title: (c) => m.servers.find((s) => s.id === c.server)?.name || 'Server wählen', sum: (c) => (chanById(c.channel) ? `→ ${chanById(c.channel).name}` : ''),
      add: () => ({ server: m.servers[0]?.id || '', channel: '', online: '🟢 {server.name}: {server.players}/{server.max}', offline: '🔴 {server.name}: offline' }), addLabel: 'Zähler',
      render: (c, b, upd) => b.append(live(h('div.grid', { style: 'margin-top:10px' },
        field('Server', sel(c, 'server', [['', 'wählen'], ...m.servers.map((s) => [s.id, s.name || s.host])])), field('Kanal', chan(c, 'channel', { kinds: 'any' })),
        field('Name wenn online', text(c, 'online')), field('Name wenn offline', text(c, 'offline'))), upd)),
    })));
  },
});

/* ---------- social ---------- */
const FEEDS = [['youtube', 'YouTube'], ['twitch', 'Twitch'], ['kick', 'Kick'], ['reddit', 'Reddit'], ['bluesky', 'Bluesky'], ['rss', 'RSS / Webseite']];
const FEED_PH = { youtube: '@kanal oder Kanal-Link', twitch: 'kanalname', kick: 'kanalname', reddit: 'subreddit', bluesky: 'name.bsky.social', rss: 'https://…/feed.xml' };
page({
  id: 'social', title: 'Social-Alerts', icon: 'bell', group: 'Benachrichtigungen', mods: ['social'], short: 'YouTube, Twitch, Reddit, RSS …',
  desc: 'Meldet neue Videos, Livestreams und Beiträge. Ohne API-Schlüssel.',
  async render(root) {
    const s = S.cfg.social;
    const status = await api('/api/social/status').catch(() => ({}));
    root.append(card(null, null, field('Prüfen alle', num(s, 'interval', { min: 2, max: 120, suffix: 'Minuten' }))));
    root.append(card('Feeds', null, listEditor(s, 'feeds', {
      title: (f) => f.name || f.target || 'Neuer Feed', sum: (f) => {
        const st = status[f.id];
        return `${FEEDS.find((x) => x[0] === f.type)?.[1]}${chanById(f.channel) ? ` → #${chanById(f.channel).name}` : ''}${st?.error ? ` · ⚠️ ${st.error}` : st?.checkedAt ? ` · geprüft ${ago(st.checkedAt)}` : ''}${f.on === false ? ' · aus' : ''}`;
      },
      add: () => ({ id: uid(), type: 'youtube', target: '', name: '', channel: '', role: '', on: true, message: { content: '**{author}** hat etwas Neues: {link}', embed: EMPTY_EMBED() } }),
      addLabel: 'Feed', max: 50,
      render: (f, b, upd) => {
        const result = h('div.hint');
        const tgt = text(f, 'target', { ph: FEED_PH[f.type] });
        b.append(live(h('div',
          h('div.grid', { style: 'margin-top:10px' }, field('Plattform', sel(f, 'type', FEEDS, (v) => { tgt.placeholder = FEED_PH[v]; })), field('Kanal / Quelle', tgt), field('Anzeigename', text(f, 'name'))),
          h('div.grid', field('Posten in', chan(f, 'channel')), field('Erwähnen', role(f, 'role', { empty: 'Niemanden', extra: [['everyone', '@everyone']] })), field('', toggle(f, 'on', 'Aktiv'))),
          h('div', { style: 'margin-top:12px' }, messageEditor(f, 'message', { vars: ['author', 'title', 'link', 'platform', 'thumbnail', 'game', 'server'], compact: true })),
          h('div.row', { style: 'margin-top:10px' }, h('button.btn.sm', { type: 'button', onclick: async () => {
            result.textContent = 'Prüfe …';
            const r = await tryApi('/api/social/test', { method: 'POST', body: f });
            result.textContent = r.ok ? (r.live !== null ? (r.live ? `✅ Gefunden, gerade live: ${r.items[0]?.title || ''}` : '✅ Gefunden, gerade nicht live') : `✅ Gefunden. Neuester Eintrag: ${r.items[0]?.title || '(leer)'}`) : `❌ ${r.error}`;
          } }, 'Testen'), result)), upd));
      },
    })));
  },
});

page({
  id: 'timers', title: 'Geplante Nachrichten', icon: 'clock', group: 'Benachrichtigungen', mods: ['timers'], short: 'Wiederkehrende Ankündigungen',
  desc: 'Nachrichten, die regelmäßig, täglich, an bestimmten Wochentagen oder einmal zu einem Zeitpunkt gepostet werden.',
  render(root) {
    const t = S.cfg.timers;
    const D = [[1, 'Mo'], [2, 'Di'], [3, 'Mi'], [4, 'Do'], [5, 'Fr'], [6, 'Sa'], [7, 'So']];
    root.append(card(null, null, listEditor(t, 'messages', {
      title: (x) => x.name || 'Nachricht', sum: (x) => ({ interval: `alle ${x.every} Min.`, daily: `täglich ${x.time}`, weekly: `${(x.days || []).map((d) => D.find((y) => y[0] === Number(d))?.[1]).join(', ')} ${x.time}`, once: `am ${fmtDate(x.date)}` }[x.mode] || '') + (x.on === false ? ' · aus' : ''),
      add: () => ({ id: uid(), name: 'Erinnerung', channel: '', mode: 'daily', every: 60, time: '18:00', days: [1, 2, 3, 4, 5], date: '', on: true, message: { content: 'Vergesst nicht …', embed: EMPTY_EMBED() } }),
      addLabel: 'Nachricht', max: 50,
      render: (x, b, upd) => {
        const when = h('div');
        const drawWhen = () => when.replaceChildren(
          x.mode === 'interval' ? field('Alle', num(x, 'every', { min: 1, max: 100000, suffix: 'Minuten' }))
            : x.mode === 'once' ? field('Zeitpunkt', text(x, 'date', { type: 'datetime-local' }))
              : h('div.grid', field('Uhrzeit', text(x, 'time', { type: 'time' })), x.mode === 'weekly' ? field('Tage', h('div.chips', D.map(([n, l]) => {
                const on = (x.days || []).map(Number).includes(n);
                return h('button.btn.sm', { type: 'button', class: on ? 'primary' : '', onclick: () => { x.days = on ? x.days.filter((d) => Number(d) !== n) : [...(x.days || []), n]; changed(); drawWhen(); upd(); } }, l);
              }))) : null));
        drawWhen();
        b.append(live(h('div',
          h('div.grid', { style: 'margin-top:10px' }, field('Name', text(x, 'name')), field('Kanal', chan(x, 'channel')),
            field('Wann', sel(x, 'mode', [['daily', 'Täglich'], ['weekly', 'An Wochentagen'], ['interval', 'Alle X Minuten'], ['once', 'Einmal']], () => drawWhen())), field('', toggle(x, 'on', 'Aktiv'))),
          h('div', { style: 'margin-top:10px' }, when),
          h('div', { style: 'margin-top:12px' }, messageEditor(x, 'message', { vars: ['server', 'members', 'date', 'time'], compact: true }))), upd));
      },
    })));
  },
});

/* ---------- server tools ---------- */
page({
  id: 'tickets', title: 'Tickets', icon: 'ticket', group: 'Server', mods: ['tickets'], short: 'Support-Tickets per Button',
  desc: 'Mitglieder öffnen per Button ein privates Ticket. Beim Schließen bekommt der Log-Kanal und das Mitglied den Verlauf als Datei.',
  async render(root) {
    const t = S.cfg.tickets;
    root.append(card('Einstellungen', null,
      h('div.grid', field('Kategorie für Tickets', chan(t, 'category', { kinds: 'category', empty: 'Keine (oben)' })), field('Support-Rollen', roles(t, 'supportRoles')), field('Log-Kanal', chan(t, 'logChannel')),
        field('Max. offene Tickets pro Mitglied', num(t, 'maxOpen', { min: 1, max: 10 })), field('Kanalname', text(t, 'nameTemplate'), '{ticket} = Nummer, {user.name} = Name'))));
    root.append(card('Panel', 'Die Nachricht mit dem „Ticket öffnen“-Button.',
      h('div.grid', field('Kanal', chan(t, 'panelChannel')), field('Button-Text', text(t, 'buttonLabel', { max: 80 })), field('Button-Emoji', emoji(t, 'buttonEmoji'))),
      h('div', { style: 'margin-top:12px' }, messageEditor(t, 'panel', { vars: ['server'], buttons: () => [{ label: `${t.buttonEmoji || ''} ${t.buttonLabel}`, style: 'blue' }] })),
      h('div.row.end', { style: 'margin-top:12px' }, h('button.btn.primary', { type: 'button', onclick: async () => {
        if (!await saveNow()) return;
        await tryApi('/api/tickets/publish', { method: 'POST', body: {} });
        const all = await api('/api/config'); S.cfg.tickets = all.tickets; S.saved.tickets = JSON.stringify(all.tickets);
        toast('Panel veröffentlicht'); rerender();
      } }, icon('send'), t.panelMessageId ? 'Panel aktualisieren' : 'Panel veröffentlichen'))));
    root.append(card('Nachricht im neuen Ticket', null, messageEditor(t, 'opened', { vars: ['user', 'user.name', 'ticket', 'server'], buttons: [{ label: '🙋 Übernehmen' }, { label: '🔒 Schließen', style: 'red' }] })));
    const open = await tryApi('/api/tickets');
    root.append(card(`Offene Tickets (${open.length})`, null, open.length ? h('div', open.map((x) => h('div.row', { style: 'padding:6px 0' }, h('b', `#${x.n}`), `#${x.name || '?'}`, h('span.muted.small', fmtDate(x.at)), x.claimedBy ? h('span.badge.on', 'übernommen') : null))) : h('p.muted', 'Keine.')));
  },
});

page({
  id: 'counters', title: 'Statistik-Kanäle', icon: 'chart', group: 'Server', mods: ['counters'], short: 'Mitgliederzahl im Kanalnamen',
  desc: 'Kanäle, deren Name Server-Zahlen zeigt (alle 10 Minuten aktualisiert). Am besten Sprachkanäle, die niemand betreten darf.',
  render(root) {
    const c = S.cfg.counters;
    root.append(card(null, 'Platzhalter: {members}, {humans}, {bots}, {boosts}, {tier}, {channels}, {roles}, {emojis}', listEditor(c, 'items', {
      title: (x) => fillVars(x.template, sampleVars()), sum: (x) => (chanById(x.channel) ? `→ ${chanById(x.channel).name}` : 'Kanal wählen'),
      add: () => ({ id: uid(), channel: '', template: '👥 Mitglieder: {members}' }), addLabel: 'Zähler', max: 10,
      render: (x, b, upd) => b.append(live(h('div.grid', { style: 'margin-top:10px' }, field('Kanal', chan(x, 'channel', { kinds: 'any' })), field('Name', text(x, 'template', { max: 100 }))), upd)),
    })));
  },
});

page({
  id: 'tempvoice', title: 'Temp-Sprachkanäle', icon: 'mic', group: 'Server', mods: ['tempvoice'], short: 'Eigener Sprachkanal per Beitritt',
  desc: 'Wer den „Erstellen“-Kanal betritt, bekommt einen eigenen Sprachkanal, der beim Verlassen wieder verschwindet.',
  render(root) {
    const t = S.cfg.tempvoice;
    root.append(card(null, null, h('div.grid', field('„Erstellen“-Kanal', chan(t, 'hub', { kinds: 'voice' })), field('Kategorie', chan(t, 'category', { kinds: 'category', empty: 'Wie der Erstellen-Kanal' })),
      field('Name', text(t, 'name'), '{user.name} = Name des Mitglieds'), field('Max. Personen', num(t, 'limit', { min: 0, max: 99, suffix: '0 = unbegrenzt' })))));
  },
});

page({
  id: 'prank', title: 'Prank', icon: 'prank', group: 'Nur für dich', prank: true,
  desc: 'Harmlose Scherze für diesen Server. Nur du siehst diesen Bereich, alles lässt sich jederzeit stoppen.',
  render(root) { window.PrankUI.mount(root, { api, toast }); },
});

page({
  id: 'tools', title: 'Werkzeuge', icon: 'tool', group: 'Nur für dich', owner: true,
  desc: 'Personen sperren, wer gerade im Panel ist, Status, Logs und Neustart.',
  async render(root) {
    const d = await tryApi('/api/owner/tools');
    const act = (action, extra = {}) => tryApi('/api/owner/action', { method: 'POST', body: { action, ...extra } });
    const blockInput = h('input', { placeholder: 'Discord-ID, @Erwähnung oder Name', style: 'flex:1;min-width:200px' });
    const blockedEl = h('div.chips');
    const drawBlocked = (list) => blockedEl.replaceChildren(...(list.length ? list.map((b) => h('span.chip', b, h('button', { type: 'button', title: 'Entsperren', onclick: async () => { const r = await act('unblock', { value: b }); drawBlocked(r.blocked); toast('Entsperrt'); } }, '×'))) : [h('span.muted.small', 'Niemand gesperrt.')]));
    drawBlocked(d.blocked);
    const s = d.status;
    const up = s.uptime >= 86400 ? `${Math.floor(s.uptime / 86400)} T ${Math.floor((s.uptime % 86400) / 3600)} h` : `${Math.floor(s.uptime / 3600)} h ${Math.floor((s.uptime % 3600) / 60)} min`;
    const logPre = h('pre', { style: 'max-height:420px;overflow:auto;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:10px;font-size:12px;white-space:pre-wrap;margin:10px 0 0', hidden: true });
    root.append(
      card('Sperren', 'Gesperrte Personen kommen nicht mehr ins Panel und bekommen bei /aio keinen Link. Gilt für alle Server dieses Bots.',
        h('form.row', { onsubmit: async (e) => { e.preventDefault(); if (!blockInput.value.trim()) return; const r = await act('block', { value: blockInput.value.trim() }); blockInput.value = ''; drawBlocked(r.blocked); toast('Gesperrt'); } },
          blockInput, h('button.btn.primary', { type: 'submit' }, 'Sperren')), h('div', { style: 'margin-top:10px' }, blockedEl)),
      card(`Gerade im Panel (${d.people.length})`, 'Wer in den letzten 15 Minuten im Panel war.',
        d.people.length ? h('div', d.people.map((p) => h('div.row', { style: 'padding:6px 0;border-bottom:1px solid var(--line)' },
          h('div.who-cell', h('img', { src: p.avatar || 'icon.svg', alt: '' }), h('span', h('b', p.name), h('div.muted.small', `${p.guildName} · ${ago(p.at)}`))), h('span.spacer'),
          p.id === S.me.id ? h('span.badge.on', 'du') : h('button.btn.sm.danger', { type: 'button', onclick: async () => { const r = await act('block', { value: p.id }); drawBlocked(r.blocked); toast(`${p.name} gesperrt`); } }, 'Sperren')))) : h('p.muted', 'Niemand.')),
      card('Status', null, h('div.grid', ...[['Server', s.servers], ['Mitglieder', s.members], ['Läuft seit', up], ['Speicher', `${s.memoryMb} MB`], ['Node.js', s.node], ['System', s.platform], ['Version', s.commit || '-'], ['Intents', s.intents], ['Aktive Pranks', s.pranks]]
        .map(([k, v]) => h('div', h('div.muted.small', k), h('b', String(v)))))),
      card('Debug & Aktionen', null, h('div.row',
        h('button.btn', { type: 'button', onclick: async () => { const r = await tryApi('/api/owner/logs'); logPre.textContent = r.lines.join('\n') || '(leer)'; logPre.hidden = false; logPre.scrollTop = logPre.scrollHeight; } }, 'Logs anzeigen'),
        h('button.btn', { type: 'button', onclick: async () => { if (!confirm('Alle Panel-Links ungültig machen? Jeder braucht danach einen neuen /aio-Link (du nicht).')) return; await act('revoke'); toast('Alle Links zurückgezogen'); } }, 'Alle Links zurückziehen'),
        h('button.btn', { type: 'button', onclick: async () => { await act('stopPranks'); toast('Alle Pranks gestoppt'); } }, 'Alle Pranks stoppen'),
        h('button.btn.danger', { type: 'button', onclick: async () => { if (!confirm('Bot neu starten? Er ist ein paar Sekunden offline.')) return; await act('restart'); toast('Startet neu …'); setTimeout(() => boot(), 8000); } }, 'Bot neu starten')), logPre),
    );
  },
});

page({
  id: 'rights', title: 'Rechte', icon: 'shield', group: 'Nur für dich', rights: true,
  desc: 'Lege pro Befehl fest, welche Rollen und welche Mitglieder ihn auf diesem Server benutzen dürfen. Nur du siehst diesen Bereich.',
  async render(root, end) {
    const data = await tryApi('/api/rights');
    const rules = clone(data.rules || {});
    const users = { ...(data.users || {}) };
    let saved = JSON.stringify(rules);
    const PERM = [[8n, 'Administrator'], [4n, 'Mitglieder bannen'], [2n, 'Mitglieder kicken'], [32n, 'Server verwalten'], [16n, 'Kanäle verwalten'],
      [8192n, 'Nachrichten verwalten'], [1099511627776n, 'Mitglieder im Timeout'], [268435456n, 'Rollen verwalten']];
    const permLabel = (p) => {
      if (!p) return 'alle';
      try { const v = BigInt(p); const hit = PERM.filter(([b]) => (v & b) === b).map(([, l]) => l); return hit.length ? hit.join(', ') : 'Sonderrecht'; } catch { return 'Sonderrecht'; }
    };
    const ruleOf = (n) => rules[n] || (rules[n] = { mode: 'default', roles: [], users: [] });
    const saveBtn = h('button.btn.primary', { type: 'button', disabled: true, onclick: async () => {
      saveBtn.disabled = true;
      try {
        const r = await tryApi('/api/rights', { method: 'PUT', body: { commands: rules } });
        for (const k of Object.keys(rules)) if (!r.rules[k]) delete rules[k];
        Object.assign(rules, clone(r.rules));
        saved = JSON.stringify(r.rules);
        toast('Rechte gespeichert');
        draw();
      } catch { mark(); }
    } }, 'Speichern');
    const norm = () => JSON.stringify(Object.fromEntries(Object.entries(rules).filter(([, r]) => r.mode !== 'default' || r.roles.length || r.users.length)));
    const mark = () => { saveBtn.disabled = norm() === saved; };
    end.prepend(saveBtn);

    const search = h('input', { type: 'search', placeholder: 'Befehl suchen …', style: 'max-width:280px' });
    const only = h('label.row', { style: 'gap:6px' }, h('input', { type: 'checkbox' }), 'Nur geänderte');
    const listEl = h('div');
    const MODE = [['default', 'Standard (Discord-Rechte)'], ['custom', 'Nur ausgewählte Rollen / Mitglieder'], ['off', 'Gesperrt (niemand)']];

    function userPicker(rule) {
      const wrap = h('div.chips');
      const results = h('div.chips', { style: 'margin-top:6px' });
      const input = h('input', { type: 'search', placeholder: '+ Mitglied (Name oder ID)', style: 'width:220px;padding:3px 10px;border-radius:999px;font-size:12.5px' });
      let t = null;
      input.addEventListener('input', () => {
        clearTimeout(t);
        const q = input.value.trim();
        if (!q) { results.replaceChildren(); return; }
        t = setTimeout(async () => {
          const found = await api(`/api/members?q=${encodeURIComponent(q)}`).catch(() => []);
          results.replaceChildren(...(found.length ? found : []).map((m) => h('button.chip', { type: 'button', style: 'padding-right:9px', onclick: () => {
            users[m.id] = { name: m.name, tag: m.tag, avatar: m.avatar };
            if (!rule.users.includes(m.id)) rule.users.push(m.id);
            input.value = ''; results.replaceChildren(); draw2(); mark();
          } }, m.avatar ? h('img', { src: m.avatar, alt: '', style: 'width:16px;height:16px;border-radius:50%' }) : null, `${m.name} (${m.tag})`)),
          found.length ? null : h('span.muted.small', 'Niemand gefunden'));
        }, 250);
      });
      const draw2 = () => wrap.replaceChildren(...rule.users.map((id) => h('span.chip',
        users[id]?.avatar ? h('img', { src: users[id].avatar, alt: '', style: 'width:16px;height:16px;border-radius:50%' }) : null, users[id]?.name || id,
        h('button', { type: 'button', title: 'Entfernen', onclick: () => { rule.users = rule.users.filter((x) => x !== id); draw2(); mark(); } }, '×'))), input);
      draw2();
      return h('div', wrap, results);
    }

    function row(c) {
      const rule = ruleOf(c.name);
      const body = h('div');
      const drawBody = () => {
        body.replaceChildren();
        if (rule.mode !== 'custom') return;
        const rolesEl = roles(rule, 'roles');
        rolesEl.addEventListener('change', mark);
        rolesEl.addEventListener('click', () => setTimeout(mark));
        body.append(h('div.grid', { style: 'margin-top:10px' }, field('Rollen', rolesEl), field('Mitglieder', userPicker(rule))),
          h('p.hint', 'Darf benutzen, wer eine der Rollen hat oder als Mitglied eingetragen ist. Du selbst darfst immer.'));
      };
      const mode = h('select', { style: 'max-width:300px', onchange: (e) => { rule.mode = e.target.value; drawBody(); mark(); } }, MODE.map(([v, l]) => h('option', { value: v }, l)));
      mode.value = rule.mode;
      drawBody();
      const badge = rule.mode === 'off' ? h('span.badge.off', 'gesperrt') : rule.mode === 'custom' ? h('span.badge.on', 'eigene Regel') : null;
      return h('div.rt-row', { 'data-cmd': c.name, style: 'padding:12px 0;border-bottom:1px solid var(--line)' },
        h('div.row', h('div', { style: 'min-width:0;flex:1' }, h('b', `/${c.name}`), ' ', c.custom ? h('span.badge', 'eigener Befehl') : null, ' ', badge,
          h('div.muted.small', `${c.description || ''}${c.description ? ' · ' : ''}Standard: ${permLabel(c.perm)}`)), mode),
        body);
    }
    function draw() {
      const q = search.value.trim().toLowerCase().replace(/^\//, '');
      const changedOnly = only.querySelector('input').checked;
      const list = data.commands.filter((c) => (!q || c.name.includes(q) || (c.description || '').toLowerCase().includes(q))
        && (!changedOnly || (rules[c.name] && rules[c.name].mode !== 'default')));
      listEl.replaceChildren(...(list.length ? list.map(row) : [h('p.muted', 'Kein Befehl gefunden.')]));
      mark();
    }
    search.addEventListener('input', draw);
    only.querySelector('input').addEventListener('change', draw);
    root.append(card(`${data.commands.length} Befehle`, 'Standard = so, wie Discord es vorgibt (z. B. /ban nur mit dem Recht „Mitglieder bannen“). Mit einer eigenen Regel zählen nur noch die ausgewählten Rollen und Mitglieder. Gilt auch für /aio und damit fürs Panel.',
      h('div.row', { style: 'margin-bottom:6px' }, search, only), listEl));
    draw();
  },
});

page({
  id: 'servers', title: 'Server & Panels', icon: 'key', group: 'Nur für dich', owner: true,
  desc: 'Alle Server, auf denen der Bot ist. Öffne das Panel eines Servers oder lass den Bot einen Server verlassen.',
  async render(root) {
    const list = await tryApi('/api/owner/servers');
    root.append(card(`${list.length} Server`, null, h('div', list.map((g) => h('div.row', { style: 'padding:8px 0;border-bottom:1px solid var(--line)' },
      h('div.who-cell', h('img', { src: g.icon || 'icon.svg', alt: '' }), h('span', h('b', g.name), h('div.muted.small', `${g.members} Mitglieder · seit ${fmtDate(g.joined)}`))), h('span.spacer'),
      g.id === S.guild.id ? h('span.badge.on', 'offen') : h('button.btn.sm', { type: 'button', onclick: async () => {
        const r = await tryApi('/api/owner/open', { method: 'POST', body: { guild: g.id } });
        upsertBackend(session.api, { token: r.token });
        boot();
      } }, 'Panel öffnen'),
      h('button.btn.sm.danger', { type: 'button', onclick: async () => {
        if (!confirm(`Bot wirklich von „${g.name}“ entfernen?`)) return;
        await tryApi('/api/owner/leave', { method: 'POST', body: { guild: g.id } });
        toast('Server verlassen'); rerender();
      } }, 'Verlassen'))))));
  },
});

/* ---------- guide ---------- */
function guide() {
  const os = S.guideOs || (/Linux|X11/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent) ? 'linux' : 'win');
  const copy = (txt) => h('div.cmd', h('code', txt), h('button.btn.sm', { type: 'button', onclick: async (e) => { try { await navigator.clipboard.writeText(txt); e.target.textContent = 'Kopiert'; } catch { /* ignore */ } } }, 'Kopieren'));
  const panes = {
    win: [copy('irm https://bot.labtoso.de/AIO/install.ps1 | iex'), h('p', h('a.btn.primary', { href: 'Install.bat', download: 'AIO-Install.bat' }, 'Install.bat herunterladen'), ' oder den Befehl in PowerShell einfügen. Keine extra Rechte nötig, Node.js ist dabei. Startet mit Windows und aktualisiert sich alle 15 Minuten selbst.')],
    linux: [copy('curl -fsSL https://bot.labtoso.de/AIO/install.sh | sudo bash'), h('p.muted', 'Debian, Ubuntu oder Fedora. Mit eigener Domain gibt es HTTPS über Caddy, sonst einen Cloudflare-Tunnel. Läuft als Dienst „aio“ und aktualisiert sich alle 15 Minuten selbst.')],
    proxmox: [copy('bash -c "$(curl -fsSL https://bot.labtoso.de/AIO/proxmox.sh)"'), h('p.muted', 'In der Shell deines Proxmox-Hosts (Node → Shell) einfügen. Legt einen Debian-LXC-Container an (2 CPU-Kerne, 512 MB RAM) und installiert den Bot darin. Am Ende steht die Backend-Adresse direkt in der Shell, außerdem in Proxmox beim Container unter Übersicht → Notizen. Nochmal ausführen = Update.')],
  };
  const tabs = h('div.tabs', [['win', 'Windows'], ['linux', 'Linux / VPS'], ['proxmox', 'Proxmox']].map(([k, l]) => h('button', { class: os === k ? 'on' : '', onclick: () => { S.guideOs = k; if ($('shell').hidden) openGuideStandalone(); else rerender(); } }, l)));
  return [
    card('1. Bot anlegen', null, h('ol', h('li', 'Öffne das ', h('a', { href: 'https://discord.com/developers/applications', target: '_blank' }, 'Discord Developer Portal'), ' → New Application → Namen eingeben.'),
      h('li', 'Links auf ', h('b', 'Bot'), ' → ', h('b', 'Reset Token'), ' → Token kopieren. Das ist das Passwort des Bots, gib es nie weiter.'),
      h('li', 'Weiter unten bei ', h('b', 'Privileged Gateway Intents'), ' die Schalter ', h('b', 'Server Members Intent'), ' und ', h('b', 'Message Content Intent'), ' einschalten und speichern. Ohne sie gehen Willkommen, Logs, Auto-Mod und Textbefehle nicht.'))),
    card('2. Installieren', 'Der Installer fragt nach dem Token, richtet alles ein und startet den Bot. Nochmal ausführen = Update, Einstellungen bleiben.', tabs, h('div', panes[os])),
    card('3. Einladen und loslegen', null, h('ol', h('li', 'Den Einladungslink aus der Installation öffnen (steht auch im Log) und deinen Server wählen.'),
      h('li', 'Auf dem Server ', h('code', '/aio'), ' eingeben. Der Link öffnet dieses Panel und verbindet das Backend von selbst.'),
      h('li', 'Den Namen des Bots stellst du hier unter ', h('b', 'Bot & Allgemein'), ' ein.'))),
  ];
}
page({ id: 'anleitung', title: 'Anleitung', icon: 'help', group: 'Hilfe', desc: 'Bot anlegen, installieren und einrichten.', render(root) { root.append(...guide()); } });

function openGuideStandalone() {
  document.body.classList.remove('gate-mode', 'nav-open');
  $('gate').hidden = true;
  $('shell').hidden = false;
  $('nav').replaceChildren(h('button.on', { onclick: () => { location.hash = ''; boot(); } }, icon('home'), 'Zurück'));
  const root = $('page');
  root.replaceChildren(h('div.page-head', h('div', h('h1', 'Anleitung'), h('p', 'Bot anlegen, installieren und einrichten.'))), ...guide());
}

/* ---------- start ---------- */
(async () => {
  await loadPresetBackends();
  boot();
})();
