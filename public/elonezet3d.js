/* 3D előnézet a tervezőben: a választásokból (méret, elrendezés, ajtólap, szín, vasalat, irány, fogantyú)
 * egy valósághű, körbeforgatható jelenet; az ajtó gombra kinyílik. Szemléltetés, nem látványterv.
 * three.js (MIT) + RoomEnvironment + OrbitControls: public/vendor/three/three.bundle.min.js.
 * Ezt a modult a tervezo.js csak a „Nézd meg 3D-ben” doboz kinyitásakor tölti be. */
import * as THREE from './vendor/three/three.bundle.min.js';

const TEX = { tomorfa: 'tomorfa', fem: 'fem', nyomatos: 'nyomatos', antik: 'antik' };
const FESTETT = { ral9016: 0xeeede6, ral9005: 0x17181a, ral7016: 0x383e42, ral7035: 0xc5c7c4 };
const FAL_V = 0.15;      // falvastagság (m)
const LAP_V = 0.04;      // ajtólap-vastagság (m)
const texCache = {};
let st = null;           // egyetlen nézet a lapon

/* ---------- Textúrák ---------- */
function textura(nev) {
    if (!texCache[nev]) {
        texCache[nev] = new THREE.TextureLoader().loadAsync('img/illesztes/' + nev + '.webp').then((t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 8;
            return t;
        });
    }
    return texCache[nev];
}

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// Tölgy parketta (hosszú hajópadló-deszkák), canvasra rajzolva: 1 kép = 2 × 2 m
function parketta() {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const x = c.getContext('2d'), r = rnd(7);
    const deszkaSz = 1024 / 11, deszkaH = 1024 / 1.6;
    for (let i = 0; i < 11; i++) {
        let y = -r() * deszkaH;
        while (y < 1024) {
            const t = 168 + r() * 30, g = t - 28 - r() * 10, b = t - 70 - r() * 12;
            x.fillStyle = `rgb(${t | 0},${g | 0},${b | 0})`;
            x.fillRect(i * deszkaSz, y, deszkaSz, deszkaH);
            for (let k = 0; k < 7; k++) { // erezet
                x.strokeStyle = `rgba(90,60,30,${0.06 + r() * 0.08})`;
                x.lineWidth = 1 + r() * 1.5;
                const ox = i * deszkaSz + r() * deszkaSz;
                x.beginPath(); x.moveTo(ox, y); x.bezierCurveTo(ox + 6, y + deszkaH / 3, ox - 6, y + deszkaH * 2 / 3, ox + r() * 4, y + deszkaH); x.stroke();
            }
            x.fillStyle = 'rgba(40,25,10,0.55)'; x.fillRect(i * deszkaSz, y, deszkaSz, 2); // deszkavég
            y += deszkaH;
        }
        x.fillStyle = 'rgba(40,25,10,0.5)'; x.fillRect(i * deszkaSz, 0, 2, 1024); // hosszanti hézag
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
}

// Finom vakolat-zaj a falra (érdesség-érzet)
function vakolat() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), d = x.createImageData(256, 256), r = rnd(3);
    for (let i = 0; i < d.data.length; i += 4) { const v = 236 + r() * 19; d.data[i] = v; d.data[i + 1] = v - 3; d.data[i + 2] = v - 8; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

/* ---------- Segédek ---------- */
function mesh(geo, mat, arnyek = true) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = arnyek; m.receiveShadow = true;
    return m;
}
const box = (w, h, d, mat) => mesh(new THREE.BoxGeometry(w, h, d), mat);
function henger(r, h, mat, seg = 24) { return mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); }

// Lekerekített élű lap: elülső/hátsó lapon a textúra 0..1-re feszítve
function lapGeo(w, h, d, bev = 0.004) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + bev, 0); s.lineTo(w / 2 - bev, 0); s.lineTo(w / 2 - bev, h); s.lineTo(-w / 2 + bev, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 4 });
    g.translate(0, 0, -(d - 2 * bev) / 2);
    // UV: x,y méterben → 0..1
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, pos.getY(i) / h);
    return g;
}

/* ---------- Anyagok ---------- */
function anyagok(o, tex) {
    const lap = TEX[o.lap] || (o.lap === 'uveg' || o.lap === 'fem_uveg' ? o.lap : 'tomorfa');
    const festett = FESTETT[o.szin];
    const vas = new THREE.MeshPhysicalMaterial({ color: 0x1b1b1c, metalness: 0.85, roughness: 0.42, clearcoat: 0.2 });
    const res = { lap, vas };
    if (lap === 'uveg' || lap === 'fem_uveg') {
        res.uveg = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.04, thickness: 0.01, ior: 1.5, metalness: 0, transparent: true });
        res.keret = lap === 'fem_uveg'
            ? new THREE.MeshPhysicalMaterial({ color: festett ?? 0x161616, metalness: festett ? 0.2 : 0.7, roughness: 0.45, clearcoat: 0.3 })
            : new THREE.MeshPhysicalMaterial({ color: 0xb9bcbf, metalness: 0.9, roughness: 0.3 });
        return res;
    }
    let m;
    if (festett && (lap === 'tomorfa' || lap === 'fem')) {
        m = new THREE.MeshPhysicalMaterial({ color: festett, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, bumpMap: tex, bumpScale: lap === 'tomorfa' ? 0.6 : 0.2 });
    } else if (lap === 'fem') {
        m = new THREE.MeshPhysicalMaterial({ map: tex, metalness: 0.75, roughness: 0.38, bumpMap: tex, bumpScale: 0.4 });
    } else if (lap === 'nyomatos') {
        m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    } else if (lap === 'antik') {
        m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.82, bumpMap: tex, bumpScale: 2.2 });
    } else { // tömörfa, lakkozva
        m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.35, bumpMap: tex, bumpScale: 0.8 });
        if (o.szin === 'pacolt_fa') m.color.setHex(0x7d5233);
    }
    res.lapM = m;
    res.elM = new THREE.MeshPhysicalMaterial({ color: m.map ? 0x5a3d26 : m.color, roughness: 0.6 });
    if (lap === 'fem' && !festett) res.elM = new THREE.MeshPhysicalMaterial({ color: 0x8d9094, metalness: 0.8, roughness: 0.4 });
    return res;
}

/* ---------- Ajtólap ---------- */
// Középpont (0, h/2, 0); szemből a +z oldal látszik. fog: a fogantyú oldala ('bal' | 'jobb' | null)
function ajtolap(w, h, a, fog, perem) {
    const g = new THREE.Group();
    if (a.uveg) {
        const u = mesh(new THREE.BoxGeometry(w - 0.02, h - 0.02, 0.008), a.uveg, false);
        u.position.y = h / 2; g.add(u);
        const k = a.lap === 'fem_uveg' ? 0.045 : 0.022, kd = a.lap === 'fem_uveg' ? 0.04 : 0.03;
        [[w, k, 0, h - k / 2], [w, k, 0, k / 2], [k, h, -w / 2 + k / 2, h / 2], [k, h, w / 2 - k / 2, h / 2]].forEach(([bw, bh, x, y]) => {
            const b = box(bw, bh, kd, a.keret); b.position.set(x, y, 0); g.add(b);
        });
        if (a.lap === 'fem_uveg') {
            [h / 3, 2 * h / 3].forEach((y) => { const b = box(w, 0.03, kd * 0.8, a.keret); b.position.set(0, y, 0); g.add(b); });
            const v = box(0.03, h, kd * 0.8, a.keret); v.position.set(0, h / 2, 0); g.add(v);
        }
    } else {
        const l = mesh(lapGeo(w, h, LAP_V), [a.lapM, a.elM]);
        g.add(l);
    }
    if (fog) {
        const x = fog === 'jobb' ? w / 2 - 0.08 : -w / 2 + 0.08;
        if (perem) { // falban futó: süllyesztett kagylófogantyú
            [1, -1].forEach((s) => { const f = box(0.03, 0.14, 0.004, a.vas); f.position.set(x, h * 0.48, s * (LAP_V / 2 + 0.001)); g.add(f); });
        } else { // rúdfogantyú két távtartóval, mindkét oldalon
            [1, -1].forEach((s) => {
                const rud = henger(0.011, 0.34, a.vas); rud.position.set(x, h * 0.48, s * (LAP_V / 2 + 0.042)); g.add(rud);
                [-0.13, 0.13].forEach((dy) => {
                    const t = henger(0.008, 0.04, a.vas); t.rotation.x = Math.PI / 2; t.position.set(x, h * 0.48 + dy, s * (LAP_V / 2 + 0.021)); g.add(t);
                });
            });
        }
    }
    return g;
}

// Küllős görgő (szemből nézve kör), tengelye z irányú
function gorgo(vas) {
    const g = new THREE.Group();
    const perem = mesh(new THREE.TorusGeometry(0.056, 0.009, 12, 40), vas); g.add(perem);
    const tarcsa = henger(0.05, 0.012, vas, 40); tarcsa.rotation.x = Math.PI / 2; tarcsa.scale.set(1, 1, 1); g.add(tarcsa);
    // kivágások hatása: 3 sötét „ablak” a tárcsán
    const lyukM = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 });
    for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 + Math.PI / 6;
        const l = mesh(new THREE.CircleGeometry(0.014, 20), lyukM, false);
        l.position.set(Math.cos(a) * 0.028, Math.sin(a) * 0.028, 0.0065); g.add(l);
        const l2 = l.clone(); l2.position.z = -0.0065; l2.rotation.y = Math.PI; g.add(l2);
    }
    const agy = henger(0.014, 0.03, vas); agy.rotation.x = Math.PI / 2; g.add(agy);
    return g;
}

/* ---------- Jelenet ---------- */
function epitJelenet(o, tex) {
    const W = Math.min(Math.max((Number(o.szelesseg) || 90) / 100, 0.5), 3);
    const H = Math.min(Math.max((Number(o.magassag) || 210) / 100, 1.6), 3);
    const falH = Math.max(2.75, H + 0.55);
    const falban = o.vasalatTipus === 'falban' || o.tipus === 'falban';
    const ket = o.tipus === 'ketszarnyu';
    const balra = o.irany !== 'jobbra';
    const falW = Math.max(W * 6, 9);
    const g = new THREE.Group();
    const a = anyagok(o, tex);
    const falFelulet = FAL_V / 2;

    // fal a nyílással: bal, jobb, szemöldök (a doboz belseje a zseb a falban futónál)
    const vak = vakolat(); vak.repeat.set(falW / 1.5, falH / 1.5);
    const falM = new THREE.MeshStandardMaterial({ map: vak, color: 0xf1ece4, roughness: 0.92 });
    const oldal = (falW - W) / 2;
    const bal = box(oldal, falH, FAL_V, falM); bal.position.set(-W / 2 - oldal / 2, falH / 2, 0);
    const jobb = box(oldal, falH, FAL_V, falM); jobb.position.set(W / 2 + oldal / 2, falH / 2, 0);
    const fent = box(W, falH - H, FAL_V, falM); fent.position.set(0, H + (falH - H) / 2, 0);
    g.add(bal, jobb, fent);

    // lábazat mindkét oldalon (a nyílásnál megszakad)
    const labM = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.5 });
    [-1, 1].forEach((sx) => [1, -1].forEach((sz) => {
        const l = box(oldal - 0.02, 0.08, 0.014, labM);
        l.position.set(sx * (W / 2 + 0.01 + (oldal - 0.02) / 2), 0.04, sz * (falFelulet + 0.007)); g.add(l);
    }));

    // padló (tölgy parketta) végig mindkét szobában, mennyezet
    const pt = parketta(); pt.repeat.set(falW / 2, 4);
    const padlo = mesh(new THREE.PlaneGeometry(falW, 8), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.55 }), false);
    padlo.rotation.x = -Math.PI / 2; g.add(padlo);
    const plafon = mesh(new THREE.PlaneGeometry(falW, 8), new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.95 }), false);
    plafon.rotation.x = Math.PI / 2; plafon.position.y = falH; plafon.receiveShadow = false; g.add(plafon);

    // a szomszéd szoba: hátsó fal ablakkal, oldalfalak – a nyíláson át mélységet ad
    const hatM = new THREE.MeshStandardMaterial({ color: 0xd9dcd3, roughness: 0.95 });
    const hat = mesh(new THREE.PlaneGeometry(falW, falH), hatM, false); hat.position.set(0, falH / 2, -3.2); g.add(hat);
    const ablak = mesh(new THREE.PlaneGeometry(1.3, 1.5), new THREE.MeshBasicMaterial({ color: 0xf4f7fb }), false);
    ablak.position.set(W * 0.3, 1.45, -3.19); g.add(ablak);
    const ablakKeret = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
    [[1.38, 0.05, 0, 0.75], [1.38, 0.05, 0, -0.75], [0.05, 1.55, -0.67, 0], [0.05, 1.55, 0.67, 0], [0.03, 1.5, 0, 0]].forEach(([bw, bh, dx, dy]) => {
        const k = box(bw, bh, 0.04, ablakKeret); k.position.set(W * 0.3 + dx, 1.45 + dy, -3.17); g.add(k);
    });
    const ablakFeny = new THREE.SpotLight(0xfff3e0, 18, 7, 0.9, 0.8, 1.5);
    ablakFeny.position.set(W * 0.3, 1.6, -3.0); ablakFeny.target.position.set(0, 0, 0.5);
    g.add(ablakFeny, ablakFeny.target);

    // ajtólapok
    const lapW = ket ? W / 2 + 0.04 : W + (falban ? 0.02 : 0.1);
    const lapH = H + (falban ? -0.008 : 0.05);
    let z, alj = 0.01;
    if (falban) z = 0;
    else if (o.vasalatTipus === 'pajta') z = falFelulet + 0.065 + LAP_V / 2;
    else if (o.vasalatTipus === 'lebego') { z = falFelulet + 0.025 + LAP_V / 2; alj = 0.018; }
    else z = falFelulet + 0.03 + LAP_V / 2;
    const mozog = [];
    const lapok = ket
        ? [{ x: -W / 4 - 0.02, ki: -(lapW + 0.03), fog: 'jobb' }, { x: W / 4 + 0.02, ki: lapW + 0.03, fog: 'bal' }]
        : [{ x: 0, ki: (balra ? -1 : 1) * (lapW + (falban ? 0 : 0.03)), fog: balra ? 'jobb' : 'bal' }];
    lapok.forEach((l) => {
        const lap = ajtolap(lapW, lapH, a, o.fogantyu ? l.fog : null, falban);
        lap.position.set(l.x, alj, z);
        g.add(lap);
        mozog.push({ obj: lap, x0: l.x, ki: l.ki, kerekek: [] });
    });

    const parkKozep = ket ? 0 : (balra ? -W / 2 : W / 2);
    const sinHossz = ket ? W * 2 + 0.5 : W * 2 + 0.35;

    if (o.vasalatTipus === 'pajta' && !falban) {
        // dupla sín: belső laposacél a falon, távtartók és imbuszcsavarok, előtte a külső sín
        const sinY = alj + lapH + 0.12;
        const belso = box(sinHossz, 0.045, 0.008, a.vas); belso.position.set(parkKozep, sinY, falFelulet + 0.004);
        const kulso = box(sinHossz, 0.05, 0.01, a.vas); kulso.position.set(parkKozep, sinY, falFelulet + 0.045);
        g.add(belso, kulso);
        const db = Math.max(3, Math.round(sinHossz / 0.45));
        for (let i = 0; i <= db; i++) {
            const x = parkKozep - sinHossz / 2 + 0.06 + i * (sinHossz - 0.12) / db;
            const tt = henger(0.013, 0.032, a.vas); tt.rotation.x = Math.PI / 2; tt.position.set(x, sinY, falFelulet + 0.024); g.add(tt);
            const fej = henger(0.009, 0.006, a.vas); fej.rotation.x = Math.PI / 2; fej.position.set(x, sinY, falFelulet + 0.053); g.add(fej);
        }
        [-1, 1].forEach((s) => { // sínvégi ütközők
            const v = box(0.02, 0.07, 0.03, a.vas); v.position.set(parkKozep + s * (sinHossz / 2 - 0.01), sinY + 0.01, falFelulet + 0.045); g.add(v);
        });
        // görgők a külső sín tetején, pántok az ajtólapon
        mozog.forEach((m) => {
            [-lapW / 2 + 0.16, lapW / 2 - 0.16].forEach((dx) => {
                const t = new THREE.Group();
                const kerekY = sinY + 0.025 + 0.065 - alj;
                const kerek = gorgo(a.vas);
                kerek.position.set(dx, kerekY, falFelulet + 0.045 - z);
                t.add(kerek);
                const tengely = henger(0.009, z - falFelulet - 0.045 + LAP_V / 2 + 0.006, a.vas);
                tengely.rotation.x = Math.PI / 2;
                tengely.position.set(dx, kerekY, (falFelulet + 0.045 - z + LAP_V / 2 + 0.006) / 2);
                t.add(tengely);
                const pant = box(0.045, kerekY - lapH + 0.3, 0.007, a.vas);
                pant.position.set(dx, kerekY - (kerekY - lapH + 0.3) / 2 + 0.03, LAP_V / 2 + 0.004);
                t.add(pant);
                [0.04, 0.22].forEach((dy) => { // csavarfejek a pánton
                    const cs = henger(0.008, 0.006, a.vas); cs.rotation.x = Math.PI / 2; cs.position.set(dx, lapH - dy, LAP_V / 2 + 0.009); t.add(cs);
                });
                m.obj.add(t);
                m.kerekek.push(kerek);
            });
        });
    } else if (o.vasalatTipus === 'rejtett' && !falban) {
        // a sín a mennyezet alatt egy falszínű takarólemez mögött fut: kívülről csak a lemez látszik
        const lemez = box(sinHossz + 0.1, 0.16, 0.02, falM);
        lemez.position.set(parkKozep, alj + lapH + 0.06, z + LAP_V / 2 + 0.03); g.add(lemez);
        const tarto = box(sinHossz + 0.1, 0.02, z + LAP_V / 2 + 0.04 - falFelulet, falM);
        tarto.position.set(parkKozep, alj + lapH + 0.13, (falFelulet + z + LAP_V / 2 + 0.04) / 2); g.add(tarto);
    }
    if (!falban && o.vasalatTipus !== 'lebego') { // alsó megvezető a padlón
        const mv = box(0.07, 0.025, 0.06, a.vas);
        mv.position.set(ket ? 0 : (balra ? W / 2 + 0.09 : -W / 2 - 0.09), 0.0125, z); g.add(mv);
    }
    if (falban) { // tok és takaróléc a nyílás körül, mindkét oldalon
        const tokM = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.45 });
        [1, -1].forEach((sz) => {
            const zz = sz * (falFelulet + 0.006);
            [-1, 1].forEach((sx) => { const t = box(0.06, H + 0.06, 0.012, tokM); t.position.set(sx * (W / 2 + 0.03), (H + 0.06) / 2, zz); g.add(t); });
            const t = box(W + 0.12, 0.06, 0.012, tokM); t.position.set(0, H + 0.03, zz); g.add(t);
        });
        [-1, 1].forEach((sx) => { const b = box(0.012, H, FAL_V, tokM); b.position.set(sx * (W / 2 - 0.006), H / 2, 0); g.add(b); });
    }
    return { g, mozog, W, H, falH, parkKozep };
}

/* ---------- Felület ---------- */
function render(boxEl, o) {
    if (!st || st.box !== boxEl) { init(boxEl); }
    if (!st.renderer) return;
    st.o = o;
    const lapNev = TEX[o.lap] || 'tomorfa';
    textura(lapNev).then((tex) => {
        if (st.jel) { st.scene.remove(st.jel.g); dispose(st.jel.g); }
        st.jel = epitJelenet(o, tex);
        st.scene.add(st.jel.g);
        st.nyit = 0; st.cel = 0;
        st.gomb.textContent = 'Nyisd ki';
        st.meret.textContent = Math.round(st.jel.W * 100) + ' × ' + Math.round(st.jel.H * 100) + ' cm-es nyílás';
        alapNezet();
        st.kell = true;
    }).catch(() => { st.msg.textContent = 'Az előnézet most nem tölthető be. Az ajánlatkérést ez nem érinti.'; });
}

function dispose(obj) {
    obj.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        const ms = Array.isArray(c.material) ? c.material : (c.material ? [c.material] : []);
        // a betöltött anyagképek gyorsítótárban maradnak; csak a jelenethez rajzolt (canvas) textúrák szabadulnak fel
        ms.forEach((m) => { if (m.map && m.map.isCanvasTexture) m.map.dispose(); m.dispose(); });
    });
}

function init(boxEl) {
    boxEl.textContent = '';
    const wrap = document.createElement('div'); wrap.className = 'd3-wrap';
    const help = document.createElement('p'); help.className = 'fi-help';
    help.textContent = 'Húzással körbeforgathatod, két ujjal vagy görgővel nagyíthatsz. A gombbal kinyithatod az ajtót.';
    const gombok = document.createElement('div'); gombok.className = 'fi-btns';
    const gomb = document.createElement('button'); gomb.type = 'button'; gomb.className = 'btn-primary fi-btn'; gomb.textContent = 'Nyisd ki';
    const alap = document.createElement('button'); alap.type = 'button'; alap.className = 'btn-primary btn-outline fi-btn'; alap.textContent = 'Alapnézet';
    const meret = document.createElement('span'); meret.className = 'd3-meret';
    gombok.append(gomb, alap, meret);
    const note = document.createElement('p'); note.className = 'pic-note';
    note.textContent = 'Szemléltető 3D kép. A pontos látványtervet megrendelés után kapod.';
    const msg = document.createElement('p'); msg.className = 'fi-msg'; msg.setAttribute('role', 'status');
    boxEl.append(help, wrap, gombok, msg, note);

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
        msg.textContent = 'Ez a böngésző nem tud 3D-t megjeleníteni. Az ajánlatkérést ez nem érinti.';
        wrap.remove(); gombok.remove();
        st = { box: boxEl };
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.domElement.className = 'd3-canvas';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', 'Az ajtó 3D előnézete a választásaid szerint');
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd8d3cb);
    // környezeti fény és tükröződés (szoba-környezet), plusz egy lágy árnyékot vető „ablakfény” elölről
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    const nap = new THREE.DirectionalLight(0xfff1de, 2.4);
    nap.position.set(-2.2, 3.6, 3.4); nap.castShadow = true;
    nap.shadow.mapSize.set(2048, 2048);
    nap.shadow.bias = -0.0004; nap.shadow.normalBias = 0.02; nap.shadow.radius = 4;
    Object.assign(nap.shadow.camera, { left: -4, right: 4, top: 3.5, bottom: -0.5, near: 0.5, far: 12 });
    scene.add(nap, new THREE.HemisphereLight(0xfff8ef, 0x7a6a58, 0.35));

    const camera = new THREE.PerspectiveCamera(42, 1, 0.03, 60);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    Object.assign(controls, {
        enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.7,
        minDistance: 1.4, maxDistance: 9,
        minAzimuthAngle: -1.35, maxAzimuthAngle: 1.35,     // kb. ±77°: oldalról is bele lehet látni
        minPolarAngle: 0.95, maxPolarAngle: 1.62            // fentről kicsit, alulról alig
    });
    controls.addEventListener('change', () => { st.kell = true; });

    st = { box: boxEl, wrap, renderer, scene, camera, controls, gomb, meret, msg, nyit: 0, cel: 0, kell: true, latszik: true };

    gomb.addEventListener('click', () => {
        st.cel = st.cel ? 0 : 1;
        gomb.textContent = st.cel ? 'Csukd be' : 'Nyisd ki';
        st.kell = true;
    });
    alap.addEventListener('click', () => { alapNezet(); st.kell = true; });

    if (window.ResizeObserver) { new ResizeObserver(() => { meretez(); st.kell = true; }).observe(wrap); }
    // csak akkor rajzolunk folyamatosan, ha a nézet látszik (akkumulátor)
    if (window.IntersectionObserver) {
        // újra láthatóvá váláskor újrarajzolunk (a böngésző közben eldobhatja a vászon tartalmát)
        new IntersectionObserver((es) => { st.latszik = es.some((e) => e.isIntersecting); st.kell = true; hurok(); }).observe(wrap);
    }
    meretez();
    hurok();
}

function hurok() {
    if (!st || !st.renderer) return;
    const csendes = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let elozo = performance.now();
    st.renderer.setAnimationLoop(st.latszik && st.box.closest('details')?.open !== false ? (most) => {
        const dt = Math.min(0.05, (most - elozo) / 1000); elozo = most;
        st.controls.update();
        if (st.nyit !== st.cel) {
            const v = csendes ? 1 : dt / 1.8; // 1,8 mp alatt nyílik
            st.nyit = st.cel > st.nyit ? Math.min(st.cel, st.nyit + v) : Math.max(st.cel, st.nyit - v);
            st.kell = true;
        }
        if (st.kell && st.jel) { st.kell = false; rajzol(); }
    } : null);
}

function meretez() {
    if (!st.renderer) return;
    const w = st.wrap.clientWidth || 600;
    const h = Math.round(Math.min(w * (w < 500 ? 1.1 : 0.68), window.innerHeight * 0.72));
    st.renderer.setSize(w, h, true);
    st.camera.aspect = w / h;
    st.camera.updateProjectionMatrix();
}

// Alapnézet: enyhén oldalról és felülről, hogy a vasalat és a nyitás iránya is látsszon; minden beférjen.
function alapNezet() {
    if (!st.jel) return;
    const { W, H, parkKozep } = st.jel;
    const t2 = 2 * Math.tan(THREE.MathUtils.degToRad(st.camera.fov / 2));
    const szel = W * 2.3 + 0.8, mag = H + 0.7;
    const tav = 1.08 * Math.max(szel / (t2 * st.camera.aspect), mag / t2);
    const cel = new THREE.Vector3((parkKozep + 0) / 2, (H + 0.25) / 2, 0);
    const az = (st.o && st.o.irany === 'jobbra') ? -0.5 : 0.5, pol = 1.36;
    st.controls.target.copy(cel);
    st.camera.position.set(
        cel.x + Math.sin(pol) * Math.sin(az) * tav,
        cel.y + Math.cos(pol) * tav,
        Math.sin(pol) * Math.cos(az) * tav
    );
    st.controls.maxDistance = Math.max(9, tav * 1.6);
    st.controls.update();
}

function rajzol() {
    const k = st.nyit, sim = k * k * (3 - 2 * k); // finom indulás és megállás
    st.jel.mozog.forEach((m) => {
        m.obj.position.x = m.x0 + m.ki * sim;
        m.kerekek.forEach((r) => { r.rotation.z = -(m.ki * sim) / 0.065; });
    });
    st.renderer.render(st.scene, st.camera);
}

export { render };
