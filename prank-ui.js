/* Prank tab, used by the Msik dashboard and the AIO panel. The server only answers the one account it is meant for. */
(function () {
  const css = `
.pk { display: grid; gap: 16px; }
.pk-card { background: var(--panel, #161920); border: 1px solid var(--line, #252a35); border-radius: 12px; padding: 16px; }
.pk-card h3 { margin: 0 0 4px; font-size: 15px; }
.pk-hint { color: var(--muted, #8a92a5); font-size: 12.5px; margin: 0 0 10px; }
.pk-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pk-sp { flex: 1; }
.pk-who { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.pk-person { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; border-radius: 999px; border: 1px solid var(--line, #252a35); background: transparent; color: inherit; font: inherit; font-size: 13px; cursor: pointer; }
.pk-person img, .pk-person .pk-ph { width: 22px; height: 22px; border-radius: 50%; background: var(--line, #252a35); flex: none; }
.pk-person small { color: var(--muted, #8a92a5); }
.pk-person.on { border-color: var(--accent, #7c5cff); background: color-mix(in srgb, var(--accent, #7c5cff) 16%, transparent); }
.pk input, .pk select { background: var(--bg, #0f1115); color: inherit; border: 1px solid var(--line, #252a35); border-radius: 7px; padding: 6px 9px; font: inherit; font-size: 13px; min-width: 0; }
.pk-btn { border: 1px solid var(--line, #252a35); background: var(--panel-2, #1c2029); color: inherit; border-radius: 7px; padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer; }
.pk-btn:hover { filter: brightness(1.15); }
.pk-btn.go { background: var(--accent, #7c5cff); border-color: transparent; color: #fff; }
.pk-btn.stop { color: #fca5a5; border-color: rgba(239, 68, 68, .4); }
.pk-btn.red { background: #ef4444; border-color: transparent; color: #fff; }
.pk-btn:disabled { opacity: .45; cursor: not-allowed; filter: none; }
.pk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.pk-item { border: 1px solid var(--line, #252a35); border-radius: 10px; padding: 12px; display: grid; gap: 8px; align-content: start; }
.pk-item b { font-size: 14px; }
.pk-item p { margin: 0; color: var(--muted, #8a92a5); font-size: 12.5px; }
.pk-item label { display: grid; gap: 3px; font-size: 12px; color: var(--muted, #8a92a5); }
.pk-off { color: #fbbf24 !important; }
.pk-group { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted, #8a92a5); margin: 6px 0 -4px; font-weight: 600; }
.pk-act { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--line, #252a35); }
.pk-act:last-child { border-bottom: 0; }
.pk-act img { width: 26px; height: 26px; border-radius: 50%; background: var(--line, #252a35); }
.pk-err { color: #fca5a5; font-size: 12px; }
.pk-badge { font-size: 11px; padding: 1px 8px; border-radius: 999px; background: rgba(239, 68, 68, .12); color: #fca5a5; border: 1px solid rgba(239, 68, 68, .35); }
`;
  function el(tag, attrs, ...kids) {
    const [t, ...cls] = tag.split('.');
    const e = document.createElement(t || 'div');
    if (cls.length) e.className = cls.join(' ');
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
    return e;
  }
  const left = (t) => {
    if (!t) return 'bis du stoppst';
    const m = Math.max(0, Math.round((t - Date.now()) / 60000));
    return m >= 60 ? `noch ${Math.floor(m / 60)} h ${m % 60} min` : `noch ${m} min`;
  };

  /**
   * mount(root, { api, toast }) - api(path, { method, body }) returns parsed JSON or throws an Error with the message.
   * Returns a function that stops the auto refresh.
   */
  function mount(root, { api, toast = () => {} }) {
    if (!document.getElementById('pk-css')) document.head.append(el('style', { id: 'pk-css' }, css));
    let data = null; let target = null; let people = []; let timer = null; let dead = false;
    const wrap = el('div.pk');
    root.append(wrap);

    const whoBox = el('div.pk-who');
    const search = el('input', { type: 'search', placeholder: 'Mitglied suchen (Name oder ID) …', style: 'flex:1;max-width:320px' });
    const picked = el('span.pk-hint', { style: 'margin:0' });
    const activeBox = el('div');
    const catBox = el('div', { style: 'display:grid;gap:12px' });
    const stopAll = el('button.pk-btn.red', { type: 'button', onclick: async () => {
      try { const r = await api('/api/prank/stop', { method: 'POST', body: { all: true } }); data.active = r.active; drawActive(); toast('Alle Pranks gestoppt'); } catch (e) { toast(e.message, true); }
    } }, '⏹ Alles stoppen');

    wrap.append(
      el('div.pk-card', el('h3', '1. Wen pranken?'), el('p.pk-hint', 'Ohne Suche siehst du alle, die gerade in einem Sprachkanal sind.'),
        el('div.pk-row', search, picked), whoBox),
      el('div.pk-card', el('div.pk-row', el('h3', 'Läuft gerade'), el('span.pk-sp'), stopAll), activeBox),
      el('div.pk-card', el('h3', '2. Prank wählen'), el('p.pk-hint', 'Alles lässt sich jederzeit stoppen und endet sonst nach der gewählten Zeit von selbst. Spitznamen, Stummschaltung und Rollen werden danach zurückgesetzt.'), catBox),
    );

    function drawPeople() {
      whoBox.replaceChildren(...(people.length ? people.map((m) => el(`button.pk-person${target?.id === m.id ? '.on' : ''}`, { type: 'button', onclick: () => { target = m; drawPeople(); drawCatalog(); } },
        m.avatar ? el('img', { src: m.avatar, alt: '' }) : el('span.pk-ph'), m.name, m.voice ? el('small', `🔊 ${m.voice}`) : null)) : [el('span.pk-hint', { style: 'margin:0' }, search.value ? 'Niemand gefunden.' : 'Gerade ist niemand in einem Sprachkanal. Such nach einem Namen.')]));
      picked.textContent = target ? `Ausgewählt: ${target.name}` : 'Noch niemand ausgewählt';
    }
    let st = null;
    async function loadPeople() {
      try { people = await api(`/api/prank/members?q=${encodeURIComponent(search.value.trim())}`); } catch { people = []; }
      if (target && !people.some((p) => p.id === target.id)) people.unshift(target);
      drawPeople();
      if (data) drawCatalog();
    }
    search.addEventListener('input', () => { clearTimeout(st); st = setTimeout(loadPeople, 300); });

    function drawActive() {
      const list = data?.active || [];
      stopAll.disabled = !list.length;
      activeBox.replaceChildren(...(list.length ? list.map((a) => el('div.pk-act',
        a.target ? (a.targetAvatar ? el('img', { src: a.targetAvatar, alt: '' }) : el('span.pk-ph', { style: 'width:26px;height:26px;border-radius:50%;background:var(--line)' })) : null,
        el('div', { style: 'flex:1;min-width:0' }, el('b', a.name), a.target ? ` → ${a.targetName}` : '', el('div.pk-hint', { style: 'margin:0' }, left(a.until)), a.error ? el('div.pk-err', `Fehler: ${a.error}`) : null),
        el('button.pk-btn.stop', { type: 'button', onclick: async () => {
          try { const r = await api('/api/prank/stop', { method: 'POST', body: { id: a.id } }); data.active = r.active; drawActive(); toast(`${a.name} gestoppt`); } catch (e) { toast(e.message, true); }
        } }, 'Stoppen'))) : [el('p.pk-hint', { style: 'margin:0' }, 'Nichts aktiv.')]));
    }

    function control(d, values) {
      let c;
      if (d.type === 'select') c = el('select', null, d.options.map(([v, l]) => el('option', { value: String(v) }, l)));
      else if (d.type === 'voice' || d.type === 'text-channel') {
        const list = d.type === 'voice' ? data.channels.voice : data.channels.text;
        c = el('select', null, el('option', { value: '' }, d.required ? 'Kanal wählen …' : '(automatisch)'), list.map((x) => el('option', { value: x.id }, `${d.type === 'voice' ? '🔊 ' : '#'}${x.name}`)));
      } else if (d.type === 'member') {
        c = el('select', null, el('option', { value: '' }, 'Person wählen …'), people.filter((m) => m.id !== target?.id).map((m) => el('option', { value: m.id }, `${m.name}${m.voice ? ` (🔊 ${m.voice})` : ''}`)));
      } else c = el('input', { type: 'text', maxlength: 100, placeholder: d.def || '' });
      c.value = d.def !== undefined && d.def !== null ? String(d.def) : '';
      values[d.key] = () => c.value;
      return el('label', d.label, c);
    }

    function drawCatalog() {
      const groups = [];
      for (const p of data.catalog) {
        let g = groups.find((x) => x.name === p.group);
        if (!g) groups.push(g = { name: p.group, items: [] });
        g.items.push(p);
      }
      catBox.replaceChildren(...groups.flatMap((g) => [el('div.pk-group', g.name), el('div.pk-grid', g.items.map((p) => {
        const values = {};
        const dur = el('select', null, data.durations.map(([v, l]) => el('option', { value: String(v) }, l)));
        dur.value = '30';
        const blocked = p.off || (p.missing.length ? `Dem Bot fehlt das Recht: ${p.missing.join(', ')}` : null);
        const needTarget = !p.noTarget;
        const go = el('button.pk-btn.go', { type: 'button', disabled: !!blocked || (needTarget && !target), onclick: async () => {
          const params = Object.fromEntries(Object.entries(values).map(([k, f]) => [k, f()]));
          go.disabled = true;
          try {
            const r = await api('/api/prank/start', { method: 'POST', body: { type: p.id, target: target?.id, params, minutes: Number(dur.value) } });
            toast(r.done ? `${p.name}: erledigt` : `${p.name} läuft${target && needTarget ? ` bei ${target.name}` : ''}`);
            await refresh();
          } catch (e) { toast(e.message, true); }
          go.disabled = false;
        } }, p.once ? 'Ausführen' : 'Starten');
        return el('div.pk-item',
          el('b', p.name), el('p', p.desc),
          blocked ? el('p.pk-off', blocked, p.missing.length && data.invite ? el('span', ' ', el('a', { href: data.invite, target: '_blank', rel: 'noopener' }, 'Bot mit allen Rechten neu einladen')) : null) : null,
          p.params.map((d) => control(d, values)),
          el('div.pk-row', p.once ? null : el('label', { style: 'flex:1' }, 'Dauer', dur), el('span.pk-sp'), go),
          needTarget && !target ? el('p', 'Wähle oben zuerst ein Mitglied.') : null);
      }))]));
    }

    async function refresh(first = false) {
      if (dead) return;
      try {
        const d = await api('/api/prank');
        const changedCatalog = !data;
        data = d;
        drawActive();
        if (changedCatalog || first) drawCatalog();
      } catch (e) { if (first) wrap.replaceChildren(el('p.pk-hint', e.message)); }
    }
    refresh(true).then(loadPeople);
    timer = setInterval(() => { if (!document.hidden) refresh(); }, 5000);
    const obs = new MutationObserver(() => { if (!wrap.isConnected) { dead = true; clearInterval(timer); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => { dead = true; clearInterval(timer); obs.disconnect(); };
  }
  window.PrankUI = { mount };
}());
