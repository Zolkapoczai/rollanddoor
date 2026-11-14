/* Roll'n'Door – leiratkozás (/le/{token}). Betöltéskor SOHA nem iratkoztat le (a levélszűrők megnyitják a linkeket);
   csak a gomb megnyomására. */
(function () {
  'use strict';

  var TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
  var token = decodeURIComponent((location.pathname.replace(/\/+$/, '').split('/').pop()) || '');
  var app = document.getElementById('p-app');

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) { return; }
        if (k === 'text') { el.textContent = v; }
        else if (k === 'class') { el.className = v; }
        else { el.setAttribute(k, v === true ? '' : v); }
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) { return; }
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  var GENERIC = 'Valami nem sikerült. Próbáld újra, vagy írj nekünk: info@rollndoor.hu.';

  async function call(method) {
    try {
      var res = await fetch('/api/le/' + token, { method: method, headers: { Accept: 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer' });
      var json = null;
      try { json = await res.json(); } catch (_) { json = null; }
      if (!json || typeof json !== 'object') { return { ok: false, status: res.status, hiba: GENERIC }; }
      if (!res.ok && json.ok !== false) { json = { ok: false, hiba: GENERIC }; }
      if (json.ok === false && typeof json.hiba !== 'string') { json.hiba = GENERIC; }
      json.status = res.status;
      return json;
    } catch (_) {
      return { ok: false, status: 0, hiba: 'Nem sikerült a kapcsolat. Próbáld újra egy perc múlva.' };
    }
  }

  function mail() { return h('a', { class: 'p-link', href: 'mailto:info@rollndoor.hu', text: 'info@rollndoor.hu' }); }

  function show(nodes, focusFirst) {
    app.textContent = '';
    nodes.forEach(function (n) { app.appendChild(n); });
    if (focusFirst && nodes[0]) { nodes[0].focus(); }
  }

  function invalid() {
    show([
      h('h1', { class: 'p-headline', tabindex: '-1', text: 'Ez a link nem érvényes.' }),
      h('p', { class: 'p-lead' }, ['Ha elvesztetted a levelet, írj nekünk: ', mail(), '.'])
    ], false);
  }

  function confirmView(nev) {
    var err = h('p', { class: 'p-err', role: 'alert' });
    var btn = h('button', { type: 'button', class: 'p-btn p-btn--big btn-primary', text: 'Igen, nem kérek több levelet' });
    btn.addEventListener('click', async function () {
      if (btn.disabled) { return; }
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      err.textContent = '';
      var r = await call('POST');
      if (r.ok) {
        show([
          h('h1', { class: 'p-headline', tabindex: '-1', role: 'status', text: 'Rendben, több automatikus levelet nem küldünk.' }),
          h('p', { class: 'p-lead' }, ['Ha mégis kérdésed van, írj nekünk: ', mail(), '.'])
        ], true);
      } else {
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
        err.textContent = r.hiba;
      }
    });
    show([
      h('h1', { class: 'p-headline', text: 'Szia, ' + nev + '! Biztosan nem kérsz több automatikus levelet?' }),
      btn,
      err,
      h('p', { style: 'margin-top:16px' }, [h('a', { class: 'p-small-link', href: '/r/' + token, text: 'Mégis kérem' })])
    ], false);
  }

  async function start() {
    if (!TOKEN_RE.test(token)) { return invalid(); }
    var r = await call('GET');
    if (r.status === 404) { return invalid(); }
    if (!r.ok) {
      return show([h('h1', { class: 'p-headline', text: 'Most nem sikerült betölteni.' }), h('p', { class: 'p-err', role: 'alert', text: r.hiba })], false);
    }
    confirmView(r.nev);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }
})();
