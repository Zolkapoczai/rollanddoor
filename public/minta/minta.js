/* Roll'n'Door – megrendelés-követés MINTA (kitalált adatok, nincs backend).
   Az ugyfel.html és a ricsi.html ugyanezt a fájlt használja, egy közös állapottal. */
(function () {
  'use strict';

  /* ---------- A 7 állomás: ez a szerződés, mindkét oldal innen dolgozik ---------- */
  var STAGES = [
    {
      n: 1, name: 'Igény beérkezett',
      customerText: 'Megkaptuk, 1 munkanapon belül keresünk.',
      customerButtons: [{ id: 'msg', label: 'Üzenet' }],
      ricsiLabel: 'Egyeztetés kész', ricsiInput: null,
      email: 'Megkaptuk az igényed'
    },
    {
      n: 2, name: 'Egyeztetés',
      customerText: 'Egyeztetünk a részletekről.',
      customerButtons: [{ id: 'msg', label: 'Üzenet' }, { id: 'dims', label: 'Méretek megadása' }],
      ricsiLabel: 'Ajánlat elküldve', ricsiInput: 'amount',
      email: null
    },
    {
      n: 3, name: 'Ajánlat elküldve',
      customerText: 'Elkészült az ajánlatod.',
      customerButtons: [{ id: 'accept', label: 'Elfogadom' }, { id: 'question', label: 'Kérdésem van' }],
      ricsiLabel: 'Előleg megérkezett', ricsiInput: null,
      email: 'Ajánlat; emlékeztető a 3. és 7. napon'
    },
    {
      n: 4, name: 'Előleg megérkezett',
      customerText: 'Köszönjük, készül a látványterv.',
      customerButtons: [{ id: 'msg', label: 'Üzenet' }],
      ricsiLabel: 'Látványterv feltöltése', ricsiInput: 'file',
      email: 'Megérkezett az előleg'
    },
    {
      n: 5, name: 'Látványterv',
      customerText: 'Kész a látványterv. Nézd meg, és jelezd, ha jó így.',
      customerButtons: [{ id: 'approve', label: 'Jóváhagyom' }, { id: 'change', label: 'Módosítást kérek' }],
      ricsiLabel: 'Gyártás indul', ricsiInput: null, needsApproval: true,
      email: 'Kész a látványterv'
    },
    {
      n: 6, name: 'Gyártás',
      customerText: 'Készül az ajtód.',
      customerButtons: [{ id: 'msg', label: 'Üzenet' }],
      ricsiLabel: 'Elkészült, időpont', ricsiInput: 'date',
      email: 'Elkészült, egyeztessünk; előző napi emlékeztető'
    },
    {
      n: 7, name: 'Beszerelve',
      customerText: 'Köszönjük!',
      customerButtons: [{ id: 'review', label: 'Vélemény és fotó küldése' }],
      ricsiLabel: 'Lezárás', ricsiInput: null,
      email: 'Vélemény- és fotókérés'
    }
  ];

  /* ---------- Állapot: egy localStorage kulcs, try/catch + memória tartalék ---------- */
  var KEY = 'rollndoor_minta_v1';
  var memory = null;

  function seed() {
    return {
      stage: 1, approved: false, closed: false, amount: null, date: null, days: 2,
      messages: [
        { from: 'ugyfel', text: 'Sziasztok! Egy egyszárnyú tolóajtót szeretnék a nappali és a dolgozószoba közé.', when: 'nov. 10., 18:42' },
        { from: 'auto', text: 'Automatikus levél: Megkaptuk az igényed.', when: 'nov. 10., 18:42' },
        { from: 'ricsi', text: 'Szia Anna! Köszi az érdeklődést, holnap délelőtt hívlak.', when: 'nov. 11., 08:15' }
      ],
      notes: []
    };
  }

  function load() {
    var raw = null;
    try { raw = window.localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (raw) {
      try { var s = JSON.parse(raw); if (s && s.stage) { return s; } } catch (e2) { /* hibás adat: újrakezdjük */ }
    }
    return memory ? JSON.parse(JSON.stringify(memory)) : seed();
  }

  var state = load();

  function save() {
    memory = JSON.parse(JSON.stringify(state));
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* memóriában marad */ }
  }

  function reset() {
    state = seed();
    save();
  }

  /* ---------- Segédek ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    var k;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) { continue; }
        if (k === 'text') { el.textContent = attrs[k]; }
        else if (k === 'class') { el.className = attrs[k]; }
        else { el.setAttribute(k, attrs[k]); }
      }
    }
    (children || []).forEach(function (c) { if (c) { el.appendChild(c); } });
    return el;
  }

  function stageOf(n) { return STAGES[n - 1]; }

  function nowLabel() {
    var d = new Date();
    var months = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
    var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return months[d.getMonth()] + ' ' + d.getDate() + '., ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function formatFt(v) {
    var digits = String(v).replace(/[^\d]/g, '');
    if (!digits) { return null; }
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ft';
  }

  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) { return null; }
    var names = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
    return m[1] + '. ' + names[parseInt(m[2], 10) - 1] + ' ' + parseInt(m[3], 10) + '.';
  }

  function quoteAmount() { return state.amount ? formatFt(state.amount) : '480 000 Ft'; }
  function installDate() { return state.date ? formatDate(state.date) : '2026. december 5.'; }

  var toastTimer = null;
  function toast(msg) {
    var t = $('#m-toast');
    if (!t) { return; }
    t.textContent = msg;
    t.classList.add('m-toast--on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('m-toast--on'); }, 3500);
  }

  function addMessage(from, text) {
    state.messages.unshift({ from: from, text: text, when: nowLabel() });
  }

  function renderMessages(list, viewer) {
    list.textContent = '';
    state.messages.forEach(function (m) {
      var mine = m.from === viewer;
      var who = m.from === 'auto' ? 'Automatikus levél'
        : m.from === 'ugyfel' ? (viewer === 'ugyfel' ? 'Te' : 'Minta Anna')
        : (viewer === 'ricsi' ? 'Te' : 'Ricsi');
      list.appendChild(h('li', { class: 'm-msg' + (mine ? ' m-msg--mine' : '') + (m.from === 'auto' ? ' m-msg--auto' : '') }, [
        h('div', { class: 'm-msg-meta', text: who + ' · ' + m.when }),
        h('div', { text: m.text })
      ]));
    });
  }

  /* ---------- Közös elemek ---------- */
  function wireCommon(page) {
    var other = $('#m-reset');
    if (other) {
      other.addEventListener('click', function (e) {
        e.preventDefault();
        reset();
        render();
        toast('Visszaállítva az induló állapotra.');
      });
    }
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) { state = load(); render(); }
    });
    page.wired = true;
  }

  /* =====================================================================
     ÜGYFÉL OLDAL
     ===================================================================== */
  function renderCustomer() {
    var st = stageOf(state.stage);

    // Folyamatsáv
    $('#m-progress-label').textContent = state.stage + ' / 7 – ' + st.name;
    var dots = $('#m-steps');
    dots.textContent = '';
    STAGES.forEach(function (s) {
      var cls = 'm-step' + (s.n < state.stage ? ' m-step--done' : '') + (s.n === state.stage ? ' m-step--now' : '');
      var li = h('li', { class: cls }, [h('span', { class: 'm-sr', text: s.n + '. ' + s.name + (s.n < state.stage ? ' (kész)' : '') })]);
      if (s.n === state.stage) { li.setAttribute('aria-current', 'step'); }
      dots.appendChild(li);
    });

    // Fő tartalom
    var main = $('#m-stage');
    main.textContent = '';
    if (state.closed) {
      main.appendChild(h('h1', { class: 'm-headline', text: 'Ez a megrendelés lezárva.' }));
      main.appendChild(h('p', { class: 'm-lead', text: 'Ha mégis szeretnél valamit, írj nekünk bátran.' }));
      return renderCustomerBlocks();
    }
    main.appendChild(h('h1', { class: 'm-headline', text: st.customerText }));

    if (st.n === 3) {
      main.appendChild(h('div', { class: 'm-card m-quote' }, [
        h('div', { class: 'm-quote-amount', text: quoteAmount() }),
        h('div', { class: 'm-sample', text: 'minta összeg' }),
        h('p', { text: 'Az ajánlat tartalma: egyszárnyú tolóajtó, 95 × 210 cm, tömörfa, RAL 7016, dupla sínes vasalat, soft-close, gyártás és beszerelés.' })
      ]));
    }
    if (st.n === 5) {
      main.appendChild(h('figure', { class: 'm-figure' }, [
        h('img', { src: '../img/gallery1.webp', alt: 'Minta látványterv az ajtóról', class: 'm-plan' }),
        h('figcaption', { text: 'Minta látványterv' })
      ]));
      if (state.approved) {
        main.appendChild(h('div', { class: 'm-ok', role: 'status', text: 'Jóváhagytad a látványtervet. Köszönjük, indulhat a gyártás!' }));
      }
    }
    if (st.n === 6) {
      main.appendChild(h('div', { class: 'm-card' }, [
        h('div', { class: 'm-label', text: 'Várható beszerelés' }),
        h('div', { class: 'm-quote-amount', text: installDate() }),
        h('div', { class: 'm-sample', text: 'minta dátum' })
      ]));
    }

    var actions = h('div', { class: 'm-actions' });
    st.customerButtons.forEach(function (b, i) {
      if (st.n === 5 && state.approved && b.id === 'approve') { return; }
      var primary = i === 0;
      var btn = h('button', { type: 'button', class: 'm-btn ' + (primary ? 'btn-primary' : 'm-btn--ghost'), 'data-act': b.id, text: b.label });
      actions.appendChild(btn);
    });
    main.appendChild(actions);

    actions.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-act]');
      if (btn) { customerAction(btn.getAttribute('data-act')); }
    });

    renderCustomerBlocks();
  }

  function openAndFocusMessages(prefill) {
    var d = $('#m-d-msg');
    d.open = true;
    var ta = $('#m-msg-text');
    if (prefill && !ta.value) { ta.value = prefill; }
    d.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    ta.focus();
  }

  function customerAction(id) {
    if (id === 'msg') { openAndFocusMessages(''); }
    else if (id === 'dims') { window.location.href = '/tervezo.html'; }
    else if (id === 'accept') { toast('Köszönjük! Mintában ez csak üzenet; Ricsi jelzi, ha megjött az előleg.'); }
    else if (id === 'question') { openAndFocusMessages('Kérdésem van az ajánlattal kapcsolatban: '); }
    else if (id === 'change') { openAndFocusMessages('Módosítást kérek: '); }
    else if (id === 'review') { openAndFocusMessages('Vélemény: '); toast('Mintában a fotót is itt csatolnád.'); }
    else if (id === 'approve') {
      if (window.confirm('Jóváhagyod a látványtervet? Ezután indulhat a gyártás.')) {
        state.approved = true;
        addMessage('ugyfel', 'Jóváhagytam a látványtervet.');
        save();
        render();
        var ok = $('.m-ok');
        if (ok) { ok.setAttribute('tabindex', '-1'); ok.focus(); }
      }
    }
  }

  function renderCustomerBlocks() {
    renderMessages($('#m-msg-list'), 'ugyfel');
  }

  function initCustomer() {
    $('#m-msg-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var ta = $('#m-msg-text');
      var v = ta.value.trim();
      if (!v) { toast('Írj pár szót az üzenetbe.'); ta.focus(); return; }
      addMessage('ugyfel', v);
      ta.value = '';
      save();
      renderCustomerBlocks();
      toast('Elküldve (mintában csak ezen a telefonon).');
    });
  }

  /* =====================================================================
     RICSI OLDAL
     ===================================================================== */
  var ricsi = { inputShown: false, fileName: null };

  function renderRicsi() {
    var st = stageOf(state.stage);
    ricsi.inputShown = false;
    ricsi.fileName = null;

    $('#m-stage-name').textContent = state.closed ? 'Lezárva' : st.n + '. ' + st.name;
    $('#m-since').textContent = state.closed ? 'A megrendelés le van zárva.'
      : (state.days === 0 ? 'Ma lépett ide' : state.days + ' napja áll itt');

    var box = $('#m-action');
    box.textContent = '';

    if (state.closed) {
      box.appendChild(h('div', { class: 'm-card m-closed', role: 'status', text: 'Ez a megrendelés lezárva. Alább a minta visszaállításával újra kipróbálhatod.' }));
      return renderRicsiBlocks();
    }

    var needLock = st.needsApproval && !state.approved;
    var primary = h('button', { type: 'button', class: 'm-btn m-btn--big btn-primary', id: 'm-primary', text: st.ricsiLabel });
    if (needLock) { primary.disabled = true; primary.setAttribute('aria-describedby', 'm-hint'); }
    box.appendChild(primary);

    if (needLock) {
      box.appendChild(h('p', { class: 'm-hint', id: 'm-hint', text: 'Az ügyfél még nem hagyta jóvá' }));
    }

    var holder = h('div', { class: 'm-input-holder', id: 'm-input-holder' });
    box.appendChild(holder);

    box.appendChild(h('p', { class: 'm-mailnote', text: 'Az ügyfél erről levelet kap: ' + (nextMail(st) || 'nem megy automatikus levél.') }));

    var sec = h('div', { class: 'm-secondary' }, [
      h('button', { type: 'button', class: 'm-btn m-btn--ghost', id: 'm-back', text: 'Visszalépés' }),
      h('button', { type: 'button', class: 'm-btn m-btn--danger', id: 'm-lost', text: 'Nem érdeklődik' })
    ]);
    if (st.n === 1) { sec.firstChild.disabled = true; }
    box.appendChild(sec);

    primary.addEventListener('click', function () { ricsiPrimary(st, primary, holder); });
    $('#m-back').addEventListener('click', function () {
      if (state.stage > 1) {
        state.stage -= 1;
        if (state.stage < 5) { state.approved = false; }
        state.days = 0;
        save(); render();
        toast('Visszaléptél: ' + stageOf(state.stage).name + '.');
      }
    });
    $('#m-lost').addEventListener('click', function () {
      if (window.confirm('Biztosan lezárod? Az ügyfél nem érdeklődik tovább.')) {
        state.closed = true;
        save(); render();
      }
    });

    renderRicsiBlocks();
  }

  /* A levél azé az állomásé, ahová lépünk (a táblázat "Automatikus levél" oszlopa). */
  function nextMail(st) { return st.n < 7 ? stageOf(st.n + 1).email : null; }

  function advance(st) {
    var mail = nextMail(st);
    if (mail) { addMessage('auto', 'Automatikus levél: ' + mail + '.'); }
    if (st.n === 7) { state.closed = true; }
    else { state.stage += 1; state.days = 0; }
    save();
    render();
    toast(st.n === 7 ? 'Lezárva.' : 'Tovább: ' + stageOf(state.stage).name + '.');
  }

  function ricsiPrimary(st, primary, holder) {
    if (st.ricsiInput === 'amount') {
      if (!ricsi.inputShown) {
        ricsi.inputShown = true;
        holder.appendChild(h('label', { for: 'm-amount', class: 'm-label', text: 'Az ajánlat összege (Ft)' }));
        holder.appendChild(h('input', { id: 'm-amount', class: 'm-input', type: 'text', inputmode: 'numeric', placeholder: 'Pl. 480000', autocomplete: 'off' }));
        primary.textContent = 'Ajánlat elküldése';
        $('#m-amount').focus();
        return;
      }
      var f = formatFt($('#m-amount').value);
      if (!f) { toast('Írd be az összeget számokkal.'); $('#m-amount').focus(); return; }
      state.amount = $('#m-amount').value.replace(/[^\d]/g, '');
      return advance(st);
    }
    if (st.ricsiInput === 'date') {
      if (!ricsi.inputShown) {
        ricsi.inputShown = true;
        holder.appendChild(h('label', { for: 'm-date', class: 'm-label', text: 'Beszerelés időpontja' }));
        holder.appendChild(h('input', { id: 'm-date', class: 'm-input', type: 'date' }));
        primary.textContent = 'Időpont elküldése';
        $('#m-date').focus();
        return;
      }
      var d = $('#m-date').value;
      if (!formatDate(d)) { toast('Válassz egy dátumot.'); $('#m-date').focus(); return; }
      state.date = d;
      return advance(st);
    }
    if (st.ricsiInput === 'file') {
      if (!ricsi.fileName) {
        var fi = $('#m-file');
        if (!fi) {
          fi = h('input', { id: 'm-file', type: 'file', accept: 'image/*,application/pdf', class: 'm-sr', tabindex: '-1' });
          holder.appendChild(fi);
          fi.addEventListener('change', function () {
            if (fi.files && fi.files[0]) {
              ricsi.fileName = fi.files[0].name;
              holder.appendChild(h('p', { class: 'm-file-name', role: 'status', text: 'Kiválasztva: ' + ricsi.fileName + ' (mintában nem töltődik fel)' }));
              primary.textContent = 'Feltöltés és tovább';
            }
          });
        }
        fi.click();
        return;
      }
      return advance(st);
    }
    advance(st);
  }

  function renderRicsiBlocks() {
    renderMessages($('#m-mail-list'), 'ricsi');
    var nl = $('#m-note-list');
    nl.textContent = '';
    if (!state.notes.length) { nl.appendChild(h('li', { class: 'm-note m-muted', text: 'Még nincs jegyzet.' })); }
    state.notes.forEach(function (n) {
      nl.appendChild(h('li', { class: 'm-note' }, [h('div', { class: 'm-msg-meta', text: n.when }), h('div', { text: n.text })]));
    });
  }

  function initRicsi() {
    $('#m-reply-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var ta = $('#m-reply-text');
      var v = ta.value.trim();
      if (!v) { toast('Írj pár szót a válaszba.'); ta.focus(); return; }
      addMessage('ricsi', v);
      ta.value = '';
      save(); renderRicsiBlocks();
      toast('Elküldve (mintában nem megy ki e-mail).');
    });
    $('#m-note-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var ta = $('#m-note-text');
      var v = ta.value.trim();
      if (!v) { toast('Írj valamit a jegyzetbe.'); ta.focus(); return; }
      state.notes.unshift({ text: v, when: nowLabel() });
      ta.value = '';
      save(); renderRicsiBlocks();
      toast('Mentve.');
    });
  }

  /* ---------- Indítás ---------- */
  var page = document.body.getAttribute('data-page');
  function render() { if (page === 'ricsi') { renderRicsi(); } else { renderCustomer(); } }

  function start() {
    var p = { wired: false };
    wireCommon(p);
    if (page === 'ricsi') { initRicsi(); } else { initCustomer(); }
    render();
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', start); }
  else { start(); }

  window.MINTA = { STAGES: STAGES, getState: function () { return state; } };
})();
