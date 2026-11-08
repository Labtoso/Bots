/* Msik dashboard: talks to the bot API that /web links to. */

const I = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>',
  prev: '<path d="M19 20 9 12l10-8v16Z"/><path d="M5 19V5"/>',
  next: '<path d="m5 4 10 8-10 8V4Z"/><path d="M19 5v14"/>',
  shuffle: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/>',
  loop: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  loopOne: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/>',
  vol: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  load: '<path d="M21 12a9 9 0 1 1-6.2-8.56"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  playSm: '<path d="M8 5.5v13l11-6.5-11-6.5Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.9"/><path d="M12 17h.01"/>',
  note: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
};
const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

const T = {
  de: {
    settings: 'Einstellungen', close: 'Schließen', shuffle: 'Mischen', previous: 'Zurück', next: 'Weiter',
    playPause: 'Abspielen / Pause', loop: 'Wiederholen', loopOff: 'Wiederholen: aus', loopTrack: 'Wiederholen: Titel',
    loopQueue: 'Wiederholen: Warteschlange', mute: 'Stumm', filter: 'Effekt', filterNone: 'Keiner',
    filterTip: 'Klangeffekt für die Wiedergabe', autoplay: 'Autoplay', autoplayTip: 'Spielt ähnliche Titel, wenn die Warteschlange leer ist',
    stop: 'Stopp', leave: 'Trennen', searchPh: 'Titel suchen oder Link einfügen', queue: 'Warteschlange',
    history: 'Verlauf', clear: 'Leeren', queueEmpty: 'Die Warteschlange ist leer', add: 'Hinzufügen', addNext: 'Als Nächstes',
    playNow: 'Jetzt abspielen', remove: 'Entfernen', results: 'Ergebnisse', addAll: 'Alle hinzufügen ({n})',
    nothing: 'Nichts läuft', nothingSub: 'Such oben nach einem Titel', notConnected: 'Nicht im Sprachkanal',
    language: 'Sprache', accent: 'Akzentfarbe', session: 'Sitzung', logout: 'Abmelden', validUntil: 'Gültig bis {t}',
    requestedBy: 'von {n}', added: '„{t}“ hinzugefügt', addedMany: '{n} Titel hinzugefügt', noResults: 'Keine Treffer',
    gateNoLink: 'Kein Zugang', gateNoLinkText: 'Schreib /web in Discord und öffne den Link.',
    gateOffline: 'Bot nicht erreichbar', gateOfflineText: 'Der Bot ist offline oder wurde neu gestartet. Hol dir mit /web einen neuen Link.',
    gateExpired: 'Sitzung abgelaufen', retry: 'Erneut versuchen', reconnecting: 'Verbindung wird wiederhergestellt',
    autoplayTag: 'Autoplay', lenTotal: '{n} Titel · {d}',
    backend: 'Backend', addBackend: 'Hinzufügen', chooseBackend: 'Backend wählen', noToken: 'Kein Link, nutze /web',
    help: 'Anleitung', tutorial: 'Anleitung', copy: 'Kopieren', copied: 'Kopiert', back: 'Zurück', nextStep: 'Weiter', done: 'Fertig', stepOf: 'Schritt {a} von {b}',
    invalidUrl: 'Ungültige Adresse (https://…)', backendAdded: 'Backend hinzugefügt', gateNoBackend: 'Kein Backend gewählt',
    channel: 'Sprachkanal', channelTip: 'In welchen Sprachkanal der Bot geht', channelAuto: 'Automatisch: dein Sprachkanal',
    channelJoined: 'Bot ist jetzt in „{c}“', channelAutoSaved: 'Bot geht ab jetzt in deinen Sprachkanal', inChannel: 'Gerade in',
    playlists: 'Playlists', plCount: '{n} Titel', addPlaylist: 'Ganze Playlist hinzufügen', showPlaylist: 'Titel anzeigen',
    loadingPlaylist: 'Playlist wird geladen …',
  },
  en: {
    settings: 'Settings', close: 'Close', shuffle: 'Shuffle', previous: 'Previous', next: 'Next',
    playPause: 'Play / pause', loop: 'Repeat', loopOff: 'Repeat: off', loopTrack: 'Repeat: track', loopQueue: 'Repeat: queue',
    mute: 'Mute', filter: 'Effect', filterNone: 'None', filterTip: 'Sound effect for playback', autoplay: 'Autoplay',
    autoplayTip: 'Plays similar tracks when the queue is empty', stop: 'Stop', leave: 'Disconnect',
    searchPh: 'Search a track or paste a link', queue: 'Queue', history: 'History', clear: 'Clear',
    queueEmpty: 'The queue is empty', add: 'Add', addNext: 'Play next', playNow: 'Play now', remove: 'Remove',
    results: 'Results', addAll: 'Add all ({n})', nothing: 'Nothing playing', nothingSub: 'Search for a track above',
    notConnected: 'Not in a voice channel', language: 'Language', accent: 'Accent colour', session: 'Session',
    logout: 'Sign out', validUntil: 'Valid until {t}', requestedBy: 'by {n}', added: 'Added "{t}"', addedMany: 'Added {n} tracks',
    noResults: 'No results', gateNoLink: 'No access', gateNoLinkText: 'Type /web in Discord and open the link.',
    gateOffline: 'Bot unreachable', gateOfflineText: 'The bot is offline or was restarted. Get a new link with /web.',
    gateExpired: 'Session expired', retry: 'Try again', reconnecting: 'Reconnecting',
    autoplayTag: 'Autoplay', lenTotal: '{n} tracks · {d}',
    backend: 'Backend', addBackend: 'Add', chooseBackend: 'Choose backend', noToken: 'No link, use /web',
    help: 'Guide', tutorial: 'Guide', copy: 'Copy', copied: 'Copied', back: 'Back', nextStep: 'Next', done: 'Done', stepOf: 'Step {a} of {b}',
    invalidUrl: 'Invalid address (https://…)', backendAdded: 'Backend added', gateNoBackend: 'No backend selected',
    channel: 'Voice channel', channelTip: 'Which voice channel the bot joins', channelAuto: 'Automatic: your voice channel',
    channelJoined: 'Bot is now in "{c}"', channelAutoSaved: 'Bot now joins your voice channel', inChannel: 'Currently in',
    playlists: 'Playlists', plCount: '{n} tracks', addPlaylist: 'Add the whole playlist', showPlaylist: 'Show tracks',
    loadingPlaylist: 'Loading playlist …',
  },
};

const $ = (id) => document.getElementById(id);
const store = {
  get(k, d) { try { const v = localStorage.getItem(`msik.${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`msik.${k}`, JSON.stringify(v)); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(`msik.${k}`); } catch { /* ignore */ } },
};

let lang = store.get('lang', (navigator.language || 'de').startsWith('de') ? 'de' : 'en');
const t = (k, vars = {}) => (T[lang][k] || k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');

/* ---------- backends + session from the /web link ---------- */
const norm = (u) => String(u || '').trim().replace(/\/+$/, '');
let backends = store.get('backends', []);
const legacy = store.get('session', null);
if (legacy?.api) { backends.push({ api: norm(legacy.api), token: legacy.token }); store.del('session'); }
let activeApi = store.get('active', backends[0]?.api || null);

function saveBackends() { store.set('backends', backends); store.set('active', activeApi); }
function upsertBackend(api, data = {}) {
  api = norm(api);
  let b = backends.find((x) => x.api === api);
  if (!b) { b = { api }; backends.push(b); }
  Object.assign(b, data);
  saveBackends();
  return b;
}
function readLink() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (!h.get('api') || !h.get('t')) return false;
  upsertBackend(h.get('api'), { token: h.get('t') });
  activeApi = norm(h.get('api'));
  saveBackends();
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}
readLink();
window.addEventListener('hashchange', () => { if (readLink()) { renderBackends(); restart(); } });
let session = null;
function pickSession() {
  const b = backends.find((x) => x.api === activeApi);
  session = b?.token ? { api: b.api, token: b.token } : null;
  return b || null;
}
pickSession();

// Shared list of known backends (gh-pages: Msik/backends.json), merged without tokens.
async function loadPresetBackends() {
  try {
    const res = await fetch('backends.json', { cache: 'no-store' });
    if (!res.ok) return;
    const list = await res.json();
    for (const p of list) {
      if (!/^https:\/\//.test(p.api || '')) continue;
      const b = backends.find((x) => x.api === norm(p.api));
      if (!b) backends.push({ api: norm(p.api), name: p.name, preset: true });
      else if (!b.name) b.name = p.name;
    }
    if (!activeApi && backends[0]) activeApi = backends[0].api;
    saveBackends();
  } catch { /* optional file */ }
}

const health = new Map(); // api -> { ok, name }
async function checkHealth(b) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch(`${b.api}/health`, { signal: ctl.signal });
    clearTimeout(timer);
    const d = await res.json();
    health.set(b.api, { ok: !!d.ok, name: d.backend || d.bot });
    if (d.backend && !b.preset) b.name = d.backend;
  } catch {
    health.set(b.api, { ok: false });
  }
  renderBackends();
}

function renderBackends() {
  const list = $('backendList');
  list.replaceChildren();
  for (const b of backends) {
    const li = el('li', b.api === activeApi ? 'active' : '');
    const h = health.get(b.api);
    const dot = el('span', `dot ${h ? (h.ok ? 'on' : 'off') : ''}`);
    const btn = el('button', 'bk');
    btn.type = 'button';
    let host = b.api;
    try { host = new URL(b.api).host; } catch { /* keep */ }
    btn.append(el('b', '', b.name || h?.name || host), el('span', '', b.token ? host : `${host} · ${t('noToken')}`));
    btn.title = b.api;
    btn.onclick = () => selectBackend(b.api);
    li.append(dot, btn, iconBtn('x', t('remove'), () => removeBackend(b.api)));
    list.append(li);
  }
}

function selectBackend(api) {
  activeApi = api;
  saveBackends();
  renderBackends();
  openDrawer(false);
  restart();
}
function removeBackend(api) {
  backends = backends.filter((b) => b.api !== api);
  if (activeApi === api) activeApi = backends[0]?.api || null;
  saveBackends();
  renderBackends();
  restart();
}
function restart() {
  es?.close();
  state = null;
  sessInfo = null;
  $('sessionInfo').textContent = '';
  start();
}

/* ---------- API ---------- */
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(session.api + path, {
    method,
    headers: { Authorization: `Bearer ${session.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { showGate('expired'); throw new Error(data.error || 'expired'); }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
/* Shows the expected result at once; the bot's answer then confirms or corrects it. */
function predict(action, value) {
  if (!state) return;
  const s = { ...state, queue: [...state.queue], history: [...state.history] };
  const take = (id) => { const i = s.queue.findIndex((x) => x.id === id); return i < 0 ? null : s.queue.splice(i, 1)[0]; };
  switch (action) {
    case 'toggle': if (!s.current) return; s.paused = !s.paused; break;
    case 'pause': s.paused = true; break;
    case 'resume': s.paused = false; break;
    case 'skip':
      if (s.current) s.history.unshift(s.current);
      s.current = s.queue.shift() || null; s.position = 0; s.loading = !!s.current; s.paused = false; break;
    case 'jump': { const tr = take(value); if (!tr) return; if (s.current) s.history.unshift(s.current); s.current = tr; s.position = 0; s.loading = true; break; }
    case 'remove': if (!take(value)) return; break;
    case 'move': { const tr = take(value?.id); if (!tr) return; s.queue.splice(Math.max(0, Math.min(value.to, s.queue.length)), 0, tr); break; }
    case 'clear': s.queue = []; break;
    case 'stop': if (s.current) s.history.unshift(s.current); s.current = null; s.queue = []; break;
    case 'volume': s.volume = value; break;
    case 'filter': s.filter = value; break;
    case 'autoplay': s.autoplay = !!value; break;
    case 'seek': s.position = value; break;
    default: return;
  }
  render(s);
}
const control = (action, value) => (predict(action, value), api('/api/control', { method: 'POST', body: { action, value } }))
  .then((s) => { render(s); return s; })
  .catch((e) => { toast(e.message, true); api('/api/state').then(render).catch(() => {}); });

/* ---------- formatting ---------- */
const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function thumb(src) {
  if (!src) { const d = el('div', 'thumb-ph'); return d; }
  const img = el('img');
  img.src = src; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
  img.onerror = () => img.replaceWith(el('div', 'thumb-ph'));
  return img;
}
function iconBtn(icon, title, onClick) {
  const b = el('button', 'icon-btn sm');
  b.innerHTML = svg(icon); b.title = title; b.type = 'button';
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}

/* ---------- state + rendering ---------- */
let state = null;
let tickBase = { pos: 0, at: 0 };
let seeking = false;
let lastVol = store.get('lastVol', 60);

function render(s) {
  state = s;
  tickBase = { pos: s.position || 0, at: performance.now() };
  const c = s.current;

  // cover + meta
  const cover = $('cover');
  if (c?.thumbnail) {
    if (cover.dataset.src !== c.thumbnail) {
      cover.dataset.src = c.thumbnail;
      cover.src = c.thumbnail;
    }
    cover.hidden = false; $('coverPh').hidden = true;
  } else {
    cover.hidden = true; $('coverPh').hidden = false; cover.dataset.src = '';
  }
  $('title').textContent = c ? c.title : t('nothing');
  $('artist').textContent = c ? (c.artist || '') : t('nothingSub');
  $('requester').textContent = c ? [c.requester ? t('requestedBy', { n: c.requester }) : '', c.autoplay ? t('autoplayTag') : ''].filter(Boolean).join(' · ') : '';
  document.title = c ? `${c.title} · Msik` : 'Msik';

  $('btnPlay').innerHTML = svg(!c || s.paused ? 'play' : 'pause');
  for (const id of ['btnPlay', 'btnNext', 'btnStop']) $(id).disabled = !c;
  $('seek').disabled = !c || !c.duration;
  $('dur').textContent = c?.duration ? fmt(c.duration) : (c ? '--:--' : '0:00');

  const loopBtn = $('btnLoop');
  loopBtn.innerHTML = svg(s.loop === 'track' ? 'loopOne' : 'loop');
  loopBtn.classList.toggle('on', s.loop !== 'off');
  loopBtn.title = t({ off: 'loopOff', track: 'loopTrack', queue: 'loopQueue' }[s.loop]);

  if (document.activeElement !== $('volume')) setVolumeUI(s.volume);
  $('filter').value = s.filter;
  $('autoplay').checked = !!s.autoplay;

  $('voiceDot').className = `dot ${s.channel ? 'on' : ''}`;
  renderChannels();
  $('btnLeave').disabled = !s.channel;

  renderQueue(s);
  renderHistory(s);
  updateProgress();
}

function setVolumeUI(v) {
  $('volume').value = v;
  $('volume').style.setProperty('--p', `${(v / 150) * 100}%`);
  $('volVal').textContent = v;
  $('btnMute').innerHTML = svg(v === 0 ? 'mute' : 'vol');
}

function updateProgress() {
  if (!state) return;
  const c = state.current;
  let pos = tickBase.pos;
  if (c && !state.paused && !state.loading) pos += (performance.now() - tickBase.at) / 1000;
  if (c?.duration) pos = Math.min(pos, c.duration);
  if (!seeking) {
    const pct = c?.duration ? (pos / c.duration) * 100 : 0;
    $('seek').value = pct;
    $('seek').style.setProperty('--p', `${pct}%`);
    $('pos').textContent = fmt(c ? pos : 0);
  }
}
(function loop() { updateProgress(); requestAnimationFrame(loop); }());

function renderQueue(s) {
  const list = $('queueList');
  list.replaceChildren();
  s.queue.forEach((tr, i) => {
    const li = el('li', 'item');
    li.draggable = true;
    li.dataset.id = tr.id;
    li.append(el('span', 'idx', String(i + 1)), thumb(tr.thumbnail));
    const tx = el('div', 't');
    tx.append(el('b', '', tr.title), el('span', '', [tr.artist, tr.requester ? t('requestedBy', { n: tr.requester }) : ''].filter(Boolean).join(' · ')));
    tx.title = tr.title;
    const acts = el('div', 'acts');
    acts.append(
      iconBtn('playSm', t('playNow'), () => control('jump', tr.id)),
      ...(i > 0 ? [iconBtn('up', t('addNext'), () => control('move', { id: tr.id, to: 0 }))] : []),
      iconBtn('x', t('remove'), () => control('remove', tr.id)),
    );
    li.append(tx, el('span', 'd', tr.duration ? fmt(tr.duration) : ''), acts);
    li.addEventListener('dblclick', () => control('jump', tr.id));
    dnd(li);
    list.append(li);
  });
  $('qCount').textContent = s.queue.length;
  const total = s.queue.reduce((a, b) => a + (b.duration || 0), 0);
  $('qTotal').textContent = total ? fmt(total) : '';
  $('btnClear').disabled = !s.queue.length;
  $('btnShuffle').disabled = s.queue.length < 2;
  updateEmpty();
}

function renderHistory(s) {
  const list = $('historyList');
  list.replaceChildren();
  s.history.forEach((tr, i) => {
    const li = el('li', 'item');
    li.append(el('span', 'idx', String(i + 1)), thumb(tr.thumbnail));
    const tx = el('div', 't');
    tx.append(el('b', '', tr.title), el('span', '', tr.artist || ''));
    const acts = el('div', 'acts');
    acts.append(iconBtn('plus', t('add'), () => addTracks([tr])));
    li.append(tx, el('span', 'd', tr.duration ? fmt(tr.duration) : ''), acts);
    list.append(li);
  });
  updateEmpty();
}

let tab = 'queue';
function updateEmpty() {
  const n = tab === 'queue' ? (state?.queue.length || 0) : (state?.history.length || 0);
  $('queueEmpty').hidden = n > 0 || tab !== 'queue';
}

/* drag & drop reorder */
let dragId = null;
function dnd(li) {
  li.addEventListener('dragstart', (e) => { dragId = li.dataset.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
  li.addEventListener('dragend', () => { li.classList.remove('dragging'); dragId = null; clearDrop(); });
  li.addEventListener('dragover', (e) => {
    if (!dragId || dragId === li.dataset.id) return;
    e.preventDefault();
    const r = li.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    clearDrop();
    li.classList.add(after ? 'drop-after' : 'drop-before');
  });
  li.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dragId) return;
    const ids = state.queue.map((x) => x.id);
    const from = ids.indexOf(dragId);
    let to = ids.indexOf(li.dataset.id) + (li.classList.contains('drop-after') ? 1 : 0);
    if (from < to) to -= 1;
    clearDrop();
    if (from !== to) control('move', { id: dragId, to });
  });
}
const clearDrop = () => document.querySelectorAll('.drop-before,.drop-after').forEach((x) => x.classList.remove('drop-before', 'drop-after'));

/* ---------- search (live while typing) ---------- */
let lastResults = [];
let searchSeq = 0;
let searchCtl = null;
let searchTimer = null;
const searchCache = new Map();
const isLink = (q) => /^https?:\/\//i.test(q);

function liveSearch() {
  clearTimeout(searchTimer);
  const q = $('searchInput').value.trim();
  if (q.length < 2) { searchCtl?.abort(); $('results').hidden = true; setBusy(false); return; }
  // links are pasted in one go, so search them at once; text waits until typing pauses
  searchTimer = setTimeout(() => doSearch(q), isLink(q) ? 0 : 280);
}

function setBusy(on) {
  $('searchForm').classList.toggle('busy', on);
  $('searchIcon').innerHTML = svg(on ? 'load' : 'search');
}

async function doSearch(q) {
  clearTimeout(searchTimer);
  const key = `${activeApi}|${q.toLowerCase()}`;
  const hit = searchCache.get(key);
  if (hit) { searchCtl?.abort(); setBusy(false); showResults(hit, q); return; }
  const seq = ++searchSeq;
  searchCtl?.abort();
  searchCtl = new AbortController();
  setBusy(true);
  try {
    const res = await fetch(`${session.api}/api/search?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${session.token}` }, signal: searchCtl.signal,
    });
    const r = await res.json().catch(() => ({}));
    if (res.status === 401) { showGate('expired'); return; }
    if (!res.ok) throw new Error(r.error || `HTTP ${res.status}`);
    if (seq !== searchSeq) return;
    searchCache.set(key, r);
    if (searchCache.size > 100) searchCache.delete(searchCache.keys().next().value);
    if ($('searchInput').value.trim() === q) showResults(r, q);
  } catch (e) {
    if (e.name !== 'AbortError' && seq === searchSeq) toast(e.message, true);
  } finally {
    if (seq === searchSeq) setBusy(false);
  }
}

function showResults(r, q) {
  lastResults = r.results || [];
  const list = $('resultList');
  list.replaceChildren();
  const pls = r.playlists || [];
  $('resultsTitle').textContent = lastResults.length || pls.length ? (r.playlist || t('results')) : t('noResults');
  const all = $('addAll');
  all.hidden = lastResults.length < 2 || !r.playlist;
  all.textContent = t('addAll', { n: r.total || lastResults.length });
  all.dataset.query = q;
  for (const tr of lastResults) {
    const li = el('li', 'item');
    li.append(thumb(tr.thumbnail));
    const tx = el('div', 't');
    tx.append(el('b', '', tr.title), el('span', '', tr.artist || ''));
    tx.title = tr.title;
    const acts = el('div', 'acts');
    acts.append(
      iconBtn('up', t('addNext'), () => addTracks([tr], true)),
      iconBtn('plus', t('add'), () => addTracks([tr])),
    );
    li.append(tx, el('span', 'd', tr.duration ? fmt(tr.duration) : ''), acts);
    li.addEventListener('dblclick', () => addTracks([tr]));
    list.append(li);
  }
  const plList = $('playlistList');
  plList.replaceChildren();
  for (const pl of pls) {
    const li = el('li', 'item pl');
    const tw = el('div', 'thumb-wrap');
    tw.append(thumb(pl.thumbnail));
    li.append(tw);
    const tx = el('div', 't');
    tx.append(el('b', '', pl.title), el('span', '', [pl.count ? t('plCount', { n: pl.count }) : '', pl.artist].filter(Boolean).join(' · ')));
    tx.title = `${pl.title} · ${t('showPlaylist')}`;
    const acts = el('div', 'acts');
    acts.append(iconBtn('plus', t('addPlaylist'), () => addPlaylist(pl.url)));
    li.append(tx, el('span', 'd', ''), acts);
    li.addEventListener('click', () => { $('searchInput').value = pl.url; doSearch(pl.url); });
    plList.append(li);
  }
  $('plHead').hidden = !pls.length;
  plList.hidden = !pls.length;
  $('results').hidden = false;
  $('results').scrollTop = 0;
}

async function addPlaylist(url) {
  toast(t('loadingPlaylist'));
  try {
    const r = await api('/api/queue', { method: 'POST', body: { query: url } });
    toast(t('addedMany', { n: r.added }));
  } catch (e) { toast(e.message, true); }
}

async function addTracks(tracks, next = false) {
  try {
    const r = await api('/api/queue', { method: 'POST', body: { tracks, next } });
    toast(r.added === 1 ? t('added', { t: tracks[0].title }) : t('addedMany', { n: r.added }));
  } catch (e) { toast(e.message, true); }
}

async function addAll() {
  const q = $('addAll').dataset.query || $('searchInput').value.trim();
  try {
    const r = await api('/api/queue', { method: 'POST', body: { query: q } });
    toast(t('addedMany', { n: r.added }));
    $('results').hidden = true;
  } catch (e) { toast(e.message, true); }
}

/* ---------- voice channel ---------- */
let channels = { channels: [], selected: null, mine: null };
async function loadChannels() {
  try { channels = await api('/api/channels'); renderChannels(); } catch { /* keep old list */ }
}
function renderChannels() {
  const sel = $('channelSel');
  if (!sel || document.activeElement === sel) return;
  const cur = state?.channel;
  sel.replaceChildren();
  const auto = el('option', '', t('channelAuto'));
  auto.value = '';
  sel.append(auto);
  let group = null; let groupName;
  const known = new Set();
  for (const c of channels.channels || []) {
    if (c.category !== groupName) {
      groupName = c.category;
      group = groupName ? el('optgroup') : null;
      if (group) { group.label = groupName; sel.append(group); }
    }
    const o = el('option', '', `${c.name}${c.users ? ` (${c.users})` : ''}`);
    o.value = c.id;
    known.add(c.id);
    (group || sel).append(o);
  }
  if (cur && !known.has(cur.id)) { const o = el('option', '', cur.name); o.value = cur.id; sel.append(o); }
  // show where the bot is now; when it is not in a channel, show the saved choice
  sel.value = cur?.id || channels.selected || '';
  sel.title = cur ? `${t('inChannel')}: ${cur.name}` : t('notConnected');
}
async function chooseChannel(id) {
  try {
    const r = await api('/api/settings', { method: 'POST', body: { channelId: id || null, join: !!id } });
    channels.selected = r.settings.channelId;
    render(r.state);
    if (id) {
      const c = (channels.channels || []).find((x) => x.id === id);
      toast(t('channelJoined', { c: c ? c.name : id }));
    } else toast(t('channelAutoSaved'));
  } catch (e) { toast(e.message, true); renderChannels(); }
}

/* ---------- live connection ---------- */
let es = null;
function connect() {
  es?.close();
  es = new EventSource(`${session.api}/api/events?token=${encodeURIComponent(session.token)}`);
  es.addEventListener('state', (e) => { setConn(true); render(JSON.parse(e.data)); });
  es.addEventListener('tick', (e) => {
    const d = JSON.parse(e.data);
    if (state && !seeking) { state.paused = d.paused; tickBase = { pos: d.position, at: performance.now() }; }
  });
  es.onerror = () => {
    setConn(false);
    if (es.readyState === EventSource.CLOSED) setTimeout(probe, 3000);
  };
}
function setConn(on) {
  $('connDot').className = `dot ${on ? 'on' : 'off'}`;
  $('connDot').title = on ? '' : t('reconnecting');
}
async function probe() {
  try {
    await api('/api/state');
    connect();
  } catch (e) {
    if (e.message !== 'expired') showGate('offline');
  }
}

/* ---------- gate (no / bad session) ---------- */
function showGate(kind) {
  es?.close();
  $('app').hidden = true;
  $('server').hidden = true;
  $('userAvatar').hidden = true;
  $('gate').hidden = false;
  $('gateTitle').textContent = t({ none: 'gateNoLink', offline: 'gateOffline', expired: 'gateExpired', nobackend: 'gateNoBackend' }[kind]);
  $('gateText').textContent = t(kind === 'offline' ? 'gateOfflineText' : 'gateNoLinkText');
  $('gateRetry').hidden = kind !== 'offline';
  $('gateRetry').textContent = t('retry');
  setConn(false);
}

async function start() {
  pickSession();
  if (!activeApi) return showGate('nobackend');
  if (!session) return showGate('none');
  try {
    const s = await api('/api/session');
    $('gate').hidden = true;
    $('app').hidden = false;
    $('serverName').textContent = s.guild.name;
    if (s.guild.icon) { $('serverIcon').src = s.guild.icon; $('serverIcon').hidden = false; } else $('serverIcon').hidden = true;
    $('server').hidden = false;
    if (s.user.avatar) { $('userAvatar').src = s.user.avatar; $('userAvatar').hidden = false; }
    $('userAvatar').title = s.user.name;
    sessInfo = { name: s.user.name, exp: s.expires };
    renderSessionInfo();
    render(s.state);
    connect();
    loadChannels();
  } catch (e) {
    if (e.message !== 'expired') showGate('offline');
  }
}

/* ---------- i18n + settings ---------- */
let sessInfo = null;
function renderSessionInfo() {
  if (!sessInfo) return;
  const when = new Date(sessInfo.exp).toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  $('sessionInfo').textContent = `${sessInfo.name} · ${t('validUntil', { t: when })}`;
}
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((n) => { n.title = t(n.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-ph]').forEach((n) => { n.placeholder = t(n.dataset.i18nPh); });
  $('filter').options[0].textContent = t('filterNone');
  document.querySelectorAll('#langSeg button').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
  renderSessionInfo();
  renderBackends();
  if (!$('help').hidden) renderHelp();
  if (state) render(state);
}
const ACCENTS = { blue: '#3b82f6', green: '#22c55e', purple: '#8b5cf6' };
function markSwatches() {
  const a = document.body.dataset.accent;
  document.querySelectorAll('.sw').forEach((b) => b.classList.toggle('active', b.dataset.accent === a));
}
function setAccent(a) {
  if (!ACCENTS[a]) return;
  store.set('accent', a);
  applyAccent(a);
}
function applyAccent(a) {
  if (!ACCENTS[a]) a = 'blue';
  document.body.dataset.accent = a;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', '#0f1115');
  markSwatches();
  const c = { blue: '#3b82f6', green: '#22c55e', purple: '#8b5cf6' }[a];
  document.querySelector('link[rel=icon]').href = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${c}"/><path d="M26 44a6 6 0 1 1-4-5.66V20l22-5v22a6 6 0 1 1-4-5.66V22.2l-14 3.2Z" fill="#fff"/></svg>`)}`;
}
function openDrawer(open) {
  $('drawer').classList.toggle('open', open);
  $('drawer').setAttribute('aria-hidden', String(!open));
  $('drawerBg').hidden = !open;
}

function closeHelpIfOpen() { if (!$('help').hidden) closeHelp(); }

let toastTimer;
function toast(msg, err = false) {
  const n = $('toast');
  n.textContent = msg;
  n.className = `toast${err ? ' err' : ''}`;
  n.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { n.hidden = true; }, 3200);
}

/* ---------- tutorial ---------- */
const README = 'https://github.com/Labtoso/Bots/tree/Msik#readme';
const SW = '<div class="help-swatches"><button class="sw" data-accent="blue" style="--c:#3b82f6"></button><button class="sw" data-accent="green" style="--c:#22c55e"></button><button class="sw" data-accent="purple" style="--c:#8b5cf6"></button></div>';
const CMD = (c) => `<div class="cmd"><code>${c}</code><button class="btn sm copy" type="button" data-copy="${c}"></button></div>`;
const GUIDE = {
  de: [
    ['Discord-Anwendung anlegen', `<ol>
      <li>Öffne das <a href="https://discord.com/developers/applications" target="_blank" rel="noopener">Discord Developer Portal</a> und melde dich mit deinem Discord-Konto an.</li>
      <li>Oben rechts auf <b>New Application</b>, Namen eingeben (z. B. <code>Msik</code>), Bedingungen abhaken, <b>Create</b>.</li>
      <li>Optional: Unter <b>General Information</b> ein Bild hochladen. So sieht der Bot in Discord aus.</li></ol>`],
    ['Token kopieren', `<ol>
      <li>Links auf <b>Bot</b> klicken.</li>
      <li>Bei <b>Token</b> auf <b>Reset Token</b>, bestätigen, dann <b>Copy</b>.</li>
      <li>Der Token ist das Passwort des Bots. Nie weitergeben. Taucht er irgendwo auf, einfach nochmal <b>Reset Token</b>.</li>
      <li>Die <b>Privileged Gateway Intents</b> brauchst du nicht, lass alle drei aus.</li></ol>`],
    ['Installieren', `<p><b>Windows</b> (ohne Admin): PowerShell öffnen (Start → „PowerShell“) und einfügen, oder <a href="../Install.bat">Install.bat</a> laden und doppelklicken.</p>
      ${CMD('irm https://bot.labtoso.de/install.ps1 | iex')}
      <p>Token mit Rechtsklick einfügen. Danach läuft der Bot im Fenster „Msik“ und startet mit Windows.</p>
      <p><b>Linux / VPS</b> per SSH:</p>
      ${CMD('curl -fsSL https://bot.labtoso.de/install.sh | sudo bash')}
      <p>Fragt nach Token und Domain. <b>Mit Domain</b> (A-Record auf die Server-IP, Ports 80/443 offen) gibt es HTTPS und eine feste Adresse. <b>Ohne Domain</b> (Enter) nutzt er einen Tunnel, dessen Adresse sich bei jedem Neustart ändert.</p>`],
    ['Bot einladen', `<ol>
      <li><b>Windows:</b> Der Installer öffnet den Einladungslink selbst.</li>
      <li><b>Linux:</b> Der Link steht am Ende der Installation, sonst <code>journalctl -u msik | grep Einladen</code>.</li>
      <li><b>Von Hand:</b> Im Portal unter <b>OAuth2 → URL Generator</b> die Scopes <code>bot</code> und <code>applications.commands</code>, dazu die Rechte <b>View Channels</b>, <b>Connect</b>, <b>Speak</b>. Link unten kopieren und öffnen.</li>
      <li>Server auswählen und <b>Autorisieren</b>. Dafür brauchst du dort „Server verwalten“.</li></ol>`],
    ['Prüfen, ob er online ist', `<ol>
      <li>In Discord steht der Bot in der Mitgliederliste mit <b>grünem Punkt</b> und „<b>Spielt /web</b>“.</li>
      <li><b>Windows:</b> Im Fenster „Msik“ stehen <code>Eingeloggt als …</code> und <code>/web registriert</code>.</li>
      <li><b>Linux:</b> <code>systemctl status msik</code> zeigt <code>active (running)</code>, live mitlesen mit <code>journalctl -u msik -f</code>.</li></ol>`],
    ['Dashboard öffnen', `<ol>
      <li>Geh in Discord in einen Sprachkanal.</li>
      <li>Tipp <code>/web</code> und wähl den Befehl deines Bots. Beim ersten Mal kann es ein paar Minuten dauern, notfalls Discord mit <b>Strg+R</b> neu laden.</li>
      <li><b>Dashboard öffnen</b> klicken. Der Link gilt 12 Stunden, nur für dich.</li>
      <li>Ein <b>grüner Punkt</b> oben rechts heißt: verbunden. Jetzt oben einen Song suchen und <b>+</b> klicken, der Bot kommt in deinen Kanal.</li></ol>`],
    ['Backend verbinden', `<p><b>Das passiert automatisch.</b> Der Link von <code>/web</code> enthält die Adresse deines Backends und deinen Zugang. Das Dashboard verbindet sich damit von selbst und merkt sich das Backend. Du musst nichts eintragen.</p><ol>
      <li><b>Verbunden?</b> Oben rechts ist ein <b>grüner Punkt</b>, daneben dein Server. Rot heißt: keine Verbindung.</li>
      <li>Unter <b>Zahnrad → Backend</b> steht dein Backend mit grünem Punkt. Mit Klick wechselst du zwischen mehreren (z. B. PC und VPS).</li>
      <li><b>Von Hand hinzufügen</b> brauchst du nur für ein weiteres Backend. Die Adresse ist:
        <br>VPS mit Domain: <code>https://api.deinedomain.de</code>
        <br>Mit Tunnel (PC oder VPS ohne Domain): die <code>https://….trycloudflare.com</code>-Adresse, die der Bot als „Öffentliche API-Adresse“ anzeigt (Fenster „Msik“ bzw. <code>journalctl -u msik | grep API</code>).</li>
      <li>Danach einmal <code>/web</code> von diesem Bot ausführen, denn erst der Link gibt dir Zugriff.</li>
      <li><b>Kein grüner Punkt?</b> Bot offline oder neu gestartet (beim Tunnel ändert sich dann die Adresse). Einfach <code>/web</code> nochmal.</li></ol>`],
    ['Probleme lösen', `<ol>
      <li><b>Bot bleibt offline:</b> Läuft das Fenster bzw. der Dienst? Steht im Log „Token ungültig“, neuen Token holen und den Installer nochmal ausführen.</li>
      <li><b>/web fehlt:</b> Bot mit <code>applications.commands</code> neu einladen, Discord mit Strg+R neu laden.</li>
      <li><b>„Bot nicht erreichbar“:</b> Bot offline oder neu gestartet. Einfach <code>/web</code> nochmal.</li>
      <li><b>Kein Ton:</b> Der Bot braucht im Kanal <b>Verbinden</b> und <b>Sprechen</b>. Lautstärke prüfen.</li>
      <li><b>Domain geht nicht:</b> A-Record und Ports 80/443 prüfen, Fehler zeigt <code>journalctl -u caddy</code>.</li></ol>`],
    ['Updates und Entfernen', `<ol>
      <li><b>VPS / Linux:</b> Der Bot aktualisiert sich selbst. Alle 15 Minuten schaut er nach einer neuen Version, holt sie und startet neu. Läuft gerade Musik, wartet er damit, höchstens 6 Stunden.</li>
      <li>Updates ansehen: <code>journalctl -u msik-update</code>. Sofort prüfen: <code>sudo systemctl start msik-update</code>.</li>
      <li><b>Windows:</b> Zum Updaten den Installer einfach nochmal ausführen, Token und Einstellungen bleiben.</li>
      <li><b>Entfernen:</b> Unter Windows <code>Uninstall.bat</code> im Ordner <code>%LOCALAPPDATA%\\Msik</code> starten. Unter Linux:</li></ol>
      ${CMD('curl -fsSL https://bot.labtoso.de/uninstall.sh | sudo bash')}`],
    ['Musik steuern', `<ol>
      <li>Oben einfach lostippen: Die Treffer erscheinen beim Tippen, ohne Enter. Links (YouTube, Spotify, SoundCloud) einfügen geht genauso.</li>
      <li><b>Playlists:</b> Unter den Treffern stehen passende Playlists. <b>+</b> fügt die ganze Playlist hinzu, ein Klick zeigt erst die Titel. Einen Playlist-Link kannst du auch direkt einfügen.</li>
      <li><b>Sprachkanal:</b> Unten im Player wählst du, wohin der Bot geht. „Automatisch“ heißt: in deinen Kanal. Wählst du einen Kanal, geht er sofort dorthin und merkt ihn sich für den Server.</li>
      <li><b>+</b> hängt den Titel hinten an, der <b>Pfeil nach oben</b> spielt ihn als Nächstes. Bei Playlists gibt es <b>Alle hinzufügen</b>.</li>
      <li>Die Warteschlange sortierst du per Ziehen. Doppelklick spielt sofort.</li>
      <li>Auf dem Fortschrittsbalken spulst du, die <b>Leertaste</b> pausiert. Effekte und Autoplay findest du unter dem Lautstärkeregler.</li></ol>`],
    ['Farbe und Sprache ändern', `<ol>
      <li>Klick oben links aufs <b>Zahnrad</b>.</li>
      <li>Unter <b>Akzentfarbe</b> einen der drei Kreise antippen. Du kannst es auch gleich hier ausprobieren:</li></ol>${SW}
      <p>Die Farbe ändert sofort Logo, Play-Knopf, Regler, Schalter und Fortschritt und bleibt in diesem Browser gespeichert.</p>
      <p>Bei <b>Sprache</b> wechselst du zwischen Deutsch und Englisch.</p>`],
  ],
  en: [
    ['Create a Discord application', `<ol>
      <li>Open the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener">Discord Developer Portal</a> and sign in with your Discord account.</li>
      <li>Click <b>New Application</b> at the top right, enter a name (e.g. <code>Msik</code>), accept the terms, <b>Create</b>.</li>
      <li>Optional: upload a picture under <b>General Information</b>. That is how the bot looks in Discord.</li></ol>`],
    ['Copy the token', `<ol>
      <li>Click <b>Bot</b> on the left.</li>
      <li>Under <b>Token</b> click <b>Reset Token</b>, confirm, then <b>Copy</b>.</li>
      <li>The token is the bot's password. Never share it. If it leaks, just <b>Reset Token</b> again.</li>
      <li>You do not need the <b>Privileged Gateway Intents</b>, leave all three off.</li></ol>`],
    ['Install', `<p><b>Windows</b> (no admin): open PowerShell (Start → "PowerShell") and paste this, or download <a href="../Install.bat">Install.bat</a> and double-click it.</p>
      ${CMD('irm https://bot.labtoso.de/install.ps1 | iex')}
      <p>Paste the token with a right click. The bot then runs in the "Msik" window and starts with Windows.</p>
      <p><b>Linux / VPS</b> over SSH:</p>
      ${CMD('curl -fsSL https://bot.labtoso.de/install.sh | sudo bash')}
      <p>Asks for the token and a domain. <b>With a domain</b> (A record to the server IP, ports 80/443 open) you get HTTPS and a fixed address. <b>Without</b> (Enter) it uses a tunnel whose address changes on every restart.</p>`],
    ['Invite the bot', `<ol>
      <li><b>Windows:</b> the installer opens the invite link for you.</li>
      <li><b>Linux:</b> the link is shown at the end of the install, or <code>journalctl -u msik | grep Einladen</code>.</li>
      <li><b>By hand:</b> in the portal under <b>OAuth2 → URL Generator</b> pick the scopes <code>bot</code> and <code>applications.commands</code> and the permissions <b>View Channels</b>, <b>Connect</b>, <b>Speak</b>. Copy the link at the bottom and open it.</li>
      <li>Pick your server and click <b>Authorize</b>. You need "Manage Server" there.</li></ol>`],
    ['Check that it is online', `<ol>
      <li>In Discord the bot shows in the member list with a <b>green dot</b> and "<b>Playing /web</b>".</li>
      <li><b>Windows:</b> the "Msik" window shows <code>Eingeloggt als …</code> and <code>/web registriert</code>.</li>
      <li><b>Linux:</b> <code>systemctl status msik</code> shows <code>active (running)</code>, follow the log with <code>journalctl -u msik -f</code>.</li></ol>`],
    ['Open the dashboard', `<ol>
      <li>Join a voice channel in Discord.</li>
      <li>Type <code>/web</code> and pick your bot's command. The first time it can take a few minutes, reload Discord with <b>Ctrl+R</b> if needed.</li>
      <li>Click <b>Open dashboard</b>. The link is valid for 12 hours, only for you.</li>
      <li>A <b>green dot</b> at the top right means connected. Search a song at the top and click <b>+</b>, the bot joins your channel.</li></ol>`],
    ['Connect the backend', `<p><b>This happens automatically.</b> The <code>/web</code> link contains your backend's address and your access. The dashboard connects on its own and remembers the backend. You do not need to enter anything.</p><ol>
      <li><b>Connected?</b> There is a <b>green dot</b> at the top right next to your server. Red means no connection.</li>
      <li>Under <b>gear → Backend</b> your backend is listed with a green dot. Click to switch between several (e.g. PC and VPS).</li>
      <li><b>Adding by hand</b> is only needed for another backend. The address is:
        <br>VPS with a domain: <code>https://api.yourdomain.com</code>
        <br>With the tunnel (PC or VPS without a domain): the <code>https://….trycloudflare.com</code> address the bot shows as "Öffentliche API-Adresse" (the "Msik" window or <code>journalctl -u msik | grep API</code>).</li>
      <li>Then run <code>/web</code> from that bot once, because the link is what gives you access.</li>
      <li><b>No green dot?</b> The bot is offline or restarted (with the tunnel the address changes). Just run <code>/web</code> again.</li></ol>`],
    ['Troubleshooting', `<ol>
      <li><b>Bot stays offline:</b> is the window or service running? If the log says "Token ungültig", get a new token and run the installer again.</li>
      <li><b>/web missing:</b> invite the bot again with <code>applications.commands</code>, reload Discord with Ctrl+R.</li>
      <li><b>"Bot unreachable":</b> the bot is offline or restarted. Just run <code>/web</code> again.</li>
      <li><b>No sound:</b> the bot needs <b>Connect</b> and <b>Speak</b> in that channel. Check the volume.</li>
      <li><b>Domain not working:</b> check the A record and ports 80/443, errors are in <code>journalctl -u caddy</code>.</li></ol>`],
    ['Updates and removal', `<ol>
      <li><b>VPS / Linux:</b> the bot updates itself. Every 15 minutes it checks for a new version, pulls it and restarts. If music is playing it waits, at most 6 hours.</li>
      <li>See updates: <code>journalctl -u msik-update</code>. Check right now: <code>sudo systemctl start msik-update</code>.</li>
      <li><b>Windows:</b> to update, just run the installer again. Token and settings are kept.</li>
      <li><b>Remove:</b> on Windows run <code>Uninstall.bat</code> in <code>%LOCALAPPDATA%\\Msik</code>. On Linux:</li></ol>
      ${CMD('curl -fsSL https://bot.labtoso.de/uninstall.sh | sudo bash')}`],
    ['Control the music', `<ol>
      <li>Just start typing at the top: results appear as you type, no Enter needed. Pasting links (YouTube, Spotify, SoundCloud) works the same way.</li>
      <li><b>Playlists:</b> matching playlists appear below the results. <b>+</b> adds the whole playlist, a click shows its tracks first. You can also paste a playlist link.</li>
      <li><b>Voice channel:</b> at the bottom of the player you pick where the bot goes. "Automatic" means your channel. Pick a channel and it moves there at once and remembers it for the server.</li>
      <li><b>+</b> adds it to the end, the <b>up arrow</b> plays it next. Playlists get <b>Add all</b>.</li>
      <li>Drag to reorder the queue. Double-click plays right away.</li>
      <li>Click the progress bar to seek, <b>Space</b> pauses. Effects and autoplay are below the volume slider.</li></ol>`],
    ['Change colour and language', `<ol>
      <li>Click the <b>gear</b> at the top left.</li>
      <li>Under <b>Accent colour</b>, tap one of the three circles. You can try it right here:</li></ol>${SW}
      <p>The colour changes the logo, play button, sliders, switches and progress at once and is saved in this browser.</p>
      <p>Under <b>Language</b> you switch between German and English.</p>`],
  ],
};
let helpIdx = 0;
function renderHelp() {
  const steps = GUIDE[lang];
  const [title, html] = steps[helpIdx];
  $('helpTitle').textContent = title;
  $('helpBody').innerHTML = html;
  $('helpStep').textContent = t('stepOf', { a: helpIdx + 1, b: steps.length });
  $('helpDots').replaceChildren(...steps.map((_, i) => el('span', i === helpIdx ? 'on' : '')));
  $('helpPrev').disabled = helpIdx === 0;
  $('helpNext').textContent = helpIdx === steps.length - 1 ? t('done') : t('nextStep');
  $('helpBody').querySelectorAll('.copy').forEach((b) => {
    b.textContent = t('copy');
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = t('copied'); } catch { /* blocked */ }
      setTimeout(() => { b.textContent = t('copy'); }, 1500);
    });
  });
  $('helpBody').querySelectorAll('.sw').forEach((b) => {
    b.title = b.dataset.accent;
    b.addEventListener('click', () => setAccent(b.dataset.accent));
  });
  markSwatches();
}
function openHelp(step = 0) {
  helpIdx = step;
  openDrawer(false);
  renderHelp();
  $('help').hidden = false; $('helpBg').hidden = false;
  $('helpNext').focus();
}
function closeHelp() { $('help').hidden = true; $('helpBg').hidden = true; store.set('helpSeen', true); }

/* ---------- wire up ---------- */
$('openSettings').innerHTML = svg('gear');
$('closeSettings').innerHTML = svg('x');
$('closeResults').innerHTML = svg('x');
$('btnPrev').innerHTML = svg('prev');
$('btnNext').innerHTML = svg('next');
$('btnShuffle').innerHTML = svg('shuffle');
$('searchIcon').innerHTML = svg('search');
$('coverPh').innerHTML = svg('note');

$('openSettings').onclick = () => { renderBackends(); backends.forEach(checkHealth); openDrawer(true); };
$('closeSettings').onclick = () => openDrawer(false);
$('drawerBg').onclick = () => openDrawer(false);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { openDrawer(false); closeHelpIfOpen(); $('results').hidden = true; }
  const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (e.code === 'Space' && !typing && state?.current) { e.preventDefault(); control('toggle'); }
});
document.querySelectorAll('#langSeg button').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang; store.set('lang', lang); applyLang();
}));
document.querySelectorAll('#swatches .sw').forEach((b) => {
  b.type = 'button';
  b.addEventListener('click', () => setAccent(b.dataset.accent));
});
$('openHelp').innerHTML = svg('help');
$('closeHelp').innerHTML = svg('x');
$('openHelp').onclick = () => openHelp(0);
$('gateHelp').onclick = () => openHelp(0);
$('drawerHelp').onclick = () => openHelp(0);
$('closeHelp').onclick = closeHelp;
$('helpBg').onclick = closeHelp;
$('helpPrev').onclick = () => { if (helpIdx > 0) { helpIdx--; renderHelp(); } };
$('helpNext').onclick = () => { if (helpIdx < GUIDE[lang].length - 1) { helpIdx++; renderHelp(); } else closeHelp(); };
$('logout').onclick = () => {
  const b = backends.find((x) => x.api === activeApi);
  if (b) { delete b.token; saveBackends(); }
  session = null; openDrawer(false); renderBackends(); showGate('none');
};
$('gateBackend').onclick = () => { renderBackends(); backends.forEach(checkHealth); openDrawer(true); };
$('addBackend').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = norm($('backendInput').value);
  if (!/^https:\/\/[^\s/]+/.test(v) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(v)) return toast(t('invalidUrl'), true);
  const b = upsertBackend(v);
  $('backendInput').value = '';
  toast(t('backendAdded'));
  checkHealth(b);
  selectBackend(v);
});
$('gateRetry').onclick = () => start();

$('btnPlay').onclick = () => control('toggle');
$('btnNext').onclick = () => control('skip');
$('btnPrev').onclick = () => control('previous');
$('btnShuffle').onclick = () => control('shuffle');
$('btnLoop').onclick = () => control('loop');
$('btnStop').onclick = () => control('stop');
$('btnLeave').onclick = () => control('leave');
$('btnClear').onclick = () => control('clear');
$('filter').onchange = (e) => control('filter', e.target.value);
$('autoplay').onchange = (e) => control('autoplay', e.target.checked);

let volTimer; let volSent = 0;
$('volume').addEventListener('input', (e) => {
  const v = Number(e.target.value);
  setVolumeUI(v);
  // send while dragging (at most every 70 ms) and once more at the end
  clearTimeout(volTimer);
  const now = performance.now();
  if (now - volSent > 70) { volSent = now; control('volume', v); } else volTimer = setTimeout(() => { volSent = performance.now(); control('volume', v); }, 70);
});
$('btnMute').onclick = () => {
  const v = Number($('volume').value);
  if (v > 0) { lastVol = v; store.set('lastVol', v); control('volume', 0); } else control('volume', lastVol || 60);
};

const seek = $('seek');
seek.addEventListener('input', () => {
  seeking = true;
  const d = state?.current?.duration || 0;
  seek.style.setProperty('--p', `${seek.value}%`);
  $('pos').textContent = fmt((seek.value / 100) * d);
});
seek.addEventListener('change', async () => {
  const d = state?.current?.duration || 0;
  const to = (seek.value / 100) * d;
  tickBase = { pos: to, at: performance.now() };
  await control('seek', to);
  seeking = false;
});

$('searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('searchInput').value.trim();
  if (q) doSearch(q);
});
$('searchInput').addEventListener('input', liveSearch);
$('searchInput').addEventListener('focus', () => { if ($('searchInput').value.trim().length >= 2 && $('resultList').childElementCount) $('results').hidden = false; });
$('channelSel').addEventListener('change', (e) => { chooseChannel(e.target.value); e.target.blur(); });
$('channelSel').addEventListener('pointerdown', loadChannels);
$('channelSel').addEventListener('focus', loadChannels);
$('closeResults').onclick = () => { $('results').hidden = true; };
$('addAll').onclick = addAll;

document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
  tab = b.dataset.tab;
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
  $('queueList').hidden = tab !== 'queue';
  $('historyList').hidden = tab !== 'history';
  $('btnClear').hidden = tab !== 'queue';
  $('qTotal').hidden = tab !== 'queue';
  updateEmpty();
}));

applyAccent(store.get('accent', 'blue'));
applyLang();
loadPresetBackends().then(() => {
  renderBackends();
  start();
  if (location.hash === '#guide') {
    history.replaceState(null, '', location.pathname + location.search);
    openHelp(0);
  } else if (!backends.length && !store.get('helpSeen', false)) openHelp(0);
});
