/*
 * Panel languages. The panel is written in German; every other language is a file in lang/
 * that maps German text to its translation (lang/en.js). The default is English.
 * Switch in the gear menu, or add a language: copy lang/en.js, translate, add it to index.html.
 */
(function () {
  'use strict';
  const LANGS = window.AIO_LANGS || (window.AIO_LANGS = {});
  LANGS.de = LANGS.de || { name: 'Deutsch', locale: 'de-DE', native: true };
  const DEFAULT = 'en';
  let lang = DEFAULT;
  try { const v = JSON.parse(localStorage.getItem('aio.lang')); if (v && LANGS[v]) lang = v; } catch { /* private mode */ }
  if (!LANGS[lang]) lang = 'de';
  const dict = LANGS[lang].native ? null : LANGS[lang];
  document.documentElement.lang = lang;

  function tr(s) {
    if (!dict || typeof s !== 'string' || !s.trim()) return s;
    const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const core = m[2];
    let t = dict.texts[core];
    if (t === undefined) {
      for (const [re, rep] of dict.rules || []) {
        if (!re.test(core)) continue;
        if (typeof rep !== 'function') { t = core.replace(re, rep); break; }
        let miss = false;
        const out = core.replace(re, (...a) => { const v = rep(...a.slice(1, -2)); if (v === undefined) miss = true; return v ?? ''; });
        if (!miss) { t = out; break; }
      }
    }
    return t === undefined ? s : m[1] + t + m[3];
  }

  // user content and the Discord preview stay as they are
  const SKIP = 'script,style,[data-noi18n],.dc .txt,.dc .embed,.dc .buttons,.dc .who > :not(time),.chip,#serverName,#botName';
  const ATTRS = ['title', 'placeholder', 'aria-label'];
  function attrs(el) {
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a); const t = tr(v);
      if (t !== v) el.setAttribute(a, t);
    }
  }
  function text(n) {
    const t = tr(n.data);
    if (t !== n.data) n.data = t;
  }
  function walk(root) {
    if (root.nodeType === 3) { if (root.parentElement && !root.parentElement.closest(SKIP)) text(root); return; }
    if (root.nodeType !== 1 || root.closest(SKIP)) return;
    attrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let n = w.nextNode();
    while (n) { if (n.nodeType === 3) text(n); else attrs(n); n = w.nextNode(); }
  }

  if (dict) {
    walk(document.documentElement);
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'childList') r.addedNodes.forEach(walk);
        else if (r.type === 'characterData') { if (r.target.parentElement && !r.target.parentElement.closest(SKIP)) text(r.target); }
        else if (r.type === 'attributes' && !r.target.closest(SKIP)) attrs(r.target);
      }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    const c = window.confirm.bind(window); const p = window.prompt.bind(window); const al = window.alert.bind(window);
    window.confirm = (msg) => c(tr(msg));
    window.prompt = (msg, def) => p(tr(msg), def === undefined ? def : tr(def));
    window.alert = (msg) => al(tr(msg));
  }

  window.i18n = {
    lang, tr, locale: LANGS[lang].locale || 'en-GB',
    list: () => Object.entries(LANGS).map(([code, l]) => ({ code, name: l.name })),
    set(code) { try { localStorage.setItem('aio.lang', JSON.stringify(code)); } catch { /* ignore */ } location.reload(); },
  };
}());
