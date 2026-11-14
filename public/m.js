/* Roll'n'Door – Ricsi oldala (/m/{token}). Az állapot a szerveren él; itt csak memóriában tartunk UI-jelzőket. */
(function () {
  'use strict';

  var TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
  var token = decodeURIComponent((location.pathname.replace(/\/+$/, '').split('/').pop()) || '');
  var data = null;
  var ui = { amountShown: false, amount: '', date: null, confirm: null, err: '', info: '', uploadErr: '', dateErr: '' };
  var busy = false;
  var MAX_ATT = 3;
  var MAX_ATT_BYTES = 8 * 1024 * 1024;

  function $(sel) { return document.querySelector(sel); }

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

  /* ---------- API ---------- */
  var GENERIC = 'Valami nem sikerült. Próbáld újra.';

  async function api(method, path, body) {
    var opts = { method: method, headers: { Accept: 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer' };
    if (body instanceof FormData) { opts.body = body; }
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    try {
      var res = await fetch('/api/m/' + token + path, opts);
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

  /* ---------- Formázás ---------- */
  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) { return null; }
    var names = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
    return m[1] + '. ' + names[parseInt(m[2], 10) - 1] + ' ' + parseInt(m[3], 10) + '.';
  }

  function parseTime(s) {
    if (!s) { return null; }
    var str = String(s);
    if (/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(:\d\d)?$/.test(str)) { str = str.replace(' ', 'T') + 'Z'; }
    var d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatTime(s) {
    var d = parseTime(s);
    if (!d) { return ''; }
    try {
      return d.toLocaleString('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return d.toLocaleString('hu-HU'); }
  }

  function telHref(t) { return 'tel:' + String(t || '').replace(/[^\d+]/g, ''); }

  function sinceText(days) {
    var n = Number(days);
    if (!isFinite(n) || n <= 0) { return 'Ma lépett ide'; }
    return n + ' napja áll itt';
  }

  /* ---------- Segédek ---------- */
  function stageObj(n) {
    var list = (data && data.allomasok) || [];
    for (var i = 0; i < list.length; i++) { if (list[i].n === n) { return list[i]; } }
    return null;
  }

  function planFiles() { return (data.fotok || []).filter(function (f) { return f.tipus === 'latvanyterv'; }); }

  function showInvalid() {
    var app = $('#p-app');
    app.textContent = '';
    app.appendChild(h('h1', { class: 'p-headline', text: 'Ez a link nem érvényes.' }));
    $('#p-content').hidden = true;
  }

  function showTemporaryError(msg) {
    var app = $('#p-app');
    app.textContent = '';
    app.appendChild(h('h1', { class: 'p-headline', text: 'Most nem sikerült betölteni.' }));
    app.appendChild(h('p', { class: 'p-err', role: 'alert', text: msg }));
    var b = h('button', { type: 'button', class: 'p-btn btn-primary', text: 'Újra' });
    b.addEventListener('click', function () { load(false); });
    app.appendChild(b);
    $('#p-content').hidden = true;
  }

  /* ---------- Felső rész ---------- */
  function renderTop() {
    $('#p-name').textContent = data.nev;
    document.title = data.nev + ' \u2013 megrendelés';
    var badges = $('#p-badges');
    badges.textContent = '';
    if (data.leiratkozott) { badges.appendChild(h('span', { class: 'p-badge p-badge--warn', text: 'Nem kér több levelet' })); }
    if (data.statusz === 'lezarva') { badges.appendChild(h('span', { class: 'p-badge', text: 'Lezárva' })); }
    if (data.statusz === 'nem_erdeklodik') { badges.appendChild(h('span', { class: 'p-badge p-badge--warn', text: 'Nem érdeklődik' })); }
    badges.hidden = !badges.childNodes.length;

    var c = $('#p-contact');
    c.textContent = '';
    if (data.telefon) { c.appendChild(h('a', { class: 'p-btn btn-primary', href: telHref(data.telefon), text: 'Hívás' })); }
    if (data.email) { c.appendChild(h('a', { class: 'p-btn p-btn--ghost', href: 'mailto:' + data.email, text: 'E-mail' })); }
    c.hidden = !c.childNodes.length;
    $('#p-phone').textContent = data.telefon || '';

    var st = stageObj(data.allomas);
    var stageEl = $('#p-stage-name');
    stageEl.textContent = data.allomas + '. ' + (st ? st.nev : '');
    stageEl.setAttribute('tabindex', '-1');
    $('#p-since').textContent = sinceText(data.napja_ebben_az_allomasban);
  }

  /* ---------- Műveleti rész ---------- */
  function errP(text) { return h('p', { class: 'p-err', role: 'alert', text: text }); }

  function planList(canDelete) {
    var files = planFiles();
    var wrap = h('div', { class: 'p-plans' });
    files.forEach(function (f) {
      var del = null;
      if (canDelete) {
        del = h('button', { type: 'button', class: 'p-x', text: '\u2715', 'aria-label': 'Törlés: ' + f.fajlnev });
        var armed = false;
        var timer = null;
        del.addEventListener('click', function () {
          if (!armed) {
            armed = true;
            del.textContent = 'Törlöm?';
            del.style.width = 'auto';
            del.style.padding = '0 12px';
            timer = setTimeout(function () { armed = false; del.textContent = '\u2715'; del.style.width = ''; del.style.padding = ''; }, 4000);
            return;
          }
          clearTimeout(timer);
          doDelete(del, f.id);
        });
      }
      wrap.appendChild(h('div', { class: 'p-file-row' }, [
        h('a', { href: f.url, target: '_blank', rel: 'noopener', text: f.fajlnev || 'Látványterv' }),
        del
      ]));
    });
    return wrap;
  }

  function renderAction() {
    var box = $('#p-action');
    box.textContent = '';
    var n = data.allomas;
    var st = stageObj(n);
    var inactive = data.statusz !== 'aktiv';

    function reopenBtn() {
      var b = h('button', { type: 'button', class: 'p-btn p-btn--ghost', id: 'p-reopen', text: 'Újranyitás' });
      b.addEventListener('click', function () { doSimple(b, '/ujranyit', 'Újranyitva.'); });
      return b;
    }

    if (inactive) {
      box.appendChild(h('div', { class: 'p-card p-closed', role: 'status', text: data.statusz === 'lezarva' ? 'Ez a megrendelés le van zárva.' : 'Az ügyfél nem érdeklődik tovább.' }));
      box.appendChild(h('div', { class: 'p-actions' }, [reopenBtn()]));
      if (ui.err) { box.appendChild(errP(ui.err)); }
      return;
    }

    var label = n === 6 ? 'Beszerelve' : (st && st.ricsi_gomb) || 'Tovább';
    var needLock = false;
    var hint = '';

    if (n === 4 || n === 5) {
      box.appendChild(h('h2', { class: 'p-sub', text: n === 5 ? 'Feltöltött látványterv' : 'Látványterv' }));
      var plans = planFiles();
      if (plans.length) { box.appendChild(planList(true)); }
      var fileInput = h('input', { id: 'p-plan-file', type: 'file', accept: 'image/*,application/pdf', multiple: true, class: 'p-sr', tabindex: '-1' });
      var pick = h('button', { type: 'button', class: 'p-btn p-btn--ghost', id: 'p-plan-pick', text: plans.length ? 'Újabb látványterv feltöltése' : 'Látványterv feltöltése', style: 'margin-top:12px' });
      pick.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () { doUpload(pick, fileInput); });
      box.appendChild(fileInput);
      box.appendChild(pick);
      if (ui.uploadErr) { box.appendChild(errP(ui.uploadErr)); }
      box.appendChild(h('div', { style: 'height:20px' }));
    }

    if (n === 4 && !planFiles().length) { needLock = true; hint = 'Előbb tölts fel egy látványtervet'; }
    if (n === 5 && !data.latvanyterv_jovahagyva) { needLock = true; hint = 'Az ügyfél még nem hagyta jóvá'; }

    if (n === 6) {
      var saved = formatDate(data.varhato_beszereles);
      var dateBox = h('div', { class: 'p-card' }, [
        h('label', { class: 'p-label', for: 'p-date', text: 'Beszerelés időpontja' }),
        h('input', { id: 'p-date', class: 'p-input p-field', type: 'date', value: ui.date !== null ? ui.date : (data.varhato_beszereles || '') })
      ]);
      dateBox.querySelector('input').addEventListener('input', function (e) { ui.date = e.target.value; });
      var sendDate = h('button', { type: 'button', class: 'p-btn btn-primary', id: 'p-send-date', text: 'Időpont küldése az ügyfélnek' });
      sendDate.addEventListener('click', function () { doDate(sendDate); });
      dateBox.appendChild(sendDate);
      if (saved && !ui.info) { dateBox.appendChild(h('p', { class: 'p-status', role: 'status', text: 'Elmentve: ' + saved })); }
      if (ui.info) { dateBox.appendChild(h('p', { class: 'p-status', id: 'p-date-info', role: 'status', text: ui.info })); }
      if (ui.dateErr) { dateBox.appendChild(errP(ui.dateErr)); }
      box.appendChild(dateBox);
    }

    var primary = h('button', { type: 'button', class: 'p-btn p-btn--big btn-primary', id: 'p-primary', text: label });
    if (n === 2 && ui.amountShown) { primary.textContent = 'Ajánlat elküldése'; }
    if (needLock) { primary.disabled = true; primary.setAttribute('aria-describedby', 'p-hint'); }
    box.appendChild(primary);
    if (needLock) { box.appendChild(h('p', { class: 'p-hint', id: 'p-hint', text: hint })); }

    if (n === 2 && ui.amountShown) {
      var holder = h('div', { class: 'p-input-holder' }, [
        h('label', { for: 'p-amount', class: 'p-label', text: 'Az ajánlat összege (Ft)' }),
        h('input', { id: 'p-amount', class: 'p-input', type: 'text', inputmode: 'numeric', placeholder: 'Pl. 480000', autocomplete: 'off', value: ui.amount })
      ]);
      holder.querySelector('input').addEventListener('input', function (e) { ui.amount = e.target.value; });
      holder.querySelector('input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); primary.click(); } });
      box.appendChild(holder);
    }

    if (ui.err) { box.appendChild(errP(ui.err)); }

    var next = stageObj(n + 1);
    if (next && next.level) { box.appendChild(h('p', { class: 'p-mailnote', text: 'Az ügyfél erről levelet kap: ' + next.level })); }

    primary.addEventListener('click', function () { doPrimary(primary); });

    // Másodlagos sor
    var back = h('button', { type: 'button', class: 'p-btn p-btn--ghost', id: 'p-back', text: 'Visszalépés' });
    if (n <= 1) { back.disabled = true; }
    back.addEventListener('click', function () { ui.confirm = 'back'; renderAction(); var y = $('#p-confirm-yes'); if (y) { y.focus(); } });
    var lost = h('button', { type: 'button', class: 'p-btn p-btn--danger', id: 'p-lost', text: 'Nem érdeklődik' });
    lost.addEventListener('click', function () { ui.confirm = 'lost'; renderAction(); var y = $('#p-confirm-yes'); if (y) { y.focus(); } });
    box.appendChild(h('div', { class: 'p-secondary' }, [back, lost]));

    if (ui.confirm) {
      var isBack = ui.confirm === 'back';
      var prev = stageObj(n - 1);
      var conf = h('div', { class: 'p-confirm', role: 'group', 'aria-labelledby': 'p-confirm-q' }, [
        h('p', { id: 'p-confirm-q', text: isBack ? 'Biztosan visszalépsz ide: ' + (prev ? prev.nev : '') + '?' : 'Biztosan jelölöd: nem érdeklődik?' })
      ]);
      var yes = h('button', { type: 'button', class: 'p-btn btn-primary', id: 'p-confirm-yes', text: isBack ? 'Igen, visszalépek' : 'Igen, nem érdeklődik' });
      var no = h('button', { type: 'button', class: 'p-btn p-btn--ghost', text: 'Mégsem' });
      yes.addEventListener('click', function () {
        if (isBack) { doSimple(yes, '/vissza', 'Visszaléptél.'); }
        else { doSimple(yes, '/nem-erdeklodik', 'Megjelölve: nem érdeklődik.'); }
      });
      no.addEventListener('click', function () { ui.confirm = null; renderAction(); var b = $(isBack ? '#p-back' : '#p-lost'); if (b) { b.focus(); } });
      conf.appendChild(h('div', { class: 'p-actions' }, [yes, no]));
      box.appendChild(conf);
    }
  }

  /* ---------- Blokkok ---------- */
  function renderOrder() {
    var dl = $('#p-order');
    dl.textContent = '';
    var list = data.rendeles || [];
    if (!list.length) { dl.appendChild(h('dd', { class: 'p-muted', text: 'Még nincs rögzített adat.' })); }
    list.forEach(function (r) { dl.appendChild(h('dt', { text: r.cimke })); dl.appendChild(h('dd', { text: r.ertek })); });
    var t = $('#p-thumbs');
    t.textContent = '';
    var others = [];
    (data.fotok || []).forEach(function (f) {
      if (f.tipus === 'latvanyterv') { return; }
      if ((f.tipus === 'nyilas' || f.tipus === 'kesz') && /^image\//.test(f.mime || '')) {
        t.appendChild(h('a', { href: f.url, target: '_blank', rel: 'noopener' }, [h('img', { src: f.url, loading: 'lazy', alt: (f.tipus === 'kesz' ? 'Elkészült ajtó: ' : 'Fotó a helyszínről: ') + (f.fajlnev || '') })]));
      } else { others.push(f); }
    });
    t.hidden = !t.childNodes.length;
    var extra = $('#p-extra-files');
    if (extra) { extra.remove(); }
    if (others.length) {
      var ul = h('ul', { class: 'p-chosen', id: 'p-extra-files' });
      others.forEach(function (f) { ul.appendChild(h('li', {}, [h('a', { class: 'p-link', href: f.url, target: '_blank', rel: 'noopener', text: f.fajlnev || 'Fájl' })])); });
      t.parentNode.appendChild(ul);
    }
  }

  var KIND = {
    be: { label: '\u2193 Az ügyfél írta', cls: '' },
    ki: { label: '\u2191 Elküldve az ügyfélnek', cls: ' p-msg--out' },
    megjegyzes: { label: '\u270E Megjegyzés (csak te látod)', cls: ' p-msg--note' },
    rendszer: { label: '\u2699 Automatikus levél', cls: ' p-msg--sys' }
  };

  function renderMail() {
    var ul = $('#p-mail-list');
    ul.textContent = '';
    var list = data.uzenetek || [];
    if (!list.length) { ul.appendChild(h('li', { class: 'p-note p-muted', text: 'Még nincs levelezés.' })); }
    list.forEach(function (m) {
      var k = KIND[m.irany] || KIND.rendszer;
      ul.appendChild(h('li', { class: 'p-msg' + k.cls }, [
        h('div', { class: 'p-msg-meta', text: k.label + (m.ido ? ' \u00b7 ' + formatTime(m.ido) : '') }),
        m.targy ? h('div', { class: 'p-msg-subj', text: m.targy }) : null,
        h('div', { class: 'p-msg-body', text: m.szoveg })
      ]));
    });
    var nl = $('#p-note-list');
    nl.textContent = '';
    var notes = list.filter(function (m) { return m.irany === 'megjegyzes'; });
    if (!notes.length) { nl.appendChild(h('li', { class: 'p-note p-muted', text: 'Még nincs jegyzet.' })); }
    notes.forEach(function (m) {
      nl.appendChild(h('li', { class: 'p-note' }, [h('div', { class: 'p-msg-meta', text: formatTime(m.ido) }), h('div', { class: 'p-msg-body', text: m.szoveg })]));
    });
  }

  function renderAll() {
    $('#p-app').textContent = '';
    $('#p-content').hidden = false;
    renderTop();
    renderAction();
    renderOrder();
    renderMail();
  }

  /* ---------- Betöltés és műveletek ---------- */
  async function load(focusStage) {
    var r = await api('GET', '');
    if (r.status === 404) { return showInvalid(); }
    if (!r.ok) { return showTemporaryError(r.hiba); }
    data = r;
    renderAll();
    if (focusStage) { $('#p-stage-name').focus(); }
  }

  async function run(btn, fn) {
    if (busy) { return; }
    busy = true;
    ui.err = '';
    var label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    try { await fn(); }
    finally {
      busy = false;
      if (btn && document.body.contains(btn)) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
    }
  }

  function failHere(r) {
    if (r.status === 404) { return showInvalid(); }
    ui.err = r.hiba;
    renderAction();
    var e = document.querySelector('#p-action > .p-err');
    if (e) { e.scrollIntoView({ block: 'nearest' }); }
  }

  function resetUi() { ui.amountShown = false; ui.amount = ''; ui.date = null; ui.confirm = null; ui.err = ''; ui.info = ''; ui.uploadErr = ''; ui.dateErr = ''; }

  function doPrimary(btn) {
    var n = data.allomas;
    var body = {};
    if (n === 2) {
      if (!ui.amountShown) {
        ui.amountShown = true;
        renderAction();
        $('#p-amount').focus();
        return;
      }
      var digits = String(ui.amount).replace(/[\s.]/g, '');
      if (!/^\d+$/.test(digits) || Number(digits) <= 0) { ui.err = 'Írd be az összeget számokkal, pl. 480000.'; renderAction(); $('#p-amount').focus(); return; }
      body.osszeg = parseInt(digits, 10);
    }
    return run(btn, async function () {
      var r = await api('POST', '/tovabb', body);
      if (!r.ok) { return failHere(r); }
      resetUi();
      await load(true);
    });
  }

  function doSimple(btn, path, doneText) {
    return run(btn, async function () {
      var r = await api('POST', path, {});
      if (!r.ok) { ui.confirm = null; return failHere(r); }
      resetUi();
      await load(true);
    });
  }

  function doDate(btn) {
    var v = $('#p-date').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { ui.dateErr = 'Válassz egy dátumot.'; renderAction(); $('#p-date').focus(); return; }
    return run(btn, async function () {
      ui.dateErr = '';
      ui.info = '';
      var r = await api('POST', '/idopont', { datum: v });
      if (!r.ok) { ui.dateErr = r.hiba; renderAction(); return; }
      ui.date = null;
      await load(false);
      ui.info = 'Elküldtük az ügyfélnek: ' + formatDate(v);
      renderAction();
      var s = $('#p-date-info');
      if (s) { s.setAttribute('tabindex', '-1'); s.focus(); }
    });
  }

  function doDelete(btn, id) {
    return run(btn, async function () {
      var r = await api('DELETE', '/fajl/' + encodeURIComponent(id));
      if (!r.ok) { ui.uploadErr = r.hiba; renderAction(); return; }
      ui.uploadErr = '';
      await load(false);
    });
  }

  function doUpload(btn, input) {
    var files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if (!files.length) { return; }
    return run(btn, async function () {
      ui.uploadErr = '';
      btn.textContent = 'Feltöltés…';
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!/^image\//.test(f.type) && f.type !== 'application/pdf') { ui.uploadErr = 'Csak kép vagy PDF tölthető fel: ' + f.name; break; }
        if (typeof shrinkPhoto === 'function' && /^image\//.test(f.type)) { f = await shrinkPhoto(f); }
        if (f.size > MAX_ATT_BYTES) { ui.uploadErr = 'Ez a fájl túl nagy (legfeljebb 8 MB): ' + f.name; break; }
        var fd = new FormData();
        fd.append('tipus', 'latvanyterv');
        fd.append('fajl', f, f.name);
        var r = await api('POST', '/feltoltes', fd);
        if (!r.ok) { ui.uploadErr = r.hiba; break; }
      }
      await load(false);
    });
  }

  /* ---------- Űrlapok ---------- */
  function initForms() {
    var files = $('#p-reply-files');
    files.addEventListener('change', function () {
      var list = $('#p-reply-chosen');
      list.textContent = '';
      var err = $('#p-reply-err');
      err.textContent = '';
      var arr = Array.prototype.slice.call(files.files || []);
      if (arr.length > MAX_ATT) { err.textContent = 'Legfeljebb ' + MAX_ATT + ' fájlt csatolhatsz.'; }
      arr.forEach(function (f) { list.appendChild(h('li', { text: f.name + (f.size > MAX_ATT_BYTES ? ' (túl nagy)' : '') })); });
    });

    $('#p-reply-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var ta = $('#p-reply-text');
      var err = $('#p-reply-err');
      var ok = $('#p-reply-ok');
      var send = $('#p-reply-send');
      err.textContent = '';
      ok.textContent = '';
      var v = ta.value.trim();
      if (!v) { err.textContent = 'Írj pár szót a válaszba.'; ta.focus(); return; }
      var arr = Array.prototype.slice.call(files.files || []);
      if (arr.length > MAX_ATT) { err.textContent = 'Legfeljebb ' + MAX_ATT + ' fájlt csatolhatsz.'; return; }
      for (var i = 0; i < arr.length; i++) { if (arr[i].size > MAX_ATT_BYTES) { err.textContent = 'Ez a fájl túl nagy (legfeljebb 8 MB): ' + arr[i].name; return; } }
      if (busy) { return; }
      busy = true;
      send.disabled = true;
      send.setAttribute('aria-busy', 'true');
      var fd = new FormData();
      fd.append('szoveg', v);
      var subj = $('#p-reply-subj').value.trim();
      if (subj) { fd.append('targy', subj); }
      arr.forEach(function (f) { fd.append('csatolmanyok', f, f.name); });
      var r = await api('POST', '/valasz', fd);
      busy = false;
      send.disabled = false;
      send.removeAttribute('aria-busy');
      if (!r.ok) { err.textContent = r.hiba; return; }
      ta.value = '';
      $('#p-reply-subj').value = '';
      files.value = '';
      $('#p-reply-chosen').textContent = '';
      ok.textContent = 'Elküldve az ügyfélnek.';
      await load(false);
    });

    $('#p-note-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var ta = $('#p-note-text');
      var err = $('#p-note-err');
      var send = $('#p-note-send');
      err.textContent = '';
      var v = ta.value.trim();
      if (!v) { err.textContent = 'Írj valamit a megjegyzésbe.'; ta.focus(); return; }
      if (busy) { return; }
      busy = true;
      send.disabled = true;
      send.setAttribute('aria-busy', 'true');
      var r = await api('POST', '/megjegyzes', { szoveg: v });
      busy = false;
      send.disabled = false;
      send.removeAttribute('aria-busy');
      if (!r.ok) { err.textContent = r.hiba; return; }
      ta.value = '';
      await load(false);
    });
  }

  function start() {
    if (!TOKEN_RE.test(token)) { return showInvalid(); }
    initForms();
    load(false);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }
})();
