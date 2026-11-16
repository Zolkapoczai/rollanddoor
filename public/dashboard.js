/* Roll'n'Door – Ricsi összesítője (/dashboard) és a belépőlink oldala (/dashboard/be/{token}). */
(function () {
  'use strict';

  var app = document.getElementById('p-app');
  var GENERIC = 'Valami nem sikerült. Próbáld újra.';
  var belepoToken = (/^\/dashboard\/be\/([A-Za-z0-9_-]{40,64})\/?$/.exec(location.pathname) || [])[1] || null;

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) { return; }
      if (k === 'text') { el.textContent = v; }
      else if (k === 'class') { el.className = v; }
      else { el.setAttribute(k, v === true ? '' : v); }
    });
    (children || []).forEach(function (c) {
      if (c) { el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    });
    return el;
  }

  function clear() { app.textContent = ''; }

  async function api(method, path, body) {
    var opts = { method: method, headers: { Accept: 'application/json' }, credentials: 'same-origin', referrerPolicy: 'no-referrer' };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    try {
      var res = await fetch('/api/dashboard' + path, opts);
      var j = null;
      try { j = await res.json(); } catch (_) { j = null; }
      if (!j || typeof j !== 'object') { j = { ok: false, hiba: GENERIC }; }
      if (j.ok === false && typeof j.hiba !== 'string') { j.hiba = GENERIC; }
      j.status = res.status;
      return j;
    } catch (_) {
      return { ok: false, status: 0, hiba: 'Nem sikerült a kapcsolat. Próbáld újra egy perc múlva.' };
    }
  }

  function gomb(text, cls, onClick) {
    var b = h('button', { type: 'button', class: 'p-btn ' + cls, text: text });
    b.addEventListener('click', async function () {
      if (b.disabled) { return; }
      b.disabled = true;
      b.setAttribute('aria-busy', 'true');
      try { await onClick(); } finally { b.disabled = false; b.removeAttribute('aria-busy'); }
    });
    return b;
  }

  /* ---------- Belépés ---------- */
  function belepesKeres(uzenet) {
    clear();
    var err = h('p', { class: 'p-err', role: 'alert', text: uzenet || '' });
    var ok = h('p', { class: 'p-status', role: 'status' });
    app.appendChild(h('h1', { class: 'p-headline', text: 'Belépés' }));
    app.appendChild(h('p', { class: 'p-lead', text: 'A belépőlinket e-mailben küldjük a megszokott címedre. 15 percig érvényes.' }));
    app.appendChild(err);
    app.appendChild(ok);
    app.appendChild(h('div', { class: 'p-actions' }, [
      gomb('Belépőlink kérése', 'btn-primary p-btn--big', async function () {
        err.textContent = ''; ok.textContent = '';
        var r = await api('POST', '/link');
        if (r.ok) { ok.textContent = 'Elküldtük. Nézd meg a leveleidet, és nyomd meg benne a „Belépés” gombot.'; }
        else { err.textContent = r.hiba; }
      }),
    ]));
  }

  function belepoOldal() {
    clear();
    var err = h('p', { class: 'p-err', role: 'alert' });
    app.appendChild(h('h1', { class: 'p-headline', text: 'Belépés' }));
    app.appendChild(h('p', { class: 'p-lead', text: 'Nyomd meg a gombot a belépéshez. Ezen a készüléken bejelentkezve maradsz 60 napig.' }));
    app.appendChild(err);
    app.appendChild(h('div', { class: 'p-actions' }, [
      gomb('Belépés', 'btn-primary p-btn--big', async function () {
        err.textContent = '';
        var r = await api('POST', '/be', { token: belepoToken });
        if (r.ok) { history.replaceState(null, '', '/dashboard'); belepoToken = null; await betolt(); return; }
        if (r.status === 401) { history.replaceState(null, '', '/dashboard'); belepoToken = null; belepesKeres(r.hiba); return; }
        err.textContent = r.hiba;
      }),
    ]));
  }

  /* ---------- Lista ---------- */
  function napSzoveg(n) { return n > 0 ? n + ' napja áll itt' : 'Ma került ide'; }

  function kartya(e) {
    var meta = e.allomas + '. ' + e.allomas_nev + ' · ' + napSzoveg(e.napja);
    var badges = [];
    if (e.leiratkozott) { badges.push(h('span', { class: 'p-badge p-badge--warn', text: 'Nem kér levelet' })); }
    return h('li', { class: 'p-item' }, [
      h('a', { class: 'p-item-link', href: e.link, rel: 'noreferrer' }, [
        h('span', { class: 'p-item-name', text: '#' + e.id + ' ' + e.nev }),
        h('span', { class: 'p-item-todo', text: e.teendo }),
        h('span', { class: 'p-item-meta', text: meta }),
      ]),
      badges.length ? h('div', { class: 'p-badges p-item-badges' }, badges) : null,
      (e.telefon || e.email) ? h('div', { class: 'p-item-contact' }, [
        e.telefon ? h('a', { class: 'p-contact-btn', href: 'tel:' + String(e.telefon).replace(/[^\d+]/g, ''), text: '📞 ' + e.telefon }) : null,
        e.email ? h('a', { class: 'p-contact-btn', href: 'mailto:' + e.email, text: '✉ ' + e.email }) : null,
      ]) : null,
    ]);
  }

  /* ---------- Csempék: 4 nagy gomb, mögöttük az ügyek (#kulcs a címben, a Vissza gomb is működik) ---------- */
  var adat = null;
  var URES = { ram_var: 'Most nincs teendőd.', lezart: 'Nincs lezárt megrendelés.' };

  function csempek(d) {
    return d.csoportok.concat([{ kulcs: 'lezart', cim: 'Lezárt', elemek: d.lezartak || [] }]);
  }

  function csempe(c) {
    var n = c.elemek.length;
    var cls = 'p-tile p-tile--' + c.kulcs + (n ? '' : ' p-tile--empty');
    return h('a', { class: cls, href: '#' + c.kulcs, 'aria-label': c.cim + ': ' + n + ' megrendelés' }, [
      h('span', { class: 'p-tile-num', text: String(n) }),
      h('span', { class: 'p-tile-title', text: c.cim }),
    ]);
  }

  function csoportNezet(c) {
    clear();
    var vissza = h('a', { class: 'p-btn p-btn--ghost p-back', href: '#', text: '← Vissza' });
    app.appendChild(vissza);
    app.appendChild(h('h1', { class: 'p-headline', tabindex: '-1', text: c.cim + ' (' + c.elemek.length + ')' }));
    if (!c.elemek.length) {
      app.appendChild(h('p', { class: 'p-muted', text: URES[c.kulcs] || 'Nincs ilyen megrendelés.' }));
    } else {
      app.appendChild(h('ul', { class: 'p-list' }, c.elemek.map(kartya)));
    }
    app.querySelector('.p-headline').focus();
  }

  function rajzol() {
    if (!adat) { return; }
    var kulcs = location.hash.slice(1);
    var c = csempek(adat).filter(function (x) { return x.kulcs === kulcs; })[0];
    if (c) { csoportNezet(c); } else { lista(adat); }
  }

  window.addEventListener('hashchange', rajzol);

  function lista(d) {
    clear();
    var osszes = d.csoportok.reduce(function (s, c) { return s + c.elemek.length; }, 0);
    app.appendChild(h('h1', { class: 'p-headline', text: osszes ? osszes + ' futó megrendelés' : 'Nincs futó megrendelés' }));
    app.appendChild(h('div', { class: 'p-tiles' }, csempek(d).map(csempe)));

    app.appendChild(h('div', { class: 'p-secondary' }, [
      gomb('Frissítés', 'p-btn--ghost', betolt),
      d.nyitott ? null : gomb('Kilépés', 'p-btn--ghost', async function () {
        await api('POST', '/ki');
        belepesKeres('Kiléptél.');
      }),
    ]));
  }

  async function betolt() {
    var r = await api('GET', '');
    if (r.ok) { adat = r; rajzol(); return; }
    if (r.status === 401) { belepesKeres(); return; }
    clear();
    app.appendChild(h('h1', { class: 'p-headline', text: 'Most nem sikerült betölteni.' }));
    app.appendChild(h('p', { class: 'p-err', role: 'alert', text: r.hiba }));
    app.appendChild(gomb('Újra', 'btn-primary', betolt));
  }

  if (belepoToken) { belepoOldal(); } else { betolt(); }
})();
