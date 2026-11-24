/* Közös választó a tervező két előnézetéhez (3D: elonezet3d.js, saját fotó: fotoillesztes.js).
 * - A választható értékek listája (VALASZTOK) és csoportjai: ajtólap és szín, a vasalat színe, valamint a csak
 *   a 3D nézethez tartozó szoba (fal, padló). Az előnézetekben csak anyag és szín választható; a geometria
 *   (elrendezés, irány, vasalattípus) és a méret csak a tervező lépéseiben változik (Zoli döntése, 2026-11-25).
 * - Felugró ablak: asztali gépen a pont mellett, 700 px alatt alulról felcsúszó panel (CSS: .d3-pop).
 * - Pontok (a tárgyakon ülő gombok, CSS: .d3-pont) és koppintásfelismerés (koppintás vs. húzás/forgatás).
 * Hagyományos szkript (window.Valaszto), mert a fotós rész is az; a 3D ES-modul innen olvassa. */
(function () {
    'use strict';

    var LAPOK = ['tomorfa', 'nyomatos', 'fem', 'antik', 'uveg', 'fem_uveg'];
    var VASSZIN_NEV = { fekete: 'Matt fekete', inox: 'Inox', bronz: 'Antik bronz', feher: 'Fehér' };
    var CSOP = { lap: 'Ajtólap és szín', vasalat: 'Vasalat színe' };

    function lapNev(o) { return LAPOK.indexOf(o.lap) >= 0 ? o.lap : 'tomorfa'; }
    function falbanE(o) { return o.vasalatTipus === 'falban' || o.tipus === 'falban'; }
    function vasSzinKulcs(o) {
        if (o.vasalatSzin !== 'egyeb') { return 'fekete'; }
        var t = String(o.vasalatEgyeb || '').toLowerCase();
        if (t.indexOf('inox') >= 0) { return 'inox'; }
        if (t.indexOf('bronz') >= 0) { return 'bronz'; }
        if (t.indexOf('fehér') >= 0 || t.indexOf('feher') >= 0) { return 'feher'; }
        return 'fekete';
    }

    // csop: melyik ponthoz (felugró ablakhoz) tartozik; mezo: a tervező mezőjének neve;
    // helyi: csak a 3D nézetet állítja (nem kerül az ajánlatkérésbe).
    var VALASZTOK = [
        { cim: 'Ajtólap', csop: 'lap', mezo: 'lap', opciok: [['tomorfa', 'Tömörfa'], ['nyomatos', 'Nyomatos'], ['fem', 'Fém'], ['antik', 'Antik'], ['uveg', 'Üveg'], ['fem_uveg', 'Fém keret üveggel']] },
        { cim: 'Szín', csop: 'lap', mezo: 'szin', opciok: [['natur_fa', 'Natúr fa'], ['pacolt_fa', 'Pácolt'], ['ral9016', 'Fehér'], ['ral9005', 'Fekete'], ['ral7016', 'Antracit'], ['ral7035', 'Világosszürke']],
          lathato: function (o) { return ['nyomatos', 'antik', 'uveg'].indexOf(lapNev(o)) < 0; } },
        // a vasalat színe csak pajtánál, mert csak ott látszik a vasalat
        { cim: 'Vasalat színe', csop: 'vasalat', mezo: 'vasSzin', opciok: Object.keys(VASSZIN_NEV).map(function (k) { return [k, VASSZIN_NEV[k]]; }),
          lathato: function (o) { return o.vasalatTipus === 'pajta'; } },
        { cim: 'Fal (csak a nézethez)', csop: 'szoba', mezo: 'fal3d', helyi: true, opciok: [['feher', 'Fehér'], ['bezs', 'Bézs'], ['szurke', 'Szürke'], ['sotet', 'Sötét'], ['tegla', 'Tégla']] },
        { cim: 'Padló (csak a nézethez)', csop: 'szoba', mezo: 'padlo3d', helyi: true, opciok: [['vilagos', 'Világos parketta'], ['sotet', 'Sötét parketta'], ['jarolap', 'Járólap']] }
    ];

    function csopSorai(k, o) {
        return VALASZTOK.filter(function (v) { return v.csop === k && (!v.lathato || v.lathato(o)); });
    }
    function aktivErtek(v, o, szoba) {
        switch (v.mezo) {
            case 'vasSzin': return vasSzinKulcs(o);
            case 'fal3d': return szoba && szoba.fal;
            case 'padlo3d': return szoba && szoba.padlo;
            case 'lap': return lapNev(o);
            default: return o[v.mezo];
        }
    }
    // Egy választás érvényesítése: o (a nézet állapota) frissül, a tervező mezői a beallit-on át.
    function alkalmaz(o, v, ertek, beallit) {
        function be(n, e) { o[n] = e; if (beallit) { beallit(n, e); } }
        if (v.mezo === 'vasSzin') {
            if (ertek === 'fekete') { be('vasalatSzin', 'matt_fekete'); }
            else { be('vasalatSzin', 'egyeb'); be('vasalatEgyeb', VASSZIN_NEV[ertek]); }
        } else {
            be(v.mezo, ertek);
        }
    }

    // Egy választósor (cím + gombok). valaszt(v, ertek) hívódik a gombra.
    function sorEl(v, o, szoba, valaszt) {
        var sor = document.createElement('div'); sor.className = 'd3-sor';
        var cim = document.createElement('span'); cim.className = 'd3-cim'; cim.textContent = v.cim;
        var gs = document.createElement('div'); gs.className = 'd3-chipek';
        gs.setAttribute('role', 'group'); gs.setAttribute('aria-label', v.cim);
        var aktiv = aktivErtek(v, o, szoba);
        v.opciok.forEach(function (op) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'd3-chip'; b.textContent = op[1];
            b.dataset.kulcs = v.mezo + ':' + op[0];
            b.setAttribute('aria-pressed', String(op[0] === aktiv));
            b.addEventListener('click', function () { valaszt(v, op[0]); });
            gs.appendChild(b);
        });
        sor.appendChild(cim); sor.appendChild(gs);
        return sor;
    }
    function fokuszKulcs(hol) { return hol.contains(document.activeElement) ? document.activeElement.dataset.kulcs : null; }
    function fokuszVissza(hol, kulcs) {
        if (!kulcs) { return; }
        var b = hol.querySelector('[data-kulcs="' + kulcs + '"]');
        if (b) { b.focus({ preventScroll: true }); }
    }
    // Sorok újrarajzolása egy tárolóban (pl. a 3D Továbbiak menüjében), a fókusz megtartásával.
    function sorokbaRajzol(hol, sorok, o, szoba, valaszt) {
        var f = fokuszKulcs(hol);
        hol.textContent = '';
        sorok.forEach(function (v) { hol.appendChild(sorEl(v, o, szoba, valaszt)); });
        fokuszVissza(hol, f);
    }

    /* ---------- Pontok ---------- */
    // Két „+” gomb a tárgyakon: ajtólap (anyag, szín) és vasalat (szín).
    function pontokLetrehoz(reteg, kattint) {
        var pontok = {};
        Object.keys(CSOP).forEach(function (k) {
            var b = document.createElement('button'); b.type = 'button';
            b.className = 'd3-pont'; b.textContent = '+'; b.hidden = true;
            b.setAttribute('aria-label', CSOP[k]); b.title = CSOP[k];
            b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
            b.addEventListener('click', function () { kattint(k, b); });
            reteg.appendChild(b); pontok[k] = b;
        });
        return pontok;
    }
    // Egy pont elhelyezése a rétegen (x, y: px a réteg bal felső sarkától); a képen kívül nem látszik.
    function pontHelyez(b, x, y, cw, ch, rejt) {
        var r = rejt || !isFinite(x) || !isFinite(y) || x < 12 || x > cw - 12 || y < 12 || y > ch - 12;
        if (b.hidden !== r) { b.hidden = r; }
        b.dataset.x = x.toFixed(1); b.dataset.y = y.toFixed(1);
        b.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px) translate(-50%, -50%)';
    }

    /* ---------- Koppintás: rövid, helyben maradó érintés vagy kattintás; húzás, forgatás, két ujj nem számít ---------- */
    var KOPP_PX = 6, KOPP_MS = 600;
    function koppintas(el, cb) {
        var ujjak = new Set(), le = null;
        el.addEventListener('pointerdown', function (e) {
            ujjak.add(e.pointerId);
            le = ujjak.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
        });
        function fel(e) {
            ujjak.delete(e.pointerId);
            var l = le; le = null;
            if (!l || e.type !== 'pointerup') { return; }
            if (Math.hypot(e.clientX - l.x, e.clientY - l.y) > KOPP_PX || performance.now() - l.t > KOPP_MS) { return; }
            cb(e);
        }
        el.addEventListener('pointerup', fel);
        el.addEventListener('pointercancel', fel);
    }

    /* ---------- Felugró választó ----------
       cfg: wrap (a pontok és az ablak szülője, position: relative), pontok (pontokLetrehoz eredménye),
            allapot() → { o, szoba }, valaszt(v, ertek), kepMeret() → { cw, ch } */
    var mobil = window.matchMedia('(max-width: 699px)');
    var nyitottak = [];
    document.addEventListener('pointerdown', function (e) {
        nyitottak.forEach(function (p) { p.kivulKattintas(e); });
    });
    function letrehoz(cfg) {
        var pop = document.createElement('div'); pop.className = 'd3-pop'; pop.hidden = true;
        pop.setAttribute('role', 'dialog');
        cfg.wrap.appendChild(pop);
        var csop = null;
        var api = {
            el: pop,
            nyitott: function () { return csop; },
            nyit: function (k) {
                var a = cfg.allapot();
                if (!csopSorai(k, a.o).length) { return; }
                if (csop && csop !== k) { cfg.pontok[csop].setAttribute('aria-expanded', 'false'); }
                csop = k;
                cfg.pontok[k].parentNode.classList.add('ismert');   // az első választás után már nem pulzálnak
                cfg.pontok[k].setAttribute('aria-expanded', 'true');
                api.frissit();
                pop.hidden = false;
                api.helyez();
                var elso = pop.querySelector('.d3-chip[aria-pressed="true"]') || pop.querySelector('.d3-chip');
                if (elso) { elso.focus({ preventScroll: true }); }
            },
            zar: function (fokusz) {
                if (!csop) { return; }
                var b = cfg.pontok[csop];
                b.setAttribute('aria-expanded', 'false');
                csop = null;
                pop.hidden = true;
                if (fokusz && !b.hidden) { b.focus({ preventScroll: true }); }
            },
            valt: function (k) { if (csop === k) { api.zar(true); } else { api.nyit(k); } },
            frissit: function () {
                if (!csop) { return; }
                var a = cfg.allapot(), sorok = csopSorai(csop, a.o);
                if (!sorok.length) { api.zar(false); return; }
                var f = fokuszKulcs(pop);
                pop.textContent = '';
                var fej = document.createElement('div'); fej.className = 'd3-pop-fej';
                var cim = document.createElement('span'); cim.className = 'd3-pop-cim'; cim.textContent = CSOP[csop];
                cim.id = 'vpCim' + Math.random().toString(36).slice(2, 8);
                var x = document.createElement('button'); x.type = 'button'; x.className = 'd3-pop-x'; x.textContent = '×';
                x.setAttribute('aria-label', 'Bezárás');
                x.addEventListener('click', function () { api.zar(true); });
                fej.appendChild(cim); fej.appendChild(x);
                pop.setAttribute('aria-labelledby', cim.id);
                pop.appendChild(fej);
                sorok.forEach(function (v) { pop.appendChild(sorEl(v, a.o, a.szoba, cfg.valaszt)); });
                fokuszVissza(pop, f);
            },
            helyez: function () {
                if (!csop || pop.hidden) { return; }
                if (mobil.matches) { pop.style.left = ''; pop.style.top = ''; return; }
                var b = cfg.pontok[csop], m = cfg.kepMeret();
                var pw = pop.offsetWidth, ph = pop.offsetHeight;
                var px = b.dataset.x ? Number(b.dataset.x) : m.cw / 2, py = b.dataset.y ? Number(b.dataset.y) : m.ch / 2;
                var x = px + 30;
                if (x + pw > m.cw - 8) { x = px - 30 - pw; }      // jobbra nem fér el: a pont bal oldalára
                x = Math.max(8, Math.min(m.cw - pw - 8, x));
                var y = Math.max(8, Math.min(Math.max(8, m.ch - ph - 8), py - ph / 2));
                pop.style.left = x + 'px'; pop.style.top = y + 'px';
            },
            kivulKattintas: function (e) {
                if (!csop || pop.contains(e.target) || cfg.pontok[csop].parentNode.contains(e.target)) { return; }
                api.zar(false);
            }
        };
        pop.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); api.zar(true); } });
        nyitottak.push(api);
        return api;
    }

    window.Valaszto = {
        VALASZTOK: VALASZTOK, CSOP: CSOP, VASSZIN_NEV: VASSZIN_NEV,
        lapNev: lapNev, falbanE: falbanE, vasSzinKulcs: vasSzinKulcs,
        csopSorai: csopSorai, alkalmaz: alkalmaz, sorokbaRajzol: sorokbaRajzol,
        pontokLetrehoz: pontokLetrehoz, pontHelyez: pontHelyez, koppintas: koppintas, letrehoz: letrehoz
    };
})();
