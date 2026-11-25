// Ajtótervező: 6 lépéses ajánlatkérő. Nem árkalkulátor: csak azt gyűjtjük, amiből Ricsi ajánlatot tud írni.
// Függ a kozos.js-től (TURNSTILE_SITEKEY, MAX_PHOTOS, MAX_PHOTO_BYTES, shrinkPhoto).
(function () {
    'use strict';

    var STORE_KEY = 'rnd_tervezo_v1';
    var TOTAL = 6;
    var PHONE_DISPLAY = '06 20 565 0661';
    var PHONE_HREF = 'tel:+36205650661';
    var NINCS = 'Nincs megadva';

    var RADIOS = ['tipus', 'fal', 'irany', 'lap', 'szin', 'vasalatTipus', 'vasalatSzin', 'beszereles'];
    var CHECKS = ['fotoKesobb', 'fogantyu', 'lagyZaras', 'zar', 'megvezeto', 'felelos', 'adatkezeles'];
    var TEXTS = ['szelesseg', 'magassag', 'szabadFal', 'lapLeiras', 'szinEgyeb', 'vasalatEgyeb', 'nev', 'email', 'telefon', 'megjegyzes'];

    var form = document.getElementById('tzForm');
    if (!form) { return; }

    function $(s, r) { return (r || document).querySelector(s); }
    function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
    function byId(id) { return document.getElementById(id); }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /* ---------- Tárolás: sessionStorage, memóriába eső tartalékkal ---------- */
    var memStore = null;
    var store = {
        read: function () {
            try {
                var raw = window.sessionStorage.getItem(STORE_KEY);
                if (raw) { return JSON.parse(raw); }
            } catch (e) { /* tiltott vagy hibás tároló */ }
            return memStore;
        },
        write: function (obj) {
            memStore = obj;
            try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (e) { /* memóriában marad */ }
        },
        clear: function () {
            memStore = null;
            try { window.sessionStorage.removeItem(STORE_KEY); } catch (e) { /* nem baj */ }
        }
    };

    /* ---------- Állapot ---------- */
    var S = { step: 1, v: {}, fotoDb: 0 };
    var photos = [];          // File objektumok: újratöltés után nem állíthatók vissza
    var fromSummary = false;  // az összegzésből jött "Módosítom"-mal
    var finished = false;
    var sending = false;
    var turnstileId = null;

    function readForm() {
        var v = {};
        RADIOS.forEach(function (n) {
            var c = form.querySelector('input[name="' + n + '"]:checked');
            v[n] = c ? c.value : '';
        });
        CHECKS.forEach(function (n) { v[n] = form.elements[n].checked; });
        TEXTS.forEach(function (n) { v[n] = form.elements[n].value; });
        return v;
    }

    function save() {
        S.v = readForm();
        S.fotoDb = photos.length;
        store.write(S);
    }

    function applyState(saved) {
        var v = saved.v || {};
        RADIOS.forEach(function (n) {
            if (!v[n]) { return; }
            var el = form.querySelector('input[name="' + n + '"][value="' + v[n] + '"]');
            if (el) { el.checked = true; }
        });
        CHECKS.forEach(function (n) { if (typeof v[n] === 'boolean') { form.elements[n].checked = v[n]; } });
        TEXTS.forEach(function (n) { if (typeof v[n] === 'string') { form.elements[n].value = v[n]; } });
    }

    /* ---------- Lépések ---------- */
    var sections = $$('.step');
    var nextBtn = byId('tzNext');
    var backBtn = byId('tzBack');

    function labelOfInput(input) {
        var t = input.closest('label').querySelector('.opt-txt');
        if (!t) { return ''; }
        var c = t.cloneNode(true);
        $$('.opt-badge', c).forEach(function (b) { b.remove(); });
        return c.textContent.replace(/\s+/g, ' ').trim();
    }

    function checkedLabel(name) {
        var c = form.querySelector('input[name="' + name + '"]:checked');
        return c ? labelOfInput(c) : '';
    }

    function updateReveals() {
        byId('szinEgyebWrap').hidden = form.elements.szin.value !== 'egyeb';
        byId('vasalatEgyebWrap').hidden = form.elements.vasalatSzin.value !== 'egyeb';
    }

    function updateButtons() {
        var n = S.step;
        backBtn.hidden = n === 1;
        nextBtn.textContent = n === TOTAL ? 'Elküldöm' : (fromSummary ? 'Vissza az összegzéshez' : 'Tovább');
    }

    function show(n, opts) {
        opts = opts || {};
        n = Math.max(1, Math.min(TOTAL, n));
        S.step = n;
        sections.forEach(function (s) { s.hidden = Number(s.getAttribute('data-step')) !== n; });
        byId('tzNow').textContent = String(n);
        byId('tzBarFill').style.width = (n / TOTAL * 100) + '%';
        byId('tzBar').setAttribute('aria-valuenow', String(n));
        if (n === TOTAL) { fromSummary = false; renderSummary(); ensureTurnstile(); renderIllesztes(); render3d(); }
        updateButtons();
        if (opts.push) {
            try { history.pushState({ step: n }, '', '#lepes-' + n); } catch (e) { /* nem baj */ }
        } else if (opts.replace) {
            try { history.replaceState({ step: n }, '', '#lepes-' + n); } catch (e) { /* nem baj */ }
        }
        save();
        if (!opts.silent) {
            window.scrollTo(0, 0);
            var h = byId('h' + n);
            if (h) { h.focus({ preventScroll: true }); }
        }
    }

    function stepFromHash() {
        var m = /^#lepes-([1-6])$/.exec(location.hash);
        return m ? Number(m[1]) : 0;
    }

    /* ---------- Hibák ---------- */
    function setErr(id, msg) {
        var err = byId(id + '-err');
        var el = byId(id);
        if (err) { err.textContent = msg || ''; }
        if (el) {
            if (msg) { el.setAttribute('aria-invalid', 'true'); } else { el.removeAttribute('aria-invalid'); }
        }
    }

    function clearErrors() {
        ['szelesseg', 'magassag', 'fotok', 'nev', 'email', 'felelos', 'adatkezeles'].forEach(function (id) { setErr(id, ''); });
    }

    function validateStep(n) {
        var firstBad = null;
        function bad(id, msg) { setErr(id, msg); if (!firstBad) { firstBad = byId(id); } }

        if (n === 2) {
            var w = form.elements.szelesseg;
            var h = form.elements.magassag;
            var wv = Number(w.value);
            var hv = Number(h.value);
            setErr('szelesseg', ''); setErr('magassag', ''); setErr('fotok', '');
            if (w.value === '' || !isFinite(wv) || wv <= 0) { bad('szelesseg', 'Írd be a nyílás szélességét cm-ben.'); }
            if (h.value === '' || !isFinite(hv) || hv <= 0) { bad('magassag', 'Írd be a nyílás magasságát cm-ben.'); }
            if (photos.length === 0 && !form.elements.fotoKesobb.checked) {
                bad('fotok', 'Küldj 1–2 fotót a nyílásról, vagy jelöld be, hogy később küldöd e-mailben.');
            }
        }
        if (n === 6) {
            setErr('nev', ''); setErr('email', ''); setErr('felelos', ''); setErr('adatkezeles', '');
            if (!form.elements.nev.value.trim()) { bad('nev', 'Add meg a neved, hogy tudjuk, kit keressünk.'); }
            var em = form.elements.email.value.trim();
            if (!em) {
                bad('email', 'Add meg az e-mail-címedet, ide küldjük az ajánlatot.');
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) {
                bad('email', 'Ez nem tűnik érvényes e-mail-címnek. Nézd át, kérlek.');
            }
            if (!form.elements.felelos.checked) { bad('felelos', 'Jelöld be, hogy a megadott méretekért te felelsz.'); }
            if (!form.elements.adatkezeles.checked) { bad('adatkezeles', 'Az adatkezelési tájékoztató elolvasása nélkül nem tudjuk elküldeni.'); }
        }
        if (firstBad) { firstBad.focus(); return false; }
        return true;
    }

    /* ---------- Méret: puha figyelmeztetés, nem tiltás ---------- */
    function softHint(id, min, max) {
        var el = form.elements[id];
        var hint = byId(id + '-hint');
        var v = Number(el.value);
        hint.textContent = (el.value !== '' && isFinite(v) && (v < min || v > max)) ? 'Biztos jól írtad? cm-ben kérjük.' : '';
    }

    /* ---------- Fotók ---------- */
    function renderPhotos() {
        var ul = byId('photoList');
        ul.textContent = '';
        photos.forEach(function (f, i) {
            var li = document.createElement('li');
            var name = document.createElement('span');
            name.className = 'pname';
            name.textContent = f.name;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = 'Törlés';
            btn.setAttribute('aria-label', 'Fotó törlése: ' + f.name);
            btn.addEventListener('click', function () {
                photos.splice(i, 1);
                renderPhotos();
                save();
                byId('fotok').focus();
            });
            li.appendChild(name);
            li.appendChild(btn);
            ul.appendChild(li);
        });
        var note = byId('fotok-note');
        if (photos.length === 0 && S.fotoDb > 0 && !form.elements.fotoKesobb.checked) {
            note.textContent = 'A korábban kiválasztott fotókat a böngésző nem tudja megőrizni az oldal újratöltése után. Válaszd ki őket újra, kérlek.';
        } else {
            note.textContent = '';
        }
    }

    byId('fotok').addEventListener('change', function (e) {
        var input = e.target;
        var picked = Array.prototype.slice.call(input.files || []);
        var msg = '';
        picked.forEach(function (f) {
            if (f.size > MAX_PHOTO_BYTES) {
                msg = 'A(z) „' + f.name + '” túl nagy. Egy kép legfeljebb 25 MB lehet.';
            } else if (photos.length >= MAX_PHOTOS) {
                msg = 'Legfeljebb ' + MAX_PHOTOS + ' fotót tudsz csatolni. A többit nem vettem fel.';
            } else {
                photos.push(f);
            }
        });
        input.value = '';
        S.fotoDb = photos.length;
        setErr('fotok', msg);
        renderPhotos();
        save();
    });

    /* ---------- Összegzés ---------- */
    function rows() {
        var v = readForm();
        var r = [];
        function add(cimke, ertek, lepes) { r.push({ cimke: cimke, ertek: ertek || NINCS, lepes: lepes }); }

        add('Elrendezés', checkedLabel('tipus'), 1);
        add('Nyílás szélessége', v.szelesseg !== '' ? v.szelesseg + ' cm' : '', 2);
        add('Nyílás magassága', v.magassag !== '' ? v.magassag + ' cm' : '', 2);
        add('Fal anyaga', checkedLabel('fal'), 2);
        add('Tolás iránya', checkedLabel('irany'), 2);
        if (v.szabadFal !== '') { add('Szabad fal a nyílás mellett', v.szabadFal + ' cm', 2); }
        add('Fotó', photos.length ? photos.length + ' db' : (v.fotoKesobb ? 'később küldi' : ''), 2);
        add('Ajtólap', checkedLabel('lap'), 3);
        if (v.lapLeiras.trim()) { add('Elképzelés', v.lapLeiras.trim(), 3); }
        var szin = checkedLabel('szin');
        add('Szín', v.szin === 'egyeb' && v.szinEgyeb.trim() ? 'Egyéb: ' + v.szinEgyeb.trim() : szin, 4);
        add('Vasalat típusa', checkedLabel('vasalatTipus'), 5);
        var vsz = checkedLabel('vasalatSzin');
        add('Vasalat színe', v.vasalatSzin === 'egyeb' && v.vasalatEgyeb.trim() ? 'Egyéb: ' + v.vasalatEgyeb.trim() : vsz, 5);
        var extra = ['fogantyu', 'lagyZaras', 'zar', 'megvezeto'].filter(function (n) { return v[n]; })
            .map(function (n) { return labelOfInput(form.elements[n]); });
        add('Kiegészítők', extra.length ? extra.join(', ') : 'Egyik sem', 5);
        add('Beszerelés', checkedLabel('beszereles'), 5);
        if (v.felelos) { r.push({ cimke: 'Méretek pontossága', ertek: 'A megadott méretek pontosságáért felel', lepes: 0 }); }
        return r;
    }

    function renderSummary() {
        var ul = byId('summary');
        ul.textContent = '';
        rows().forEach(function (row) {
            var li = document.createElement('li');
            var txt = document.createElement('span');
            txt.className = 's-text';
            var l = document.createElement('span');
            l.className = 's-label';
            l.textContent = row.cimke;
            var val = document.createElement('span');
            val.className = 's-val';
            val.textContent = row.ertek;
            txt.appendChild(l);
            txt.appendChild(val);
            li.appendChild(txt);
            if (row.lepes) {
                var a = document.createElement('a');
                a.href = '#lepes-' + row.lepes;
                a.textContent = 'Módosítom';
                a.setAttribute('aria-label', 'Módosítom: ' + row.cimke);
                a.addEventListener('click', function (e) {
                    e.preventDefault();
                    fromSummary = true;
                    show(row.lepes, { push: true });
                });
                li.appendChild(a);
            }
            ul.appendChild(li);
        });
    }

    /* ---------- Fotóillesztés: az ajtó az ügyfél saját fotóján (fotoillesztes.js) ---------- */
    function renderIllesztes() {
        var box = byId('fiBox');
        if (!box || !window.FotoIllesztes) { if (box) { box.hidden = true; } return; }
        var van = photos.length > 0;
        byId('fiNoFoto').hidden = van;
        if (!box.open) { return; } // csak kinyitva rajzolunk
        var v = readForm();
        window.FotoIllesztes.render(byId('fotoIllesztes'), van ? photos[0] : null, {
            lap: v.lap, szin: v.szin, vasalatTipus: v.vasalatTipus, tipus: v.tipus, irany: v.irany, fogantyu: !!v.fogantyu,
            vasalatSzin: v.vasalatSzin, vasalatEgyeb: v.vasalatEgyeb, szelesseg: v.szelesseg, magassag: v.magassag
        }, { beallit: beallitFoto });
    }
    // A fotón választott érték: a tervező mezője, az összegzés, a fotó, és ha nyitva van, a 3D is frissül.
    function beallitFoto(nev, ertek) {
        beallit3d(nev, ertek);
        render3d();
    }
    /* ---------- 3D előnézet (elonezet3d.js + three.js), csak kinyitáskor töltődik be ---------- */
    var d3Modul = null;
    function render3d() {
        var box = byId('d3Box');
        if (!box || !box.open) { return; }
        var v = readForm();
        var o = {
            lap: v.lap, szin: v.szin, vasalatTipus: v.vasalatTipus, tipus: v.tipus, irany: v.irany,
            vasalatSzin: v.vasalatSzin, vasalatEgyeb: v.vasalatEgyeb, szabadFal: v.szabadFal,
            fogantyu: !!v.fogantyu, megvezeto: !!v.megvezeto, szelesseg: v.szelesseg, magassag: v.magassag
        };
        d3Modul = d3Modul || import('./elonezet3d.js');
        d3Modul.then(function (m) { m.render(byId('elonezet3d'), o, { beallit: beallit3d }); }).catch(function () {
            byId('elonezet3d').textContent = 'A 3D előnézet most nem tölthető be. Az ajánlatkérést ez nem érinti.';
        });
    }
    // A 3D előnézetben választott értéket visszaírja a tervező mezőjébe (így az ajánlatkérésbe is bekerül).
    function beallit3d(nev, ertek) {
        var el = form.elements[nev];
        if (!el) { return; }
        if (el.length !== undefined && el[0] && el[0].type === 'radio') {
            var r = form.querySelector('input[name="' + nev + '"][value="' + ertek + '"]');
            if (!r) { return; }
            r.checked = true;
            r.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            el.value = ertek;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (S.step === TOTAL) { renderSummary(); renderIllesztes(); }
    }
    if (byId('d3Box')) { byId('d3Box').addEventListener('toggle', render3d); }

    if (byId('fiBox')) {
        byId('fiBox').addEventListener('toggle', renderIllesztes);
        byId('fiToStep2').addEventListener('click', function (e) {
            e.preventDefault();
            fromSummary = true;
            show(2, { push: true });
        });
    }

    /* ---------- Turnstile ---------- */
    function ensureTurnstile() {
        if (turnstileId !== null) { return; }
        var tries = 0;
        (function attempt() {
            if (turnstileId !== null) { return; }
            if (window.turnstile && typeof window.turnstile.render === 'function') {
                try {
                    turnstileId = window.turnstile.render('#tzTurnstile', { sitekey: TURNSTILE_SITEKEY, theme: 'dark' });
                } catch (e) { /* a küldéskor jelezzük */ }
                return;
            }
            if (tries++ < 60) { window.setTimeout(attempt, 300); }
        })();
    }

    function turnstileToken() {
        if (turnstileId === null || !window.turnstile) { return ''; }
        try { return window.turnstile.getResponse(turnstileId) || ''; } catch (e) { return ''; }
    }

    /* ---------- Küldés ---------- */
    var errorBox = byId('tzError');

    function showError(html) {
        errorBox.innerHTML = html;
        errorBox.classList.add('show');
        errorBox.focus();
    }

    function clearError() {
        errorBox.textContent = '';
        errorBox.classList.remove('show');
    }

    function phoneHint() {
        return ' Hívj minket: <a href="' + PHONE_HREF + '">' + PHONE_DISPLAY + '</a>.';
    }

    function buildJson() {
        var v = readForm();
        var num = function (s) { var n = Number(s); return isFinite(n) ? n : null; };
        var valaszok = {
            tipus: v.tipus || null,
            szelesseg_cm: num(v.szelesseg),
            magassag_cm: num(v.magassag),
            fal: v.fal || null,
            irany: v.irany || null,
            szabad_fal_cm: v.szabadFal !== '' ? num(v.szabadFal) : null,
            foto_db: photos.length,
            foto_kesobb: !!v.fotoKesobb && photos.length === 0,
            ajtolap: v.lap || null,
            ajtolap_leiras: v.lapLeiras.trim() || null,
            szin: v.szin || null,
            szin_egyeb: v.szin === 'egyeb' ? (v.szinEgyeb.trim() || null) : null,
            vasalat_tipus: v.vasalatTipus || null,
            vasalat_szin: v.vasalatSzin || null,
            vasalat_szin_egyeb: v.vasalatSzin === 'egyeb' ? (v.vasalatEgyeb.trim() || null) : null,
            fogantyu: !!v.fogantyu,
            lagy_zaras: !!v.lagyZaras,
            zar: !!v.zar,
            also_megvezeto: !!v.megvezeto,
            beszereles: v.beszereles || null,
            meret_felelosseg: !!v.felelos
        };
        var osszegzes = rows().map(function (r) { return { cimke: r.cimke, ertek: r.ertek }; });
        return JSON.stringify({ verzio: 1, valaszok: valaszok, osszegzes: osszegzes });
    }

    function finish() {
        finished = true;
        store.clear();
        byId('planner').hidden = true;
        byId('tzNav').hidden = true;
        var t = byId('tzThanks');
        t.hidden = false;
        window.scrollTo(0, 0);
        t.focus();
        try { history.replaceState(null, '', location.pathname); } catch (e) { /* nem baj */ }
    }

    async function send() {
        if (sending) { return; }
        clearError();
        if (!validateStep(2)) { show(2, { push: true, silent: true }); validateStep(2); return; }
        if (!validateStep(6)) { return; }
        var token = turnstileToken();
        if (!token) {
            showError('<strong>Egy pillanat.</strong> A robotvédelmi ellenőrzés még nem végzett. Várj egy kicsit, és nyomd meg újra az Elküldöm gombot.');
            return;
        }

        sending = true;
        var label = nextBtn.textContent;
        nextBtn.disabled = true;
        nextBtn.textContent = 'Küldés folyamatban…';

        var data = new FormData();
        data.append('forras', 'tervezo');
        data.append('nev', form.elements.nev.value.trim());
        data.append('email', form.elements.email.value.trim());
        data.append('telefon', form.elements.telefon.value.trim());
        data.append('uzenet', form.elements.megjegyzes.value.trim());
        data.append('igeny_json', buildJson());
        var shrunk = await Promise.all(photos.map(shrinkPhoto));
        shrunk.forEach(function (f) { data.append('fotok', f); });
        data.append('cf-turnstile-response', token);

        try {
            var res = await fetch('/api/igeny', { method: 'POST', body: data });
            var json = null;
            try { json = await res.json(); } catch (e) { /* nem JSON */ }
            if (res.ok && json && json.ok === true) {
                sending = false;
                finish();
                return;
            }
            var msg = (json && json.hiba) ? escapeHtml(json.hiba) : 'Valami elromlott, nem sikerült elküldeni.';
            showError('<strong>Nem sikerült elküldeni.</strong> ' + msg + phoneHint());
        } catch (e) {
            showError('<strong>Nem sikerült elküldeni.</strong> Nincs kapcsolat a szerverrel.' + phoneHint());
        }

        // Hiba: az adatok megmaradnak, a gomb újra él, friss Turnstile-token kell
        sending = false;
        nextBtn.disabled = false;
        nextBtn.textContent = label;
        if (window.turnstile && turnstileId !== null) {
            try { window.turnstile.reset(turnstileId); } catch (e) { /* nem baj */ }
        }
    }

    /* ---------- Események ---------- */
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (finished) { return; }
        if (S.step < TOTAL) {
            if (!validateStep(S.step)) { return; }
            show(fromSummary ? TOTAL : S.step + 1, { push: true });
        } else {
            send();
        }
    });

    backBtn.addEventListener('click', function () {
        if (S.step > 1) { show(S.step - 1, { push: true }); }
    });

    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);

    function onChange(e) {
        var t = e.target;
        if (t.id === 'fotok') { return; }
        if (t.id && byId(t.id + '-err')) { setErr(t.id, ''); }
        if (t.name === 'fotoKesobb') { setErr('fotok', ''); renderPhotos(); }
        if (t.name === 'szelesseg') { softHint('szelesseg', 40, 400); }
        if (t.name === 'magassag') { softHint('magassag', 150, 350); }
        if (t.name === 'szin' || t.name === 'vasalatSzin') {
            updateReveals();
        }
        if (t.name === 'felelos' && S.step === TOTAL) { renderSummary(); }
        save();
    }

    window.addEventListener('popstate', function (e) {
        if (finished) { return; }
        var n = (e.state && e.state.step) || stepFromHash() || 1;
        fromSummary = false;
        show(n, {});
    });

    /* ---------- Indulás ---------- */
    var saved = store.read();
    if (saved && saved.v) {
        S.fotoDb = saved.fotoDb || 0;
        applyState(saved);
    }
    updateReveals();
    softHint('szelesseg', 40, 400);
    softHint('magassag', 150, 350);
    renderPhotos();
    var startStep = stepFromHash() || (saved && saved.step) || 1;
    show(startStep, { replace: true, silent: true });
}());
