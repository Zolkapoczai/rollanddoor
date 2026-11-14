/* Roll'n'Door – ügyfél oldal (/r/{token}). Az állapot a szerveren él; itt csak memóriában tartunk
   néhány UI-jelzőt (megerősítő lépés, piszkozat). Semmi sem kerül localStorage-ba. */
(function () {
  'use strict';

  var TOKEN_RE = /^[A-Za-z0-9_-]{20,100}$/;
  var token = decodeURIComponent((location.pathname.replace(/\/+$/, '').split('/').pop()) || '');
  var data = null;
  var ui = { confirmApprove: false, showChange: false, accepted: false, reviewSent: false, err: '', changeDraft: '', reviewDraft: '', photos: [] };
  var busy = false;

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
  var NET_ERR = 'Nem sikerült a kapcsolat. Próbáld újra egy perc múlva.';

  async function api(method, path, body) {
    var opts = { method: method, headers: { Accept: 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer' };
    if (body instanceof FormData) { opts.body = body; }
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    try {
      var res = await fetch('/api/r/' + token + path, opts);
      var json = null;
      try { json = await res.json(); } catch (_) { json = null; }
      if (json && typeof json === 'object') {
        if (json.ok === false && typeof json.hiba !== 'string') { json.hiba = 'Valami nem sikerült. Próbáld újra, vagy írj nekünk.'; }
        if (!res.ok && json.ok !== false) { json = { ok: false, hiba: 'Valami nem sikerült. Próbáld újra, vagy írj nekünk.' }; }
        json.status = res.status;
        return json;
      }
      return { ok: false, status: res.status, hiba: 'Valami nem sikerült. Próbáld újra, vagy írj nekünk.' };
    } catch (_) {
      return { ok: false, status: 0, hiba: NET_ERR };
    }
  }

  /* ---------- Formázás ---------- */
  function formatFt(v) {
    if (v === null || v === undefined || isNaN(Number(v))) { return null; }
    return String(Math.round(Number(v))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0Ft';
  }

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

  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---------- Nézetek ---------- */
  function showInvalid() {
    $('#p-hello').textContent = '';
    var app = $('#p-app');
    app.textContent = '';
    app.appendChild(h('h1', { class: 'p-headline', tabindex: '-1', id: 'p-invalid', text: 'Ez a link nem érvényes.' }));
    app.appendChild(h('p', { class: 'p-lead' }, ['Ha elvesztetted a levelet, írj nekünk: ', h('a', { class: 'p-link', href: 'mailto:info@rollndoor.hu', text: 'info@rollndoor.hu' }), '.']));
    $('#p-content').hidden = true;
    document.title = 'Érvénytelen link – Roll\'n\'Door';
  }

  function showTemporaryError(msg) {
    var app = $('#p-app');
    app.textContent = '';
    app.appendChild(h('h1', { class: 'p-headline', text: 'Most nem sikerült betölteni.' }));
    app.appendChild(h('p', { class: 'p-err', role: 'alert', text: msg }));
    var b = h('button', { type: 'button', class: 'p-btn btn-primary', text: 'Újra' });
    b.addEventListener('click', function () { load(true); });
    app.appendChild(b);
    $('#p-content').hidden = true;
  }

  function stageObj(n) {
    var list = (data && data.allomasok) || [];
    for (var i = 0; i < list.length; i++) { if (list[i].n === n) { return list[i]; } }
    return null;
  }

  function renderProgress() {
    var st = stageObj(data.allomas);
    var total = (data.allomasok && data.allomasok.length) || 7;
    $('#p-progress-label').textContent = data.allomas + ' / ' + total + ' \u2013 ' + (st ? st.nev : '');
    var dots = $('#p-steps');
    dots.textContent = '';
    (data.allomasok || []).forEach(function (s) {
      var cls = 'p-step' + (s.n < data.allomas ? ' p-step--done' : '') + (s.n === data.allomas ? ' p-step--now' : '');
      var li = h('li', { class: cls }, [h('span', { class: 'p-sr', text: s.n + '. ' + s.nev + (s.n < data.allomas ? ' (kész)' : '') })]);
      if (s.n === data.allomas) { li.setAttribute('aria-current', 'step'); }
      dots.appendChild(li);
    });
  }

  function heading(text) { return h('h1', { class: 'p-headline', id: 'p-status-text', tabindex: '-1', text: text }); }

  function focusMessageBox(prefill) {
    var d = $('#p-d-msg');
    d.open = true;
    var ta = $('#p-msg-text');
    if (prefill && !ta.value) { ta.value = prefill; }
    d.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    ta.focus();
  }

  function errBox() { return h('p', { class: 'p-err', role: 'alert', text: ui.err }); }

  function renderStage() {
    var box = $('#p-stage');
    box.textContent = '';
    var st = stageObj(data.allomas);
    var closed = data.statusz === 'lezarva' || data.statusz === 'nem_erdeklodik';

    if (data.statusz === 'lezarva') {
      box.appendChild(heading('Ez a megrendelés lezárva.'));
      box.appendChild(h('p', { class: 'p-lead', text: 'Ha mégis szeretnél valamit, írj nekünk bátran az Üzenetek résznél.' }));
      return;
    }
    if (data.statusz === 'nem_erdeklodik') {
      box.appendChild(heading('Rendben, nem zavarunk tovább.'));
      box.appendChild(h('p', { class: 'p-lead', text: 'Ha meggondolod magad, írj nekünk bátran az Üzenetek résznél.' }));
      return;
    }

    box.appendChild(heading(st ? st.ugyfel_szoveg : ''));
    var n = data.allomas;
    var actions = h('div', { class: 'p-actions' });
    var btn = function (cls, text, fn, id) {
      var b = h('button', { type: 'button', class: 'p-btn ' + cls, text: text, id: id });
      b.addEventListener('click', function () { fn(b); });
      return b;
    };

    if (n === 3) {
      var amount = formatFt(data.ajanlat_osszeg);
      if (amount) {
        box.appendChild(h('div', { class: 'p-card p-quote' }, [
          h('div', { class: 'p-label', text: 'Az ajánlatod' }),
          h('div', { class: 'p-quote-amount', text: amount })
        ]));
      }
      if (ui.accepted) {
        box.appendChild(h('div', { class: 'p-ok', id: 'p-ok', tabindex: '-1', role: 'status', text: 'Elfogadtad az ajánlatot. Köszönjük! Hamarosan jelentkezünk.' }));
      } else {
        actions.appendChild(btn('btn-primary', 'Elfogadom', doAccept));
        actions.appendChild(btn('p-btn--ghost', 'Kérdésem van', function () { focusMessageBox(''); }));
      }
    } else if (n === 5) {
      (data.latvanyterv || []).forEach(function (f) {
        var isImg = /^image\//.test(f.mime || '');
        if (isImg) {
          box.appendChild(h('figure', { class: 'p-figure' }, [
            h('a', { href: f.url, target: '_blank', rel: 'noopener' }, [h('img', { src: f.url, alt: 'Látványterv az ajtóról', class: 'p-plan' })]),
            h('figcaption', { text: 'Nyomj a képre a nagyobb nézethez.' })
          ]));
        } else {
          box.appendChild(h('div', { class: 'p-pdf' }, [
            h('a', { class: 'p-btn p-btn--ghost', href: f.url, target: '_blank', rel: 'noopener', text: 'Látványterv megnyitása' })
          ]));
        }
      });
      if (data.latvanyterv_jovahagyva) {
        box.appendChild(h('div', { class: 'p-ok', id: 'p-ok', tabindex: '-1', role: 'status', text: 'Jóváhagytad a látványtervet. Köszönjük!' }));
      } else if (ui.confirmApprove) {
        var conf = h('div', { class: 'p-confirm', role: 'group', 'aria-labelledby': 'p-confirm-q' }, [
          h('p', { id: 'p-confirm-q', text: 'Biztosan jóváhagyod? Ezután indul a gyártás.' })
        ]);
        var ca = h('div', { class: 'p-actions' });
        ca.appendChild(btn('btn-primary', 'Igen, jóváhagyom', doApprove, 'p-yes'));
        ca.appendChild(btn('p-btn--ghost', 'Mégsem', function () { ui.confirmApprove = false; renderStage(); var b = $('#p-approve'); if (b) { b.focus(); } }));
        conf.appendChild(ca);
        box.appendChild(conf);
      } else if (ui.showChange) {
        var form = h('form', { class: 'p-form', novalidate: true }, [
          h('label', { class: 'p-label', for: 'p-change-text', text: 'Mit módosítsunk?' }),
          h('textarea', { class: 'p-textarea', id: 'p-change-text', maxlength: '5000', placeholder: 'Írd le, mit szeretnél másképp' })
        ]);
        form.querySelector('textarea').value = ui.changeDraft;
        form.querySelector('textarea').addEventListener('input', function (e) { ui.changeDraft = e.target.value; });
        if (ui.err) { form.appendChild(errBox()); }
        var fa = h('div', { class: 'p-actions' });
        var send = h('button', { type: 'submit', class: 'p-btn btn-primary', text: 'Elküldöm' });
        fa.appendChild(send);
        fa.appendChild(btn('p-btn--ghost', 'Mégsem', function () { ui.showChange = false; ui.err = ''; renderStage(); }));
        form.appendChild(fa);
        form.addEventListener('submit', function (e) { e.preventDefault(); doChange(send); });
        box.appendChild(form);
      } else {
        actions.appendChild(btn('btn-primary', 'Jóváhagyom', function () { ui.confirmApprove = true; ui.err = ''; renderStage(); var y = $('#p-yes'); if (y) { y.focus(); } }, 'p-approve'));
        actions.appendChild(btn('p-btn--ghost', 'Módosítást kérek', function () { ui.showChange = true; ui.err = ''; renderStage(); var t = $('#p-change-text'); if (t) { t.focus(); } }));
      }
    } else if (n === 6) {
      var d = formatDate(data.varhato_beszereles);
      box.appendChild(h('div', { class: 'p-card' }, d ? [
        h('div', { class: 'p-label', text: 'Várható beszerelés' }),
        h('div', { class: 'p-quote-amount', text: d })
      ] : [h('p', { text: 'Időpontot hamarosan egyeztetünk.' })]));
      actions.appendChild(btn('btn-primary', 'Üzenet írok', function () { focusMessageBox(''); }));
    } else if (n === 7) {
      if (ui.reviewSent) {
        box.appendChild(h('div', { class: 'p-ok', id: 'p-ok', tabindex: '-1', role: 'status', text: 'Köszönjük a visszajelzést!' }));
      } else {
        box.appendChild(buildReviewForm());
      }
    } else {
      actions.appendChild(btn('btn-primary', 'Üzenet írok', function () { focusMessageBox(''); }));
    }

    if (actions.childNodes.length) { box.appendChild(actions); }
    if (ui.err && !ui.showChange && !(n === 7 && !ui.reviewSent)) { box.appendChild(errBox()); }
  }

  /* ---------- Vélemény űrlap (7. állomás) ---------- */
  function buildReviewForm() {
    var form = h('form', { class: 'p-form p-card', novalidate: true, id: 'p-review-form' }, [
      h('h2', { class: 'p-sub', text: 'Vélemény és fotó küldése' }),
      h('label', { class: 'p-label', for: 'p-review-text', text: 'Hogy tetszik az ajtód?' }),
      h('textarea', { class: 'p-textarea', id: 'p-review-text', maxlength: '5000', placeholder: 'Írd ide a véleményed' }),
      h('label', { class: 'p-label', for: 'p-review-photos', text: 'Fotó az elkészült ajtóról (legfeljebb ' + MAX_PHOTOS + ' kép, nem kötelező)' }),
      h('input', { class: 'p-input p-field', id: 'p-review-photos', type: 'file', accept: 'image/*', multiple: true }),
      h('ul', { class: 'p-chosen', id: 'p-review-chosen' })
    ]);
    var ta = form.querySelector('textarea');
    ta.value = ui.reviewDraft;
    ta.addEventListener('input', function (e) { ui.reviewDraft = e.target.value; });
    var fi = form.querySelector('input[type=file]');
    var chosen = form.querySelector('#p-review-chosen');
    function paintChosen() {
      chosen.textContent = '';
      ui.photos.forEach(function (f) { chosen.appendChild(h('li', { text: f.name })); });
    }
    paintChosen();
    var errP = h('p', { class: 'p-err', role: 'alert', id: 'p-review-err', text: ui.err });
    fi.addEventListener('change', function () {
      var files = Array.prototype.slice.call(fi.files || []);
      var msg = '';
      if (files.length > MAX_PHOTOS) { msg = 'Legfeljebb ' + MAX_PHOTOS + ' képet tudsz csatolni.'; files = files.slice(0, MAX_PHOTOS); }
      var okFiles = files.filter(function (f) {
        if (!/^image\//.test(f.type)) { msg = 'Csak képet tudunk fogadni.'; return false; }
        if (f.size > MAX_PHOTO_BYTES) { msg = 'Ez a kép túl nagy (legfeljebb 25 MB).'; return false; }
        return true;
      });
      ui.photos = okFiles;
      errP.textContent = msg;
      paintChosen();
    });
    form.appendChild(errP);
    var send = h('button', { type: 'submit', class: 'p-btn btn-primary', text: 'Elküldöm' });
    form.appendChild(send);
    form.addEventListener('submit', function (e) { e.preventDefault(); doReview(send, errP); });
    return form;
  }

  /* ---------- Blokkok ---------- */
  function renderOrder() {
    var dl = $('#p-order');
    dl.textContent = '';
    var list = data.rendeles || [];
    if (!list.length) { dl.appendChild(h('dd', { class: 'p-muted', text: 'Még nincs rögzített adat.' })); return; }
    list.forEach(function (r) {
      dl.appendChild(h('dt', { text: r.cimke }));
      dl.appendChild(h('dd', { text: r.ertek }));
    });
  }

  function renderMessages() {
    var list = $('#p-msg-list');
    list.textContent = '';
    var msgs = (data.uzenetek || []).map(function (m, i) { return { m: m, i: i, t: parseTime(m.ido) }; });
    msgs.sort(function (a, b) {
      if (a.t && b.t && a.t.getTime() !== b.t.getTime()) { return a.t - b.t; }
      return a.i - b.i;
    });
    if (!msgs.length) { list.appendChild(h('p', { class: 'p-muted', text: 'Még nincs üzenet.' })); }
    msgs.forEach(function (x) {
      var mine = x.m.irany === 'be';
      list.appendChild(h('div', { class: 'p-bubble ' + (mine ? 'p-bubble--me' : 'p-bubble--them') }, [
        h('div', { class: 'p-msg-meta', text: (mine ? 'Te' : 'Roll\u2019n\u2019Door') + (x.t ? ' \u00b7 ' + formatTime(x.m.ido) : '') }),
        h('div', { class: 'p-msg-body', text: x.m.szoveg })
      ]));
    });
  }

  function renderContact() {
    var c = $('#p-contact');
    c.textContent = '';
    if (data.telefon_ricsi) { c.appendChild(h('a', { class: 'p-btn btn-primary', href: telHref(data.telefon_ricsi), text: 'Hívás: ' + data.telefon_ricsi })); }
    if (data.email_ricsi) { c.appendChild(h('a', { class: 'p-btn p-btn--ghost', href: 'mailto:' + data.email_ricsi, text: data.email_ricsi })); }
    if (!c.childNodes.length) { c.appendChild(h('a', { class: 'p-btn p-btn--ghost', href: 'mailto:info@rollndoor.hu', text: 'info@rollndoor.hu' })); }
  }

  function renderAll(focusStatus) {
    $('#p-hello').textContent = 'Szia, ' + data.nev + '!';
    document.title = 'Hol tart az ajtód? \u2013 Roll\u2019n\u2019Door';
    $('#p-app').textContent = '';
    $('#p-content').hidden = false;
    renderProgress();
    renderStage();
    renderOrder();
    renderMessages();
    renderContact();
    var un = $('#p-unsub');
    un.href = '/le/' + token;
    if (data.leiratkozott) {
      un.textContent = 'Automatikus levelet nem küldünk neked.';
      un.removeAttribute('href');
      un.setAttribute('role', 'text');
    } else {
      un.textContent = 'Nem kérek több levelet';
    }
    if (focusStatus) {
      var t = $('#p-ok') || $('#p-status-text');
      if (t) { t.focus({ preventScroll: false }); }
    }
  }

  /* ---------- Betöltés és műveletek ---------- */
  async function load(focusStatus) {
    var r = await api('GET', '');
    if (r.status === 404) { return showInvalid(); }
    if (!r.ok) { return showTemporaryError(r.hiba); }
    data = r;
    renderAll(focusStatus);
  }

  async function act(btn, fn) {
    if (busy) { return; }
    busy = true;
    var label = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Küldés…'; }
    ui.err = '';
    try { await fn(); }
    finally {
      busy = false;
      var live = document.body.contains(btn);
      if (btn && live) { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = label; }
    }
  }

  function fail(r) {
    ui.err = r.hiba;
    if (r.status === 404) { return showInvalid(); }
    renderStage();
    var e = document.querySelector('#p-stage .p-err');
    if (e) { e.scrollIntoView({ block: 'nearest' }); }
  }

  function doAccept(btn) {
    return act(btn, async function () {
      var r = await api('POST', '/elfogad', {});
      if (!r.ok) { return fail(r); }
      ui.accepted = true;
      await load(true);
    });
  }

  function doApprove(btn) {
    return act(btn, async function () {
      var r = await api('POST', '/jovahagyas', { dontes: 'jovahagyom' });
      if (!r.ok) { return fail(r); }
      ui.confirmApprove = false;
      await load(true);
    });
  }

  function doChange(btn) {
    var v = ui.changeDraft.trim();
    if (!v) { ui.err = 'Írd le röviden, mit módosítsunk.'; renderStage(); var t = $('#p-change-text'); if (t) { t.focus(); } return; }
    return act(btn, async function () {
      var r = await api('POST', '/jovahagyas', { dontes: 'modositas', megjegyzes: v });
      if (!r.ok) { return fail(r); }
      ui.showChange = false;
      ui.changeDraft = '';
      ui.err = '';
      await load(true);
      var s = $('#p-status-text');
      if (s) { s.parentNode.insertBefore(h('div', { class: 'p-ok', id: 'p-ok', tabindex: '-1', role: 'status', text: 'Elküldtük a módosítási kérésed. Hamarosan jelentkezünk.' }), s.nextSibling); var o = $('#p-ok'); if (o) { o.focus(); } }
    });
  }

  function doReview(btn, errP) {
    var v = ui.reviewDraft.trim();
    if (!v) { errP.textContent = 'Írj pár szót a véleményedhez.'; $('#p-review-text').focus(); return; }
    return act(btn, async function () {
      var fd = new FormData();
      fd.append('szoveg', v);
      var shrunk = await Promise.all(ui.photos.map(function (f) { return shrinkPhoto(f); }));
      shrunk.forEach(function (f) { fd.append('fotok', f, f.name); });
      var r = await api('POST', '/velemeny', fd);
      if (!r.ok) { errP.textContent = r.hiba; return; }
      ui.reviewSent = true;
      ui.reviewDraft = '';
      ui.photos = [];
      await load(true);
    });
  }

  function initMessageForm() {
    $('#p-msg-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var ta = $('#p-msg-text');
      var err = $('#p-msg-err');
      var ok = $('#p-msg-ok');
      var send = $('#p-msg-send');
      ok.textContent = '';
      err.textContent = '';
      var v = ta.value.trim();
      if (!v) { err.textContent = 'Írj pár szót az üzenetbe.'; ta.focus(); return; }
      if (busy) { return; }
      busy = true;
      send.disabled = true;
      send.setAttribute('aria-busy', 'true');
      ta.readOnly = true;
      api('POST', '/uzenet', { szoveg: v }).then(async function (r) {
        if (!r.ok) { err.textContent = r.hiba; return; }
        ta.value = '';
        ok.textContent = 'Elküldtük az üzeneted. Hamarosan válaszolunk.';
        var g = await api('GET', '');
        if (g.ok) { data = g; renderMessages(); }
      }).finally(function () {
        busy = false;
        send.disabled = false;
        send.removeAttribute('aria-busy');
        ta.readOnly = false;
      });
    });
  }

  function start() {
    if (!TOKEN_RE.test(token)) { return showInvalid(); }
    initMessageForm();
    load(false);
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }
})();
