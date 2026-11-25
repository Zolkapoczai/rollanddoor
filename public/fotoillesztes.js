/* Fotóillesztés a tervezőben: az ügyfél a saját falfotóján megjelöli a nyílás 4 sarkát,
 * és a választott ajtó (anyag, szín, vasalat, elrendezés) perspektívahelyesen rákerül.
 * Szemléltetés, nem látványterv. A fotó és a sarkok nem hagyják el a böngészőt.
 * Használat: FotoIllesztes.render(tárolóElem, File, {lap, szin, vasalatTipus, tipus, irany, fogantyu}) */
(function () {
    'use strict';

    var TEXTURA = { tomorfa: 'tomorfa', fem: 'fem', nyomatos: 'nyomatos', antik: 'antik' };
    var FESTETT = { ral9016: '#eeede6', ral9005: '#111214', ral7016: '#383e42', ral7035: '#c5c7c4' };
    // vasalatszín: [sín és pánt, görgő, görgő éle]
    var VASSZIN = { fekete: ['#141414', '#1c1c1c', '#3a3a3a'], inox: ['#aeb3b8', '#c4c8cc', '#7d8287'], bronz: ['#5e3f25', '#6e4b2c', '#3a2716'], feher: ['#e8e7e2', '#f1f0ec', '#a9a8a2'] };
    var texCache = {};
    var state = null; // { file, url, img, sarok:[{x,y}×4] (képpixelben), opts, ... }

    function loadImg(src) {
        return new Promise(function (ok, fail) {
            var im = new Image();
            im.onload = function () { ok(im); };
            im.onerror = fail;
            im.src = src;
        });
    }
    function textura(nev) {
        if (!texCache[nev]) { texCache[nev] = loadImg('img/illesztes/' + nev + '.webp'); }
        return texCache[nev];
    }

    /* ---------- Perspektíva: homográfia az egységnégyzetről egy négyszögre ---------- */
    function homografia(q) { // q: [TL, TR, BR, BL]
        var x0 = q[0].x, y0 = q[0].y, x1 = q[1].x, y1 = q[1].y, x2 = q[2].x, y2 = q[2].y, x3 = q[3].x, y3 = q[3].y;
        var dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
        var sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
        var g = 0, h = 0, den = dx1 * dy2 - dx2 * dy1;
        if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
            g = (sx * dy2 - dx2 * sy) / den;
            h = (dx1 * sy - sx * dy1) / den;
        }
        var a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
        return function (u, v) {
            var w = g * u + h * v + 1;
            return { x: (a * u + b * v + x0) / w, y: (d * u + e * v + y0) / w };
        };
    }

    // Kép rajzolása négyszögbe: rács, cellánként két háromszög affin leképezéssel.
    function kepNegyszogbe(ctx, img, H, u0, v0, u1, v1, sx0, sy0, sx1, sy1, n) {
        var pts = [];
        for (var j = 0; j <= n; j++) {
            pts.push([]);
            for (var i = 0; i <= n; i++) {
                pts[j].push(H(u0 + (u1 - u0) * i / n, v0 + (v1 - v0) * j / n));
            }
        }
        var cw = (sx1 - sx0) / n, ch = (sy1 - sy0) / n;
        for (j = 0; j < n; j++) {
            for (i = 0; i < n; i++) {
                var sx = sx0 + i * cw, sy = sy0 + j * ch;
                haromszog(ctx, img, pts[j][i], pts[j][i + 1], pts[j + 1][i], sx, sy, sx + cw, sy, sx, sy + ch);
                haromszog(ctx, img, pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i], sx + cw, sy, sx + cw, sy + ch, sx, sy + ch);
            }
        }
    }
    function haromszog(ctx, img, p0, p1, p2, s0x, s0y, s1x, s1y, s2x, s2y) {
        // kicsit kifelé tolt vágás, hogy ne látszódjanak hajszálrések a háromszögek között
        var cx = (p0.x + p1.x + p2.x) / 3, cy = (p0.y + p1.y + p2.y) / 3;
        function ki(p) { var dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1; return { x: p.x + dx / l * 0.7, y: p.y + dy / l * 0.7 }; }
        var a = ki(p0), b = ki(p1), c = ki(p2);
        ctx.save();
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath(); ctx.clip();
        var den = s0x * (s1y - s2y) + s1x * (s2y - s0y) + s2x * (s0y - s1y);
        if (Math.abs(den) < 1e-9) { ctx.restore(); return; }
        var m11 = (p0.x * (s1y - s2y) + p1.x * (s2y - s0y) + p2.x * (s0y - s1y)) / den;
        var m12 = (p0.x * (s2x - s1x) + p1.x * (s0x - s2x) + p2.x * (s1x - s0x)) / den;
        var m13 = (p0.x * (s1x * s2y - s2x * s1y) + p1.x * (s2x * s0y - s0x * s2y) + p2.x * (s0x * s1y - s1x * s0y)) / den;
        var m21 = (p0.y * (s1y - s2y) + p1.y * (s2y - s0y) + p2.y * (s0y - s1y)) / den;
        var m22 = (p0.y * (s2x - s1x) + p1.y * (s0x - s2x) + p2.y * (s1x - s0x)) / den;
        var m23 = (p0.y * (s1x * s2y - s2x * s1y) + p1.y * (s2x * s0y - s0x * s2y) + p2.y * (s0x * s1y - s1x * s0y)) / den;
        ctx.transform(m11, m21, m12, m22, m13, m23);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
    }
    // Egységnégyzet-beli téglalap → négyszög útvonal (perspektívahelyes)
    function negyszog(ctx, H, u0, v0, u1, v1) {
        var a = H(u0, v0), b = H(u1, v0), c = H(u1, v1), d = H(u0, v1);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    }
    function kor(ctx, H, u, v, ru, rv) {
        ctx.beginPath();
        for (var k = 0; k <= 24; k++) {
            var t = k / 24 * Math.PI * 2, p = H(u + Math.cos(t) * ru, v + Math.sin(t) * rv);
            if (k === 0) { ctx.moveTo(p.x, p.y); } else { ctx.lineTo(p.x, p.y); }
        }
        ctx.closePath();
    }

    /* ---------- Az ajtó megrajzolása ---------- */
    // Lapok az egységnégyzetben (u: 0 = nyílás bal széle, 1 = jobb széle; v: 0 = nyílás teteje, 1 = padló)
    function lapok(o) {
        var L = -0.06, R = 1.06, T = -0.035;
        var park = o.irany === 'jobbra' ? 'jobb' : 'bal';
        if (o.vasalatTipus === 'falban' || o.tipus === 'falban') {
            // félig nyitva, a lap a zseb felőli oldalon a nyílás közepéig látszik
            return { falban: true, park: park, lapok: park === 'bal' ? [[0, 0, 0.5, 1, 'jobb']] : [[0.5, 0, 1, 1, 'bal']] };
        }
        if (o.tipus === 'ketszarnyu') {
            return { park: 'mindket', lapok: [[L, T, 0.5, 1, 'jobb'], [0.5, T, R, 1, 'bal']] };
        }
        if (o.tipus === 'bypass') {
            // egymás előtt futó: két lap középen átfedéssel, az elülső (a nyitás felőli) rajzolódik utoljára
            var hatso = park === 'bal' ? [L, T, 0.56, 1, 'jobb'] : [0.44, T, R, 1, 'bal'];
            var elso = park === 'bal' ? [0.44, T, R, 1, 'bal'] : [L, T, 0.56, 1, 'jobb'];
            return { park: park, lapok: [hatso, elso] };
        }
        return { park: park, lapok: [[L, T, R, 1, park === 'bal' ? 'jobb' : 'bal']] };
    }

    function ajto(ctx, Hn, o, tex, durva) {
        var t = lapok(o);
        var n = durva ? 6 : 14;
        var lap = TEXTURA[o.lap] ? o.lap : (o.lap === 'uveg' || o.lap === 'fem_uveg' ? o.lap : 'tomorfa');
        var festett = (lap === 'tomorfa' || lap === 'fem' || lap === 'fem_uveg') && FESTETT[o.szin];
        t.lapok.forEach(function (l) {
            var u0 = l[0], v0 = l[1], u1 = l[2], v1 = l[3];
            // lebegő: lágy árnyék a lap mögött
            if (o.vasalatTipus === 'lebego') {
                ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.filter = 'blur(6px)';
                negyszog(ctx, Hn, u0 + 0.015, v0 + 0.012, u1 + 0.015, v1 - 0.005); ctx.fill(); ctx.restore();
            }
            if (lap === 'uveg' || lap === 'fem_uveg') {
                negyszog(ctx, Hn, u0, v0, u1, v1);
                ctx.fillStyle = 'rgba(214,228,232,0.38)'; ctx.fill();
                var kozep = Hn((u0 + u1) / 2, (v0 + v1) / 2), fent = Hn(u0, v0);
                var gr = ctx.createLinearGradient(fent.x, fent.y, kozep.x, kozep.y);
                gr.addColorStop(0, 'rgba(255,255,255,0.28)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = gr; ctx.fill();
                var keret = lap === 'fem_uveg' ? (festett || '#151515') : 'rgba(40,40,40,0.55)';
                var k = lap === 'fem_uveg' ? 0.035 : 0.012;
                ctx.fillStyle = keret;
                var bw = k, bh = k * 0.45;
                [[u0, v0, u1, v0 + bh], [u0, v1 - bh, u1, v1], [u0, v0, u0 + bw, v1], [u1 - bw, v0, u1, v1]].forEach(function (r) {
                    negyszog(ctx, Hn, r[0], r[1], r[2], r[3]); ctx.fill();
                });
                if (lap === 'fem_uveg') {
                    [0.33, 0.66].forEach(function (y) { var vv = v0 + (v1 - v0) * y; negyszog(ctx, Hn, u0, vv - bh / 2, u1, vv + bh / 2); ctx.fill(); });
                }
            } else if (tex) {
                kepNegyszogbe(ctx, tex, Hn, u0, v0, u1, v1, 0, 0, tex.naturalWidth, tex.naturalHeight, n);
                if (festett) { negyszog(ctx, Hn, u0, v0, u1, v1); ctx.fillStyle = festett; ctx.globalAlpha = 0.84; ctx.fill(); ctx.globalAlpha = 1; }
                if (o.szin === 'pacolt_fa' && lap === 'tomorfa') {
                    negyszog(ctx, Hn, u0, v0, u1, v1); ctx.globalCompositeOperation = 'multiply';
                    ctx.fillStyle = 'rgba(92,54,28,0.75)'; ctx.fill(); ctx.globalCompositeOperation = 'source-over';
                }
            }
            // a fotó fényéhez: enyhe sötétítés és élvonal
            negyszog(ctx, Hn, u0, v0, u1, v1);
            ctx.fillStyle = 'rgba(0,0,0,' + o.sotetit.toFixed(2) + ')'; ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
            // fogantyú az elülső élen
            if (o.fogantyu) {
                var fu = l[4] === 'jobb' ? u1 - 0.07 : u0 + 0.05;
                negyszog(ctx, Hn, fu, v0 + 0.45, fu + 0.02, v0 + 0.6);
                ctx.fillStyle = '#121212'; ctx.fill();
            }
        });
        // látszó sín és görgők (pajta), a vasalat választott színével
        var sin = sinTeglalap(o, t);
        if (sin) {
            var vs = VASSZIN[window.Valaszto ? window.Valaszto.vasSzinKulcs(o) : 'fekete'] || VASSZIN.fekete;
            ctx.fillStyle = vs[0];
            negyszog(ctx, Hn, sin[0], -0.085, sin[1], -0.06); ctx.fill();
            t.lapok.forEach(function (l) {
                [l[0] + 0.12, l[2] - 0.12].forEach(function (u) {
                    negyszog(ctx, Hn, u - 0.022, -0.1, u + 0.022, 0.07); ctx.fillStyle = vs[0]; ctx.fill();
                    kor(ctx, Hn, u, -0.1, 0.05, 0.022); ctx.fillStyle = vs[1]; ctx.fill();
                    ctx.strokeStyle = vs[2]; ctx.lineWidth = 1; ctx.stroke();
                });
            });
        }
    }
    // A pajtasín vízszintes kiterjedése az egységnégyzetben [bal, jobb], vagy null, ha nincs látszó sín.
    function sinTeglalap(o, t) {
        if (o.vasalatTipus !== 'pajta' || t.falban) { return null; }
        return [t.park === 'bal' || t.park === 'mindket' ? -1.2 : -0.1, t.park === 'jobb' || t.park === 'mindket' ? 2.2 : 1.1];
    }

    /* ---------- Pontok a fotón (ajtólap, vasalat színe) és koppintás a lapra vagy a sínre ---------- */
    // A pontok helye az egységnégyzetben (u, v), a rajzolt ajtóhoz igazítva.
    function pontHelyek(o) {
        var t = lapok(o), elso = t.lapok[t.lapok.length - 1];
        var lu = (elso[0] + elso[2]) / 2;
        // a sarokpöttyöktől (u, v = 0 vagy 1) távol, hogy keskeny nyílásnál se torlódjanak
        // a vasalat pontja csak pajtánál látszik: a sín nyílás melletti, kinyúló részén
        return { lap: [lu, 0.45], vasalat: [t.park === 'jobb' ? 1.35 : -0.35, -0.073] };
    }
    function bentVan(p, q) { // p pont a q négyszögben (konvex vagy nem, páros-páratlan szabály)
        var bent = false;
        for (var i = 0, j = q.length - 1; i < q.length; j = i++) {
            if ((q[i].y > p.y) !== (q[j].y > p.y) && p.x < (q[j].x - q[i].x) * (p.y - q[i].y) / (q[j].y - q[i].y) + q[i].x) { bent = !bent; }
        }
        return bent;
    }
    function talalat(e) {
        if (!state.img || state.rejt) { return null; }
        var r = state.cv.getBoundingClientRect(), p = { x: e.clientX - r.left, y: e.clientY - r.top };
        var Hc = homografia(state.sarok.map(function (s) { return { x: s.x * state.k, y: s.y * state.k }; }));
        var o = state.opts, t = lapok(o), sin = sinTeglalap(o, t);
        function sarkok(u0, v0, u1, v1) { return [Hc(u0, v0), Hc(u1, v0), Hc(u1, v1), Hc(u0, v1)]; }
        if (sin && bentVan(p, sarkok(sin[0], -0.13, sin[1], -0.05))) { return 'vasalat'; }
        for (var i = t.lapok.length - 1; i >= 0; i--) {
            var l = t.lapok[i];
            if (bentVan(p, sarkok(l[0], l[1], l[2], l[3]))) { return 'lap'; }
        }
        return null;
    }
    function pontokHelyez(m) {
        var V = window.Valaszto;
        if (!V || !state.pontok) { return; }
        var Hc = homografia(state.sarok.map(function (s) { return { x: s.x * m.k, y: s.y * m.k }; }));
        var hely = pontHelyek(state.opts);
        Object.keys(state.pontok).forEach(function (k) {
            var b = state.pontok[k];
            var nincs = state.rejt || !V.csopSorai(k, state.opts).length;
            var p = Hc(hely[k][0], hely[k][1]);
            V.pontHelyez(b, p.x, p.y, m.cssW, m.cssH, nincs);
        });
        state.vp.helyez();
    }
    function valaszt(v, ertek) {
        window.Valaszto.alkalmaz(state.opts, v, ertek, state.api && state.api.beallit);
        if (!(state.api && state.api.beallit)) { rajzol(false); state.vp.frissit(); }
    }

    /* ---------- Felület ---------- */
    // api.beallit(mezo, ertek): a pontokon választott érték visszaírása a tervező mezőjébe
    function render(box, file, opts, api) {
        if (!file) { box.hidden = true; return; }
        box.hidden = false;
        if (!state || state.file !== file) {
            if (state && state.url) { URL.revokeObjectURL(state.url); }
            state = { file: file, url: URL.createObjectURL(file), img: null, sarok: null };
            epit(box);
        }
        state.opts = opts;
        state.api = api || state.api;
        var lapNev = TEXTURA[opts.lap] ? opts.lap : 'tomorfa';
        Promise.all([state.img ? Promise.resolve(state.img) : loadImg(state.url), textura(lapNev)]).then(function (r) {
            state.img = r[0];
            state.tex = r[1];
            if (!state.sarok) {
                var W = state.img.naturalWidth, H = state.img.naturalHeight;
                var w = W * 0.26, h = H * 0.6, x = (W - w) / 2, y = H * 0.22;
                state.sarok = [{ x: x, y: y }, { x: x + w, y: y }, { x: x + w, y: y + h }, { x: x, y: y + h }];
            }
            rajzol(false);
            if (state.vp) { state.vp.frissit(); }
        }).catch(function () {
            box.querySelector('.fi-msg').textContent = 'Ezt a képet nem tudjuk itt megjeleníteni. Az ajánlatkérést ez nem érinti.';
        });
    }

    function epit(box) {
        box.textContent = '';
        var p = document.createElement('p');
        p.className = 'fi-help';
        p.textContent = 'Húzd a 4 számozott pöttyöt a nyílás 4 sarkára (a padlónál is). Az ajtó a választásaid szerint rákerül a fotódra; a „+” pontokra koppintva anyagot és színt válthatsz.';
        var wrap = document.createElement('div');
        wrap.className = 'fi-wrap';
        var cv = document.createElement('canvas');
        cv.className = 'fi-canvas';
        cv.setAttribute('role', 'img');
        cv.setAttribute('aria-label', 'A fotód a rárajzolt ajtóval');
        wrap.appendChild(cv);
        // választópontok (a sarokpöttyök alatt, hogy a húzás mindig elsőbbséget kapjon)
        var V = window.Valaszto;
        if (V) {
            var reteg = document.createElement('div');
            reteg.className = 'd3-pontok';
            wrap.appendChild(reteg);
            state.pontok = V.pontokLetrehoz(reteg, function (k) { state.vp.valt(k); });
            state.vp = V.letrehoz({
                wrap: wrap, pontok: state.pontok,
                allapot: function () { return { o: state.opts, szoba: null }; },
                valaszt: valaszt,
                kepMeret: function () { var m = meret(); return { cw: m.cssW, ch: m.cssH }; }
            });
            V.koppintas(cv, function (e) { var k = talalat(e); if (k) { state.vp.nyit(k); } });
            cv.addEventListener('pointermove', function (e) {
                if (e.pointerType === 'mouse' && !e.buttons) { cv.style.cursor = talalat(e) ? 'pointer' : ''; }
            });
        }
        var nevek = ['bal felső', 'jobb felső', 'jobb alsó', 'bal alsó'];
        var fogok = nevek.map(function (nev, i) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'fi-pont';
            b.setAttribute('aria-label', 'A nyílás ' + nev + ' sarka. Nyilakkal mozgatható.');
            b.textContent = String(i + 1);
            wrap.appendChild(b);
            huzhato(b, i);
            return b;
        });
        var gombok = document.createElement('div');
        gombok.className = 'fi-btns';
        var mutat = document.createElement('button');
        mutat.type = 'button';
        mutat.className = 'btn-primary btn-outline fi-btn';
        mutat.textContent = 'Csak a fotó';
        mutat.setAttribute('aria-pressed', 'false');
        mutat.addEventListener('click', function () {
            state.rejt = !state.rejt;
            mutat.setAttribute('aria-pressed', String(!!state.rejt));
            mutat.textContent = state.rejt ? 'Ajtó mutatása' : 'Csak a fotó';
            if (state.rejt && state.vp) { state.vp.zar(false); }
            rajzol(false);
        });
        var ment = document.createElement('button');
        ment.type = 'button';
        ment.className = 'btn-primary btn-outline fi-btn';
        ment.textContent = 'Kép mentése';
        ment.addEventListener('click', mentes);
        gombok.appendChild(mutat);
        gombok.appendChild(ment);
        var note = document.createElement('p');
        note.className = 'pic-note';
        note.textContent = 'Szemléltető kép. A pontos látványtervet megrendelés után kapod. A fotód csak a te gépeden marad, ehhez a képhez nem küldjük el.';
        var msg = document.createElement('p');
        msg.className = 'fi-msg';
        msg.setAttribute('role', 'status');
        box.appendChild(p); box.appendChild(wrap); box.appendChild(gombok); box.appendChild(msg); box.appendChild(note);
        state.cv = cv; state.wrap = wrap; state.fogok = fogok;
        if (window.ResizeObserver) { new ResizeObserver(function () { if (state.img) { rajzol(false); } }).observe(wrap); }
    }

    function meret() {
        var W = state.img.naturalWidth, H = state.img.naturalHeight;
        var cssW = state.wrap.clientWidth || 600;
        var cssH = Math.min(cssW * H / W, window.innerHeight * 0.75);
        cssW = cssH * W / H;
        return { W: W, H: H, cssW: cssW, cssH: cssH, k: cssW / W };
    }

    function rajzol(durva, cel) {
        var m = meret();
        var cv = cel || state.cv;
        var dpr = cel ? 1 : Math.min(window.devicePixelRatio || 1, 2);
        var skala = cel ? 1 : m.k * dpr;
        if (!cel) {
            cv.style.width = m.cssW + 'px'; cv.style.height = m.cssH + 'px';
            var bw = Math.round(m.cssW * dpr), bh = Math.round(m.cssH * dpr);
            if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
        }
        var ctx = cv.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(state.img, 0, 0, cv.width, cv.height);
        var q = state.sarok.map(function (p) { return { x: p.x * skala, y: p.y * skala }; });
        if (!state.rejt) {
            var o = Object.assign({ sotetit: sotetites(ctx, cv) }, state.opts);
            if (durva) { ctx.globalAlpha = 0.75; }
            ajto(ctx, homografia(q), o, state.tex, durva);
            ctx.globalAlpha = 1;
        }
        if (!cel) {
            state.fogok.forEach(function (b, i) {
                b.style.left = (state.sarok[i].x * m.k) + 'px';
                b.style.top = (state.sarok[i].y * m.k) + 'px';
            });
            state.wrap.style.width = m.cssW + 'px';
            state.wrap.style.height = m.cssH + 'px';
            state.k = m.k;
            pontokHelyez(m);
        }
    }

    // A fotó átlagos világossága alapján az ajtó kicsit sötétebb lesz egy sötét fotón (egyszer számoljuk).
    function sotetites(ctx, cv) {
        if (state.sot == null) {
            try {
                var d = ctx.getImageData(0, 0, cv.width, cv.height).data, s = 0, n = 0;
                for (var i = 0; i < d.length; i += 4 * 97) { s += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
                var atlag = s / n;
                state.sot = Math.max(0, Math.min(0.45, (150 - atlag) / 220));
            } catch (e) { state.sot = 0.1; }
        }
        return state.sot;
    }

    function huzhato(b, i) {
        var huz = false, raf = 0;
        function poz(e) {
            var r = state.wrap.getBoundingClientRect(), m = meret();
            state.sarok[i] = {
                x: Math.max(0, Math.min(m.W, (e.clientX - r.left) / m.k)),
                y: Math.max(0, Math.min(m.H, (e.clientY - r.top) / m.k))
            };
            if (!raf) { raf = requestAnimationFrame(function () { raf = 0; rajzol(true); }); }
        }
        b.addEventListener('pointerdown', function (e) {
            huz = true; b.classList.add('fogva'); e.preventDefault();
            try { b.setPointerCapture(e.pointerId); } catch (err) { /* nem baj */ }
        });
        b.addEventListener('pointermove', function (e) { if (huz) { poz(e); } });
        function vege() {
            if (!huz) { return; }
            huz = false; b.classList.remove('fogva');
            if (raf) { cancelAnimationFrame(raf); raf = 0; } // a függő, áttetsző húzás-kép ne írja felül
            rajzol(false);
        }
        b.addEventListener('pointerup', vege);
        b.addEventListener('pointercancel', vege);
        b.addEventListener('keydown', function (e) {
            var m = meret(), d = (e.shiftKey ? 10 : 2) / m.k;
            var dx = { ArrowLeft: -d, ArrowRight: d }[e.key] || 0, dy = { ArrowUp: -d, ArrowDown: d }[e.key] || 0;
            if (!dx && !dy) { return; }
            e.preventDefault();
            state.sarok[i] = { x: state.sarok[i].x + dx, y: state.sarok[i].y + dy };
            rajzol(false);
        });
    }

    function mentes() {
        var c = document.createElement('canvas');
        var W = state.img.naturalWidth, H = state.img.naturalHeight, k = Math.min(1, 1600 / Math.max(W, H));
        c.width = Math.round(W * k); c.height = Math.round(H * k);
        var regi = state.sarok;
        state.sarok = regi.map(function (p) { return { x: p.x * k, y: p.y * k }; });
        var img = state.img;
        rajzol(false, c);
        state.sarok = regi;
        c.toBlob(function (blob) {
            if (!blob) { return; }
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'rollndoor-ajto-a-falamon.jpg';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        }, 'image/jpeg', 0.9);
        return img;
    }

    window.FotoIllesztes = { render: render };
})();
