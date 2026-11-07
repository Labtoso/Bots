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
    invalidUrl: 'Ungültige Adresse (https://…)', backendAdded: 'Backend hinzugefügt', gateNoBackend: 'Kein Backend gewählt',
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
    invalidUrl: 'Invalid address (https://…)', backendAdded: 'Backend added', gateNoBackend: 'No backend selected',
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
const control = (action, value) => api('/api/control', { method: 'POST', body: { action, value } })
  .then((s) => { render(s); return s; }).catch((e) => toast(e.message, true));

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
  $('voiceName').textContent = s.channel ? s.channel.name : t('notConnected');
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

/* ---------- search ---------- */
let lastResults = [];
async function doSearch(q) {
  const form = $('searchForm');
  form.classList.add('busy');
  $('searchIcon').innerHTML = svg('load');
  try {
    const r = await api(`/api/search?q=${encodeURIComponent(q)}`);
    lastResults = r.results;
    showResults(r);
  } catch (e) {
    toast(e.message, true);
  } finally {
    form.classList.remove('busy');
    $('searchIcon').innerHTML = svg('search');
  }
}

function showResults(r) {
  const list = $('resultList');
  list.replaceChildren();
  $('resultsTitle').textContent = r.results.length ? (r.playlist || t('results')) : t('noResults');
  const all = $('addAll');
  all.hidden = r.results.length < 2 || !r.playlist;
  all.textContent = t('addAll', { n: r.total || r.results.length });
  for (const tr of r.results) {
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
  $('results').hidden = false;
}

async function addTracks(tracks, next = false) {
  try {
    const r = await api('/api/queue', { method: 'POST', body: { tracks, next } });
    toast(r.added === 1 ? t('added', { t: tracks[0].title }) : t('addedMany', { n: r.added }));
  } catch (e) { toast(e.message, true); }
}

async function addAll() {
  const q = $('searchInput').value.trim();
  try {
    const r = await api('/api/queue', { method: 'POST', body: { query: q } });
    toast(t('addedMany', { n: r.added }));
    $('results').hidden = true;
  } catch (e) { toast(e.message, true); }
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
  if (state) render(state);
}
function applyAccent(a) {
  document.body.dataset.accent = a;
  document.querySelectorAll('.sw').forEach((b) => b.classList.toggle('active', b.dataset.accent === a));
  const c = { blue: '#3b82f6', green: '#22c55e', purple: '#8b5cf6' }[a];
  document.querySelector('link[rel=icon]').href = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${c}"/><path d="M26 44a6 6 0 1 1-4-5.66V20l22-5v22a6 6 0 1 1-4-5.66V22.2l-14 3.2Z" fill="#fff"/></svg>`)}`;
}
function openDrawer(open) {
  $('drawer').classList.toggle('open', open);
  $('drawer').setAttribute('aria-hidden', String(!open));
  $('drawerBg').hidden = !open;
}

let toastTimer;
function toast(msg, err = false) {
  const n = $('toast');
  n.textContent = msg;
  n.className = `toast${err ? ' err' : ''}`;
  n.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { n.hidden = true; }, 3200);
}

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
  if (e.key === 'Escape') { openDrawer(false); $('results').hidden = true; }
  const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (e.code === 'Space' && !typing && state?.current) { e.preventDefault(); control('toggle'); }
});
document.querySelectorAll('#langSeg button').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang; store.set('lang', lang); applyLang();
}));
document.querySelectorAll('.sw').forEach((b) => b.addEventListener('click', () => {
  store.set('accent', b.dataset.accent); applyAccent(b.dataset.accent);
}));
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

let volTimer;
$('volume').addEventListener('input', (e) => {
  const v = Number(e.target.value);
  setVolumeUI(v);
  clearTimeout(volTimer);
  volTimer = setTimeout(() => control('volume', v), 120);
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
loadPresetBackends().then(() => { renderBackends(); start(); });
