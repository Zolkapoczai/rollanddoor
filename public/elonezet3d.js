/* 3D előnézet a tervezőben: a választásokból (méret, elrendezés, ajtólap, szín, vasalat, irány, fogantyú)
 * egy valósághű, körbeforgatható jelenet; az ajtó gombra kinyílik. Szemléltetés, nem látványterv.
 * - A jelenet alatti gombokkal az anyag, a szín, a vasalat, az elrendezés és az irány élőben váltható;
 *   ezek visszaíródnak a tervező mezőibe (api.beallit), így az ajánlatkérésbe is bekerülnek.
 * - Fal- és padlóválasztás (csak a nézethez), méretvonalak, a szabad fal ellenőrzése sarokfallal.
 * - Kép mentése; AR (model-viewer, csak telefonon, kérésre töltődik be).
 * three.js (MIT) + RoomEnvironment + OrbitControls + GLTFExporter: public/vendor/three/three.bundle.min.js.
 * Ezt a modult a tervezo.js csak a „Nézd meg 3D-ben” doboz kinyitásakor tölti be. */
import * as THREE from './vendor/three/three.bundle.min.js';

const TEX = { tomorfa: 'tomorfa', fem: 'fem', nyomatos: 'nyomatos', antik: 'antik' };
const FESTETT = { ral9016: 0xeeede6, ral9005: 0x17181a, ral7016: 0x383e42, ral7035: 0xc5c7c4 };
const VASSZIN = {
    fekete: { nev: 'Matt fekete', szin: 0x1b1b1c, fem: 0.85, er: 0.42 },
    inox: { nev: 'Inox', szin: 0xc2c6ca, fem: 0.95, er: 0.22 },
    bronz: { nev: 'Antik bronz', szin: 0x6e4b2c, fem: 0.85, er: 0.4 },
    feher: { nev: 'Fehér', szin: 0xf1f0ec, fem: 0.1, er: 0.45 }
};
const FALSZIN = { feher: 0xf1ece4, bezs: 0xe6d8c3, szurke: 0xc8c8c4, sotet: 0x4b4b4d };
const FAL_V = 0.15;      // falvastagság (m)
const LAP_V = 0.04;      // ajtólap-vastagság (m)
const texCache = {};
let st = null;           // egyetlen nézet a lapon

// A jelenet alatti választók. mezo: a tervező mezőjének neve; helyi: csak a nézetet állítja.
const VALASZTOK = [
    { cim: 'Ajtólap', mezo: 'lap', opciok: [['tomorfa', 'Tömörfa'], ['nyomatos', 'Nyomatos'], ['fem', 'Fém'], ['antik', 'Antik'], ['uveg', 'Üveg'], ['fem_uveg', 'Fém keret üveggel']] },
    { cim: 'Szín', mezo: 'szin', opciok: [['natur_fa', 'Natúr fa'], ['pacolt_fa', 'Pácolt'], ['ral9016', 'Fehér'], ['ral9005', 'Fekete'], ['ral7016', 'Antracit'], ['ral7035', 'Világosszürke']],
      lathato: (o) => !['nyomatos', 'antik', 'uveg'].includes(lapNev(o)) },
    { cim: 'Vasalat', mezo: 'vasalatTipus', opciok: [['pajta', 'Pajta'], ['rejtett', 'Rejtett'], ['lebego', 'Lebegő'], ['falban', 'Falban futó']] },
    { cim: 'Vasalat színe', mezo: 'vasSzin', opciok: Object.entries(VASSZIN).map(([k, v]) => [k, v.nev]), lathato: (o) => o.vasalatTipus === 'pajta' },
    { cim: 'Elrendezés', mezo: 'tipus', opciok: [['egyszarnyu', 'Egyszárnyú'], ['ketszarnyu', 'Kétszárnyú'], ['bypass', 'Egymás előtt']], lathato: (o) => !falbanE(o) },
    { cim: 'Nyitás iránya', mezo: 'irany', opciok: [['balra', 'Balra'], ['jobbra', 'Jobbra']], lathato: (o) => o.tipus !== 'ketszarnyu' },
    { cim: 'Fal (csak a nézethez)', mezo: 'fal3d', helyi: true, opciok: [['feher', 'Fehér'], ['bezs', 'Bézs'], ['szurke', 'Szürke'], ['sotet', 'Sötét'], ['tegla', 'Tégla']] },
    { cim: 'Padló (csak a nézethez)', mezo: 'padlo3d', helyi: true, opciok: [['vilagos', 'Világos parketta'], ['sotet', 'Sötét parketta'], ['jarolap', 'Járólap']] }
];

const lapNev = (o) => TEX[o.lap] ? o.lap : (o.lap === 'uveg' || o.lap === 'fem_uveg' ? o.lap : 'tomorfa');
const falbanE = (o) => o.vasalatTipus === 'falban' || o.tipus === 'falban';
function vasSzinKulcs(o) {
    if (o.vasalatSzin !== 'egyeb') return 'fekete';
    const t = String(o.vasalatEgyeb || '').toLowerCase();
    if (t.includes('inox')) return 'inox';
    if (t.includes('bronz')) return 'bronz';
    if (t.includes('fehér') || t.includes('feher')) return 'feher';
    return 'fekete';
}

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

// Normal térkép a kép világosságából (Sobel), lineáris színtérben. erosseg: a dombok meredeksége.
const nmCache = new WeakMap();
function normalTerkep(forras, erosseg = 2, inverz = false) {
    if (!forras) return null;
    const kulcs = forras.image || forras;
    const elozo = nmCache.get(kulcs);
    if (elozo && elozo.e === erosseg) return elozo.t;
    const img = forras.image || forras;
    const w = Math.min(img.width, 1024), h = Math.round(w * img.height / img.width);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, ki = x.createImageData(w, h), o = ki.data;
    const L = (i, j) => { i = (i + w) % w; j = (j + h) % h; const k = (j * w + i) * 4; const v = (d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11) / 255; return inverz ? 1 - v : v; };
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const dx = (L(i + 1, j - 1) + 2 * L(i + 1, j) + L(i + 1, j + 1)) - (L(i - 1, j - 1) + 2 * L(i - 1, j) + L(i - 1, j + 1));
        const dy = (L(i - 1, j + 1) + 2 * L(i, j + 1) + L(i + 1, j + 1)) - (L(i - 1, j - 1) + 2 * L(i, j - 1) + L(i + 1, j - 1));
        let nx = -dx * erosseg, ny = dy * erosseg, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const k = (j * w + i) * 4; o[k] = (nx * 0.5 + 0.5) * 255; o[k + 1] = (ny * 0.5 + 0.5) * 255; o[k + 2] = (nz * 0.5 + 0.5) * 255; o[k + 3] = 255;
    }
    x.putImageData(ki, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (forras.repeat) t.repeat.copy(forras.repeat);
    nmCache.set(kulcs, { e: erosseg, t });
    return t;
}

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function canvasTex(c) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
}

// Parketta (hosszú hajópadló-deszkák), canvasra rajzolva: 1 kép = 2 × 2 m. sotet: diófa árnyalat.
function parketta(sotet) {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const x = c.getContext('2d'), r = rnd(sotet ? 11 : 7);
    const deszkaSz = 1024 / 11, deszkaH = 1024 / 1.6;
    for (let i = 0; i < 11; i++) {
        let y = -r() * deszkaH;
        while (y < 1024) {
            const t = (sotet ? 92 : 168) + r() * 30, g = t - (sotet ? 34 : 28) - r() * 10, b = t - (sotet ? 58 : 70) - r() * 12;
            x.fillStyle = `rgb(${t | 0},${g | 0},${b | 0})`;
            x.fillRect(i * deszkaSz, y, deszkaSz, deszkaH);
            for (let k = 0; k < 7; k++) {
                x.strokeStyle = `rgba(${sotet ? '30,18,8' : '90,60,30'},${0.08 + r() * 0.1})`;
                x.lineWidth = 1 + r() * 1.5;
                const ox = i * deszkaSz + r() * deszkaSz;
                x.beginPath(); x.moveTo(ox, y); x.bezierCurveTo(ox + 6, y + deszkaH / 3, ox - 6, y + deszkaH * 2 / 3, ox + r() * 4, y + deszkaH); x.stroke();
            }
            x.fillStyle = 'rgba(20,12,5,0.55)'; x.fillRect(i * deszkaSz, y, deszkaSz, 2);
            y += deszkaH;
        }
        x.fillStyle = 'rgba(20,12,5,0.5)'; x.fillRect(i * deszkaSz, 0, 2, 1024);
    }
    return canvasTex(c);
}
// Nagy, világos járólap (60 × 60 cm), fugával: 1 kép = 1,2 × 1,2 m
function jarolap() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d'), r = rnd(5);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const v = 214 + r() * 10;
        x.fillStyle = `rgb(${v | 0},${(v - 4) | 0},${(v - 9) | 0})`; x.fillRect(i * 256, j * 256, 256, 256);
        for (let k = 0; k < 400; k++) { x.fillStyle = `rgba(120,110,100,${r() * 0.06})`; x.fillRect(i * 256 + r() * 256, j * 256 + r() * 256, 2, 2); }
    }
    x.fillStyle = '#a49c93'; x.fillRect(0, 0, 512, 3); x.fillRect(0, 256, 512, 3); x.fillRect(0, 0, 3, 512); x.fillRect(256, 0, 3, 512);
    return canvasTex(c);
}
// Finom vakolat-zaj a falra
function vakolat() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), d = x.createImageData(256, 256), r = rnd(3);
    for (let i = 0; i < d.data.length; i += 4) { const v = 236 + r() * 19; d.data[i] = v; d.data[i + 1] = v - 1; d.data[i + 2] = v - 3; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    return canvasTex(c);
}
// Látszó tégla: 1 kép = 1 × 1 m (25 × 6,5 cm-es téglák, 1 cm fuga)
function tegla() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d'), r = rnd(9);
    x.fillStyle = '#b9b1a6'; x.fillRect(0, 0, 512, 512);
    const tw = 128, th = 512 / 15;
    for (let sor = 0; sor < 15; sor++) {
        const el = sor % 2 ? -tw / 2 : 0;
        for (let k = -1; k < 5; k++) {
            const rr = 128 + r() * 34, g = 74 + r() * 22, b = 58 + r() * 16;   // visszafogott, téglavörös–barna
            x.fillStyle = `rgb(${rr | 0},${g | 0},${b | 0})`;
            x.fillRect(el + k * tw + 3, sor * th + 3, tw - 6, th - 6);
        }
    }
    return canvasTex(c);
}

/* ---------- Környezeti térkép: kocka → equirect adattextúra ---------- */
function equirectKockabol(renderer, kocka, w = 1024, h = 512) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
    const mat = new THREE.ShaderMaterial({
        uniforms: { t: { value: kocka } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `uniform samplerCube t; varying vec2 vUv;
            void main(){
                float phi = (vUv.x - 0.5) * 6.28318530718, th = (vUv.y - 0.5) * 3.14159265359;
                vec3 d = vec3(cos(th) * cos(phi), sin(th), cos(th) * sin(phi));
                gl_FragColor = vec4(textureCube(t, d).rgb, 1.0);
            }`,
        depthTest: false, depthWrite: false
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    const sc = new THREE.Scene(); sc.add(quad);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const elozo = renderer.getRenderTarget();
    renderer.setRenderTarget(rt); renderer.render(sc, cam); renderer.setRenderTarget(elozo);
    const adat = new Float32Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, adat);
    rt.dispose(); mat.dispose(); quad.geometry.dispose();
    const t = new THREE.DataTexture(adat, w, h, THREE.RGBAFormat, THREE.FloatType);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.LinearSRGBColorSpace;
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.needsUpdate = true;
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

// Ajtólap-test: doboz az élekhez + két vékony felület elöl és hátul az anyagképpel. Minden rész egyetlen anyagú:
// a sugárkövető a többanyagú tárgyaknál elcsúsztatja az anyagok sorszámát (hibás szín, hibás árnyék).
function lapTest(w, h, elM, lapM) {
    const g = new THREE.Group();
    const test = mesh(new THREE.BoxGeometry(w, h, LAP_V), elM); test.position.y = h / 2; g.add(test);
    [1, -1].forEach((s) => {
        const geo = new THREE.PlaneGeometry(w - 0.002, h - 0.002); geo.computeTangents();
        const f = mesh(geo, lapM); f.position.set(0, h / 2, s * (LAP_V / 2 + 0.0005));
        if (s < 0) f.rotation.y = Math.PI;
        g.add(f);
    });
    return g;
}

// Felirat a 3D térben (mindig a néző felé fordul)
function felirat(szoveg, szin = '#2d2520') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const x = c.getContext('2d');
    x.font = '600 56px Outfit, Inter, sans-serif';
    const w = Math.min(500, x.measureText(szoveg).width + 48);
    x.fillStyle = 'rgba(255,255,255,0.92)';
    x.beginPath(); x.roundRect((512 - w) / 2, 22, w, 84, 42); x.fill();
    x.fillStyle = szin; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(szoveg, 256, 66);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set(0.56, 0.14, 1); s.renderOrder = 10;
    return s;
}
// Méretvonal két pont között, végein kis keresztvonallal és felirattal
function meretVonal(a, b, szoveg, szin) {
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: szin, depthTest: false });
    const d = new THREE.Vector3().subVectors(b, a), hossz = d.length();
    const vonal = new THREE.Mesh(new THREE.BoxGeometry(hossz, 0.008, 0.008), m);
    vonal.position.copy(a).addScaledVector(d, 0.5);
    vonal.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.clone().normalize());
    vonal.renderOrder = 9; g.add(vonal);
    [a, b].forEach((p) => {
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.008), m);
        v.scale.set(Math.abs(d.y) > Math.abs(d.x) ? 8 : 1, Math.abs(d.y) > Math.abs(d.x) ? 1 : 8, 1);
        v.position.copy(p); v.renderOrder = 9; g.add(v);
    });
    const f = felirat(szoveg, szin === 0xc0392b ? '#c0392b' : '#2d2520');
    f.position.copy(a).addScaledVector(d, 0.5).add(new THREE.Vector3(0, Math.abs(d.y) > Math.abs(d.x) ? 0 : 0.09, 0));
    g.add(f);
    return g;
}

/* ---------- Anyagok ---------- */
function anyagok(o, tex) {
    const lap = lapNev(o);
    const festett = FESTETT[o.szin];
    const vs = VASSZIN[vasSzinKulcs(o)];
    const vas = new THREE.MeshPhysicalMaterial({ color: vs.szin, metalness: vs.fem, roughness: vs.er, clearcoat: 0.2 });
    const fekete = new THREE.MeshPhysicalMaterial({ color: 0x1b1b1c, metalness: 0.85, roughness: 0.42 });
    const res = { lap, vas, fekete };
    if (lap === 'uveg' || lap === 'fem_uveg') {
        res.uveg = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.04, thickness: 0.01, ior: 1.5, metalness: 0, transparent: true });
        res.keret = lap === 'fem_uveg'
            ? new THREE.MeshPhysicalMaterial({ color: festett ?? 0x161616, metalness: festett ? 0.2 : 0.7, roughness: 0.45, clearcoat: 0.3 })
            : new THREE.MeshPhysicalMaterial({ color: 0xb9bcbf, metalness: 0.9, roughness: 0.3 });
        return res;
    }
    let m;
    if (festett && (lap === 'tomorfa' || lap === 'fem')) {
        m = new THREE.MeshPhysicalMaterial({ color: festett, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, normalMap: normalTerkep(tex, lap === 'tomorfa' ? 1.2 : 0.5, true) });
    } else if (lap === 'fem') {
        m = new THREE.MeshPhysicalMaterial({ map: tex, metalness: 0.75, roughness: 0.38, normalMap: normalTerkep(tex, 0.8, true) });
    } else if (lap === 'nyomatos') {
        m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    } else if (lap === 'antik') {
        m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.82, normalMap: normalTerkep(tex, 4, true) });
    } else {
        m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.35, normalMap: normalTerkep(tex, 1.6, true) });
        if (o.szin === 'pacolt_fa') m.color.setHex(0x7d5233);
    }
    res.lapM = m;
    res.elM = new THREE.MeshPhysicalMaterial({ color: m.map ? 0x5a3d26 : m.color, roughness: 0.6 });
    if (lap === 'fem' && !festett) res.elM = new THREE.MeshPhysicalMaterial({ color: 0x8d9094, metalness: 0.8, roughness: 0.4 });
    return res;
}

/* ---------- Ajtólap ---------- */
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
        g.add(lapTest(w, h, a.elM, a.lapM));
    }
    if (fog) {
        const x = fog === 'jobb' ? w / 2 - 0.08 : -w / 2 + 0.08;
        if (perem) {
            [1, -1].forEach((s) => { const f = box(0.03, 0.14, 0.004, a.fekete); f.position.set(x, h * 0.48, s * (LAP_V / 2 + 0.001)); g.add(f); });
        } else {
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

function gorgo(vas) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.TorusGeometry(0.056, 0.009, 12, 40), vas));
    const tarcsa = henger(0.05, 0.012, vas, 40); tarcsa.rotation.x = Math.PI / 2; g.add(tarcsa);
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
function epitJelenet(o, tex, szoba, meretek) {
    const W = Math.min(Math.max((Number(o.szelesseg) || 90) / 100, 0.5), 3);
    const H = Math.min(Math.max((Number(o.magassag) || 210) / 100, 1.6), 3);
    const falH = Math.max(2.75, H + 0.55);
    const falban = falbanE(o);
    const ket = o.tipus === 'ketszarnyu';
    const bypass = o.tipus === 'bypass' && !falban;
    const balra = o.irany !== 'jobbra';
    const falW = Math.max(W * 6, 9);
    const g = new THREE.Group();
    const ajtoG = new THREE.Group();   // ajtólapok + vasalat (ezt exportáljuk AR-hoz)
    const ov = new THREE.Group();      // méretvonalak, feliratok: a fotórealisztikus kép fölé rajzolva
    const a = anyagok(o, tex);
    const ff = FAL_V / 2;              // a fal elülső síkja

    // fal
    let falM;
    if (szoba.fal === 'tegla') {
        const t = tegla(); t.repeat.set(falW, falH);
        falM = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    } else {
        const v = vakolat(); v.repeat.set(falW / 1.5, falH / 1.5);
        falM = new THREE.MeshStandardMaterial({ map: v, color: FALSZIN[szoba.fal] || FALSZIN.feher, roughness: 0.92 });
    }
    const oldal = (falW - W) / 2;
    const bal = box(oldal, falH, FAL_V, falM); bal.position.set(-W / 2 - oldal / 2, falH / 2, 0);
    const jobb = box(oldal, falH, FAL_V, falM); jobb.position.set(W / 2 + oldal / 2, falH / 2, 0);
    const fent = box(W, falH - H, FAL_V, falM); fent.position.set(0, H + (falH - H) / 2, 0);
    g.add(bal, jobb, fent);
    const labM = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.5 });
    [-1, 1].forEach((sx) => [1, -1].forEach((sz) => {
        const l = box(oldal - 0.02, 0.08, 0.014, labM);
        l.position.set(sx * (W / 2 + 0.01 + (oldal - 0.02) / 2), 0.04, sz * (ff + 0.007)); g.add(l);
    }));

    // padló, mennyezet
    let pt;
    if (szoba.padlo === 'jarolap') { pt = jarolap(); pt.repeat.set(falW / 1.2, 8 / 1.2); }
    else { pt = parketta(szoba.padlo === 'sotet'); pt.repeat.set(falW / 2, 4); }
    const padlo = mesh(new THREE.PlaneGeometry(falW, 8), new THREE.MeshPhysicalMaterial({ map: pt, roughness: szoba.padlo === 'jarolap' ? 0.3 : 0.5, clearcoat: szoba.padlo === 'jarolap' ? 0.3 : 0.25, clearcoatRoughness: 0.35, normalMap: normalTerkep(pt, 2, true) }), false);
    padlo.rotation.x = -Math.PI / 2; g.add(padlo);
    // mennyezet nincs: a sugárkövetőben elvenné a felülről érkező fényt, a nézetből pedig nem látszik

    // szomszéd szoba ablakkal
    const hat = mesh(new THREE.PlaneGeometry(falW, falH), new THREE.MeshStandardMaterial({ color: 0xd9dcd3, roughness: 0.95 }), false);
    hat.position.set(0, falH / 2, -3.2); g.add(hat);
    const ablak = mesh(new THREE.PlaneGeometry(1.3, 1.5), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f7fb, emissiveIntensity: 2.2 }), false);
    ablak.position.set(W * 0.3, 1.45, -3.19); g.add(ablak);
    const ablakKeret = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6 });
    [[1.38, 0.05, 0, 0.75], [1.38, 0.05, 0, -0.75], [0.05, 1.55, -0.67, 0], [0.05, 1.55, 0.67, 0], [0.03, 1.5, 0, 0]].forEach(([bw, bh, dx, dy]) => {
        const k = box(bw, bh, 0.04, ablakKeret); k.position.set(W * 0.3 + dx, 1.45 + dy, -3.17); g.add(k);
    });
    // az ablakon beeső nappali fény: területi fényforrás (lágy árnyékok, a sugárkövető is ezt követi)
    const ablakFeny = new THREE.RectAreaLight(0xfff6ea, 22, 1.3, 1.5);
    ablakFeny.position.set(W * 0.3, 1.45, -3.15); ablakFeny.lookAt(W * 0.3, 1.2, 1);
    g.add(ablakFeny);

    // ajtólapok: { x0, ki, w, z, fog }
    const lapH = H + (falban ? -0.008 : 0.05);
    let z0, alj = 0.01;
    if (falban) z0 = 0;
    else if (o.vasalatTipus === 'pajta') z0 = ff + 0.065 + LAP_V / 2;
    else if (o.vasalatTipus === 'lebego') { z0 = ff + 0.025 + LAP_V / 2; alj = 0.018; }
    else z0 = ff + 0.03 + LAP_V / 2;
    const elore = LAP_V + 0.014;       // bypassnál a második lap ennyivel előrébb fut
    let lapok;
    if (bypass) {
        const w = W / 2 + 0.05;
        const hatso = { x0: balra ? -W / 4 : W / 4, ki: 0, w, z: z0, fog: balra ? 'jobb' : 'bal' };
        const elso = { x0: balra ? W / 4 : -W / 4, ki: balra ? -W / 2 : W / 2, w, z: z0 + elore, fog: balra ? 'bal' : 'jobb' };
        lapok = [hatso, elso];
    } else if (ket) {
        const w = W / 2 + (falban ? 0.01 : 0.04);
        lapok = [{ x0: -W / 4 - (falban ? 0.005 : 0.02), ki: -(w + (falban ? 0 : 0.03)), w, z: z0, fog: 'jobb' },
                 { x0: W / 4 + (falban ? 0.005 : 0.02), ki: w + (falban ? 0 : 0.03), w, z: z0, fog: 'bal' }];
    } else {
        const w = W + (falban ? 0.02 : 0.1);
        lapok = [{ x0: 0, ki: (balra ? -1 : 1) * (w + (falban ? 0 : 0.03)), w, z: z0, fog: balra ? 'jobb' : 'bal' }];
    }
    const mozog = [];
    lapok.forEach((l) => {
        const lap = ajtolap(l.w, lapH, a, o.fogantyu ? l.fog : null, falban);
        lap.position.set(l.x0, alj, l.z);
        ajtoG.add(lap);
        mozog.push({ obj: lap, x0: l.x0, ki: l.ki, kerekek: [] });
    });

    // a sín(ek) hossza: minden lap zárt és nyitott helyzetét lefedi
    const terjedelem = (ls) => {
        let min = Infinity, max = -Infinity;
        ls.forEach((l) => { min = Math.min(min, l.x0, l.x0 + l.ki) - l.w / 2; max = Math.max(max, l.x0, l.x0 + l.ki) + l.w / 2; });
        return [min - 0.06, max + 0.06];
    };
    const [sinMin, sinMax] = terjedelem(lapok);

    if (o.vasalatTipus === 'pajta' && !falban) {
        // dupla sín: belső laposacél a falon, távtartók és imbuszcsavarok, előtte a külső sín(ek)
        const sinY = alj + lapH + 0.12;
        const belso = box(sinMax - sinMin, 0.045, 0.008, a.vas); belso.position.set((sinMin + sinMax) / 2, sinY, ff + 0.004); ajtoG.add(belso);
        const sinZk = [...new Set(lapok.map((l) => +(l.z - z0).toFixed(3)))];   // 0, és bypassnál az előrébb futó sín
        sinZk.forEach((dz) => {
            const [mn, mx] = terjedelem(lapok.filter((l) => +(l.z - z0).toFixed(3) === dz));
            const k = box(mx - mn, 0.05, 0.01, a.vas); k.position.set((mn + mx) / 2, sinY - dz * 0.0, ff + 0.045 + dz); ajtoG.add(k);
            [-1, 1].forEach((s) => { const v = box(0.02, 0.07, 0.03, a.vas); v.position.set((mn + mx) / 2 + s * ((mx - mn) / 2 - 0.01), sinY + 0.01, ff + 0.045 + dz); ajtoG.add(v); });
        });
        const melyseg = 0.045 + Math.max(...sinZk);
        const db = Math.max(3, Math.round((sinMax - sinMin) / 0.45));
        for (let i = 0; i <= db; i++) {
            const x = sinMin + 0.06 + i * (sinMax - sinMin - 0.12) / db;
            const tt = henger(0.013, melyseg - 0.013, a.vas); tt.rotation.x = Math.PI / 2; tt.position.set(x, sinY, ff + 0.008 + (melyseg - 0.013) / 2); ajtoG.add(tt);
            const fej = henger(0.009, 0.006, a.vas); fej.rotation.x = Math.PI / 2; fej.position.set(x, sinY, ff + melyseg + 0.008); ajtoG.add(fej);
        }
        mozog.forEach((m, i) => {
            const l = lapok[i], dz = l.z - z0;
            [-l.w / 2 + 0.16, l.w / 2 - 0.16].forEach((dx) => {
                const t = new THREE.Group();
                const kerekY = sinY + 0.025 + 0.065 - alj;
                const kerek = gorgo(a.vas);
                kerek.position.set(dx, kerekY, ff + 0.045 + dz - l.z);
                t.add(kerek);
                const hossz = l.z - ff - 0.045 - dz + LAP_V / 2 + 0.006;
                const tengely = henger(0.009, hossz, a.vas); tengely.rotation.x = Math.PI / 2;
                tengely.position.set(dx, kerekY, (ff + 0.045 + dz - l.z + LAP_V / 2 + 0.006) / 2); t.add(tengely);
                const pant = box(0.045, kerekY - lapH + 0.3, 0.007, a.vas);
                pant.position.set(dx, kerekY - (kerekY - lapH + 0.3) / 2 + 0.03, LAP_V / 2 + 0.004); t.add(pant);
                [0.04, 0.22].forEach((dy) => { const cs = henger(0.008, 0.006, a.vas); cs.rotation.x = Math.PI / 2; cs.position.set(dx, lapH - dy, LAP_V / 2 + 0.009); t.add(cs); });
                m.obj.add(t);
                m.kerekek.push(kerek);
            });
        });
    } else if (o.vasalatTipus === 'rejtett' && !falban) {
        const elol = Math.max(...lapok.map((l) => l.z)) + LAP_V / 2 + 0.03;
        const lemez = box(sinMax - sinMin + 0.1, 0.16, 0.02, falM); lemez.position.set((sinMin + sinMax) / 2, alj + lapH + 0.06, elol); ajtoG.add(lemez);
        const tarto = box(sinMax - sinMin + 0.1, 0.02, elol - ff + 0.01, falM); tarto.position.set((sinMin + sinMax) / 2, alj + lapH + 0.13, (ff + elol) / 2); ajtoG.add(tarto);
    }
    if (!falban && o.vasalatTipus !== 'lebego' && o.megvezeto !== false) {
        const mvx = bypass || ket ? 0 : (balra ? W / 2 + 0.09 : -W / 2 - 0.09);
        const mv = box(0.07, 0.025, 0.06 + (bypass ? elore : 0), a.fekete); mv.position.set(mvx, 0.0125, z0 + (bypass ? elore / 2 : 0)); ajtoG.add(mv);
    }
    if (falban) {
        const tokM = new THREE.MeshStandardMaterial({ color: 0xf6f4ef, roughness: 0.45 });
        [1, -1].forEach((sz) => {
            const zz = sz * (ff + 0.006);
            [-1, 1].forEach((sx) => { const t = box(0.06, H + 0.06, 0.012, tokM); t.position.set(sx * (W / 2 + 0.03), (H + 0.06) / 2, zz); g.add(t); });
            const t = box(W + 0.12, 0.06, 0.012, tokM); t.position.set(0, H + 0.03, zz); g.add(t);
        });
        [-1, 1].forEach((sx) => { const b = box(0.012, H, FAL_V, tokM); b.position.set(sx * (W / 2 - 0.006), H / 2, 0); g.add(b); });
    }
    g.add(ajtoG);

    // szabad fal: sarokfal a megadott távolságban, és ellenőrzés
    const szabad = Number(o.szabadFal);
    const ell = { van: false };
    if (o.szabadFal !== '' && o.szabadFal != null && isFinite(szabad) && szabad >= 0 && !bypass) {
        const oldalak = ket ? [-1, 1] : [balra ? -1 : 1];
        const kell = Math.round((lapok[0].w + (falban ? 0.05 : 0.03)) * 100);   // a nyitott lap helye (cm), kb.
        ell.van = true; ell.kell = kell; ell.szabad = szabad; ell.jo = szabad >= kell;
        oldalak.forEach((s) => {
            const x = s * (W / 2 + szabad / 100 + 0.06);
            const sarok = box(0.12, falH, 1.4, falM); sarok.position.set(x, falH / 2, ff + 0.7); g.add(sarok);
            if (meretek) {
                const y = 0.06, zz = ff + 0.2;
                ov.add(meretVonal(new THREE.Vector3(s * W / 2, y, zz), new THREE.Vector3(s * (W / 2 + szabad / 100), y, zz),
                    'szabad fal: ' + szabad + ' cm', ell.jo ? 0x2e7d4f : 0xc0392b));
            }
        });
    }
    if (meretek) {
        const elol = Math.max(...lapok.map((l) => l.z)) + 0.25;
        ov.add(meretVonal(new THREE.Vector3(-W / 2, 0.32, elol), new THREE.Vector3(W / 2, 0.32, elol), Math.round(W * 100) + ' cm', 0x9c6842));
        const hx = (ket || bypass ? -1 : (balra ? 1 : -1)) * (W / 2 + 0.16);
        ov.add(meretVonal(new THREE.Vector3(hx, 0, ff + 0.05), new THREE.Vector3(hx, H, ff + 0.05), Math.round(H * 100) + ' cm', 0x9c6842));
    }
    g.traverse((c) => {
        // egyetlen anyagú tárgynál ne maradjanak anyagcsoportok (a doboznak 6 van): a sugárkövető
        // a csoportok sorszámát anyagindexnek venné, és más tárgy anyagát rajzolná rá
        if (c.isMesh && !Array.isArray(c.material) && c.geometry.groups.length) c.geometry.clearGroups();
        const ms = Array.isArray(c.material) ? c.material : [c.material];
        if (c.isMesh && ms.some((m) => m && m.normalMap) && c.geometry.index && c.geometry.attributes.uv && !c.geometry.attributes.tangent) {
            c.geometry.computeTangents();
        }
    });
    return { g, ov, ajtoG, mozog, W, H, falH, parkKozep: ket || bypass ? 0 : (balra ? -W / 2 : W / 2), ell, ff };
}

/* ---------- Felület ---------- */
function render(boxEl, o, api) {
    if (!st || st.box !== boxEl) { init(boxEl); }
    if (!st.renderer) return;
    const ujMeret = !st.o || st.o.szelesseg !== o.szelesseg || st.o.magassag !== o.magassag;
    st.o = Object.assign({}, o);
    st.api = api || st.api;
    epit(ujMeret || !st.jel);
}

function epit(nezetAlap) {
    const o = st.o;
    textura(TEX[o.lap] ? o.lap : 'tomorfa').then((tex) => {
        if (st.jel) { st.scene.remove(st.jel.g); st.overlay.remove(st.jel.ov); dispose(st.jel.g); dispose(st.jel.ov); }
        st.jel = epitJelenet(o, tex, st.szoba, st.meretek);
        st.scene.add(st.jel.g);
        st.overlay.add(st.jel.ov);
        st.ptKell = true;
        st.nyit = 0; st.cel = 0;
        st.gomb.textContent = 'Nyisd ki';
        st.meret.textContent = Math.round(st.jel.W * 100) + ' × ' + Math.round(st.jel.H * 100) + ' cm-es nyílás';
        const e = st.jel.ell;
        st.figy.hidden = !e.van;
        if (e.van) {
            st.figy.className = 'd3-figy ' + (e.jo ? 'jo' : 'keves');
            st.figy.textContent = e.jo
                ? `A nyitott ajtó elfér: kb. ${e.kell} cm hely kell, ${e.szabad} cm szabad fal van.`
                : `Figyelem: a nyitott ajtónak kb. ${e.kell} cm szabad fal kell ezen az oldalon, te ${e.szabad} cm-t adtál meg. Az ajánlatnál egyeztetjük a megoldást.`;
        }
        panelFrissit();
        st.arKesz = null; st.arGomb.textContent = 'Nézd meg a szobádban (AR)';
        if (nezetAlap) alapNezet();
        st.kell = true;
    }).catch(() => { st.msg.textContent = 'Az előnézet most nem tölthető be. Az ajánlatkérést ez nem érinti.'; });
}

function dispose(obj) {
    obj.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        const ms = Array.isArray(c.material) ? c.material : (c.material ? [c.material] : []);
        ms.forEach((m) => {
            if (m.map && m.map.isCanvasTexture) m.map.dispose();
            if (m.normalMap && m.normalMap.isCanvasTexture) m.normalMap.dispose();
            m.dispose();
        });
    });
}

function gombEl(szoveg, cls = 'btn-primary btn-outline fi-btn') {
    const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = szoveg;
    return b;
}

function init(boxEl) {
    boxEl.textContent = '';
    const wrap = document.createElement('div'); wrap.className = 'd3-wrap';
    const help = document.createElement('p'); help.className = 'fi-help';
    help.textContent = 'Húzással körbeforgathatod, két ujjal vagy görgővel nagyíthatsz. Alul élőben válthatsz anyagot, színt és vasalatot; amit itt választasz, az az ajánlatkérésbe is bekerül.';
    const gombok = document.createElement('div'); gombok.className = 'fi-btns';
    const gomb = gombEl('Nyisd ki', 'btn-primary fi-btn');
    const alap = gombEl('Alapnézet');
    const meretGomb = gombEl('Méretek elrejtése');
    const fotoGomb = gombEl('Fotóminőség: be');
    const fotoAll = document.createElement('span'); fotoAll.className = 'd3-meret';
    const ment = gombEl('Kép mentése');
    const arGomb = gombEl('Nézd meg a szobádban (AR)');
    const meret = document.createElement('span'); meret.className = 'd3-meret';
    gombok.append(gomb, alap, meretGomb, fotoGomb, ment, arGomb, meret, fotoAll);
    const figy = document.createElement('p'); figy.className = 'd3-figy'; figy.hidden = true; figy.setAttribute('role', 'status');
    const panel = document.createElement('div'); panel.className = 'd3-panel';
    const note = document.createElement('p'); note.className = 'pic-note';
    note.textContent = 'Szemléltető 3D kép. A pontos látványtervet megrendelés után kapod.';
    const msg = document.createElement('p'); msg.className = 'fi-msg'; msg.setAttribute('role', 'status');
    boxEl.append(help, wrap, figy, gombok, panel, msg, note);

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
        msg.textContent = 'Ez a böngésző nem tud 3D-t megjeleníteni. Az ajánlatkérést ez nem érinti.';
        wrap.remove(); gombok.remove(); panel.remove();
        st = { box: boxEl };
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // a PCFSoftShadowMap a 0.187-ben megszűnt; a lágyságot a shadow.radius adja
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.domElement.className = 'd3-canvas';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', 'Az ajtó 3D előnézete a választásaid szerint');
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd8d3cb);
    THREE.RectAreaLightUniformsLib.init();
    // környezeti fény: szoba-környezet kockatérképbe rajzolva (a valós idejű kép és a sugárkövető is ezt használja)
    const kockaRT = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType });
    new THREE.CubeCamera(0.1, 100, kockaRT).update(renderer, new THREE.RoomEnvironment());
    // a sugárkövető equirect (adat)textúrát kér; a kockatérképet ide alakítjuk át (a saját átalakítója a 0.187-tel nem fut)
    scene.environment = equirectKockabol(renderer, kockaRT.texture);
    kockaRT.dispose();
    scene.environmentIntensity = 0.55;
    const nap = new THREE.DirectionalLight(0xfff1de, 2.4);
    nap.position.set(-2.2, 3.6, 3.4); nap.castShadow = true;
    nap.shadow.mapSize.set(2048, 2048);
    nap.shadow.bias = -0.0004; nap.shadow.normalBias = 0.02; nap.shadow.radius = 4;
    Object.assign(nap.shadow.camera, { left: -4.5, right: 4.5, top: 3.5, bottom: -0.5, near: 0.5, far: 12 });
    scene.add(nap, new THREE.HemisphereLight(0xfff8ef, 0x7a6a58, 0.35));

    const camera = new THREE.PerspectiveCamera(42, 1, 0.03, 60);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    Object.assign(controls, {
        enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.7,
        minDistance: 1.2, maxDistance: 9,
        minAzimuthAngle: -1.35, maxAzimuthAngle: 1.35,
        minPolarAngle: 0.95, maxPolarAngle: 1.62
    });
    controls.addEventListener('change', () => { st.kell = true; st.kamValt = true; });

    // Sugárkövető (path tracing): álló nézetnél képkockáról képkockára fotórealisztikus képet számol.
    let pt = null;
    try {
        pt = new THREE.WebGLPathTracer(renderer);
        Object.assign(pt, { bounces: 6, transmissiveBounces: 8, filterGlossyFactor: 0.5, renderDelay: 150, minSamples: 2, fadeDuration: 400, renderScale: 1 });
        pt.tiles.set(3, 3);   // kis darabokban számol, hogy egy lépés se akassza meg a grafikus kártyát
        const raRajzol = () => { const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(st.overlay, st.camera); renderer.autoClear = ac; };
        pt.rasterizeSceneCallback = (sc, cam) => { renderer.render(sc, cam); raRajzol(); };
        // kevés mintánál zajszűrővel rajzoljuk ki (élmegőrző elmosás), utána a nyers, egyre tisztább képet
        const dn = new THREE.DenoiseMaterial({ sigma: 3.5, threshold: 0.04, kSigma: 1.2 });
        const dnJel = new THREE.Scene(); dnJel.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), dn));
        const dnKam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        pt.renderToCanvasCallback = (target, r, quad) => {
            const ac = r.autoClear; r.autoClear = false;
            if (pt.samples < 150 && quad.material.opacity >= 1) { dn.map = target.texture; r.render(dnJel, dnKam); }
            else quad.render(r);
            r.autoClear = ac; raRajzol();
        };
    } catch (e) { pt = null; fotoGomb.hidden = true; }

    st = { box: boxEl, wrap, renderer, scene, camera, controls, gomb, meret, msg, figy, panel, arGomb, pt, fotoAll,
           overlay: new THREE.Scene(), foto: !!pt, ptKell: true, kamValt: true,
           nyit: 0, cel: 0, kell: true, latszik: true, meretek: true, szoba: { fal: 'feher', padlo: 'vilagos' } };
    try { Object.assign(st.szoba, JSON.parse(localStorage.getItem('rnd_3d_szoba') || '{}')); } catch (e) { /* nem baj */ }

    gomb.addEventListener('click', () => { st.cel = st.cel ? 0 : 1; gomb.textContent = st.cel ? 'Csukd be' : 'Nyisd ki'; st.kell = true; });
    alap.addEventListener('click', () => { alapNezet(); st.kell = true; });
    meretGomb.addEventListener('click', () => {
        st.meretek = !st.meretek;
        meretGomb.textContent = st.meretek ? 'Méretek elrejtése' : 'Méretek mutatása';
        epit(false);
    });
    fotoGomb.addEventListener('click', () => {
        st.foto = !st.foto;
        fotoGomb.textContent = st.foto ? 'Fotóminőség: be' : 'Fotóminőség: ki';
        st.fotoAll.textContent = '';
        st.ptKell = true; st.kell = true;
    });
    ment.addEventListener('click', kepMentes);
    arGomb.addEventListener('click', ar);
    // AR csak érintőképernyős eszközön (telefon, tablet) értelmes
    arGomb.hidden = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    // csak valódi szélességváltozásra méretezünk át (a feliratok frissülése ne indítsa újra a fotószámítást)
    let elozoSzel = 0;
    if (window.ResizeObserver) {
        new ResizeObserver(() => {
            const w = wrap.clientWidth;
            if (!w || w === elozoSzel) return;
            elozoSzel = w; meretez(); st.kell = true; st.kamValt = true;
        }).observe(wrap);
    }
    if (window.IntersectionObserver) {
        new IntersectionObserver((es) => { st.latszik = es.some((e) => e.isIntersecting); st.kell = true; hurok(); }).observe(wrap);
    }
    meretez();
    hurok();
    // ha a grafikus kártya leállítja a számítást (elveszett WebGL-kontextus), ne maradjon fekete, hallgatag kép
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        st.foto = false; fotoGomb.textContent = 'Fotóminőség: ki';
        st.msg.textContent = 'A grafikus kártya túlterhelődött, ezért a 3D nézet leállt. Töltsd újra az oldalt; a megadott adataid megmaradnak.';
    });
}

// A választók (gombsorok) a jelenet alatt
function panelFrissit() {
    const o = st.o, p = st.panel;
    p.textContent = '';
    VALASZTOK.forEach((v) => {
        if (v.lathato && !v.lathato(o)) return;
        const sor = document.createElement('div'); sor.className = 'd3-sor';
        const cim = document.createElement('span'); cim.className = 'd3-cim'; cim.textContent = v.cim;
        const gs = document.createElement('div'); gs.className = 'd3-chipek'; gs.setAttribute('role', 'group'); gs.setAttribute('aria-label', v.cim);
        const aktiv = v.mezo === 'vasSzin' ? vasSzinKulcs(o) : v.mezo === 'fal3d' ? st.szoba.fal : v.mezo === 'padlo3d' ? st.szoba.padlo
            : v.mezo === 'lap' ? lapNev(o) : v.mezo === 'tipus' ? (o.tipus === 'ketszarnyu' || o.tipus === 'bypass' ? o.tipus : 'egyszarnyu')
            : v.mezo === 'irany' ? (o.irany === 'jobbra' ? 'jobbra' : 'balra') : o[v.mezo];
        v.opciok.forEach(([ertek, nev]) => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'd3-chip'; b.textContent = nev;
            b.setAttribute('aria-pressed', String(ertek === aktiv));
            b.addEventListener('click', () => valaszt(v, ertek));
            gs.appendChild(b);
        });
        sor.append(cim, gs);
        p.appendChild(sor);
    });
}

function valaszt(v, ertek) {
    const o = st.o, be = (n, e) => { o[n] = e; if (st.api && st.api.beallit) st.api.beallit(n, e); };
    if (v.mezo === 'fal3d' || v.mezo === 'padlo3d') {
        st.szoba[v.mezo === 'fal3d' ? 'fal' : 'padlo'] = ertek;
        try { localStorage.setItem('rnd_3d_szoba', JSON.stringify(st.szoba)); } catch (e) { /* nem baj */ }
    } else if (v.mezo === 'vasSzin') {
        if (ertek === 'fekete') { be('vasalatSzin', 'matt_fekete'); }
        else { be('vasalatSzin', 'egyeb'); be('vasalatEgyeb', VASSZIN[ertek].nev); }
    } else {
        if (v.mezo === 'vasalatTipus' && ertek !== 'falban' && o.tipus === 'falban') be('tipus', 'egyszarnyu');
        be(v.mezo, ertek);
    }
    epit(false);
}

function hurok() {
    if (!st || !st.renderer) return;
    const csendes = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let elozo = performance.now();
    st.renderer.setAnimationLoop(st.latszik && st.box.closest('details')?.open !== false ? (most) => {
        const dt = Math.min(0.05, (most - elozo) / 1000); elozo = most;
        st.controls.update();
        const mozog = st.nyit !== st.cel;
        if (mozog) {
            const v = csendes ? 1 : dt / 1.8;
            st.nyit = st.cel > st.nyit ? Math.min(st.cel, st.nyit + v) : Math.max(st.cel, st.nyit - v);
            st.kell = true;
            if (st.nyit === st.cel) st.ptKell = true;   // megállt az ajtó: új jelenet a sugárkövetőnek
        }
        if (!st.jel) return;
        if (st.pt && st.foto && !mozog) {
            if (st.ptKell) { st.ptKell = false; st.kamValt = false; lapokHelyzet(st.nyit); st.pt.setScene(st.scene, st.camera); }
            if (st.kamValt) { st.kamValt = false; st.pt.updateCamera(); }
            if (st.pt.samples < 1500) {
                st.pt.renderSample();
                const n = Math.floor(st.pt.samples);
                if (n !== st.utolsoMinta) { st.utolsoMinta = n; st.fotoAll.textContent = n < 2 ? 'Fotó számítása…' : `Fotóminőség: ${n} minta`; }
            }
            st.kell = false;
        } else if (st.kell) { st.kell = false; rajzol(); }
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

function alapNezet() {
    if (!st.jel) return;
    const { W, H, parkKozep } = st.jel;
    const t2 = 2 * Math.tan(THREE.MathUtils.degToRad(st.camera.fov / 2));
    const szel = W * 2.3 + 0.8, mag = H + 0.7;
    const tav = 1.08 * Math.max(szel / (t2 * st.camera.aspect), mag / t2);
    const cel = new THREE.Vector3(parkKozep / 2, (H + 0.25) / 2, 0);
    const az = (st.o && st.o.irany === 'jobbra') ? -0.5 : 0.5, pol = 1.36;
    st.controls.target.copy(cel);
    st.camera.position.set(cel.x + Math.sin(pol) * Math.sin(az) * tav, cel.y + Math.cos(pol) * tav, Math.sin(pol) * Math.cos(az) * tav);
    st.controls.maxDistance = Math.max(9, tav * 1.6);
    st.controls.update();
}

function lapokHelyzet(k) {
    const sim = k * k * (3 - 2 * k);
    st.jel.mozog.forEach((m) => {
        m.obj.position.x = m.x0 + m.ki * sim;
        m.kerekek.forEach((r) => { r.rotation.z = -(m.ki * sim) / 0.065; });
    });
}
function rajzol() {
    lapokHelyzet(st.nyit);
    st.renderer.render(st.scene, st.camera);
    const ac = st.renderer.autoClear; st.renderer.autoClear = false;
    st.renderer.render(st.overlay, st.camera);
    st.renderer.autoClear = ac;
}

/* ---------- Kép mentése ---------- */
function kepMentes() {
    if (!st.jel) return;
    // ugyanabban a lépésben olvassuk ki, mielőtt a böngésző törli a vásznat
    if (st.pt && st.foto && st.pt.samples >= 2 && st.nyit === st.cel) st.pt.renderSample(); else rajzol();
    st.renderer.domElement.toBlob((blob) => {
        if (!blob) { st.msg.textContent = 'A képet most nem sikerült elmenteni.'; return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rollndoor-ajto-3d.jpg';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/jpeg', 0.92);
}

/* ---------- AR (model-viewer) ----------
   1. érintés: az ajtó modelljét (lapok + vasalat, zárt helyzetben) GLB-be exportáljuk, és betöltjük a model-viewert.
   2. érintés: indul az AR (a böngészők csak közvetlen felhasználói érintésre engedik). */
let mvBetoltes = null;
async function ar() {
    if (st.arKesz) {
        try { st.arKesz.activateAR(); } catch (e) { st.msg.textContent = 'Az AR most nem indítható.'; }
        return;
    }
    if (st.arFolyik) return;
    st.arFolyik = true;
    st.arGomb.textContent = 'AR előkészítése…';
    st.msg.textContent = '';
    try {
        mvBetoltes = mvBetoltes || import('./vendor/model-viewer/model-viewer.min.js');
        const [, glb] = await Promise.all([mvBetoltes, exportGlb()]);
        const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
        let mv = document.getElementById('d3-ar');
        if (!mv) {
            mv = document.createElement('model-viewer');
            mv.id = 'd3-ar';
            mv.className = 'd3-ar';
            mv.setAttribute('ar', '');
            mv.setAttribute('loading', 'eager');                // a láthatatlan elem különben nem töltene be
            mv.setAttribute('ar-modes', 'webxr quick-look');   // a Scene Viewer nem tud blob: modellt megnyitni
            mv.setAttribute('ar-placement', 'wall');
            mv.setAttribute('ar-scale', 'fixed');
            mv.setAttribute('alt', 'Az ajtó 3D modellje');
            document.body.appendChild(mv);
        }
        await new Promise((ok, hiba) => {
            const t = setTimeout(() => hiba(new Error('időtúllépés')), 15000);
            mv.addEventListener('load', () => { clearTimeout(t); ok(); }, { once: true });
            mv.addEventListener('error', () => { clearTimeout(t); hiba(new Error('betöltés')); }, { once: true });
            mv.src = url;
        });
        await new Promise((r) => setTimeout(r, 300));
        if (!mv.canActivateAR) {
            st.msg.textContent = 'Ezen a készüléken a böngésző nem támogatja az AR-t. A 3D nézet ettől működik.';
            st.arGomb.textContent = 'Nézd meg a szobádban (AR)';
        } else {
            st.arKesz = mv;
            st.arGomb.textContent = 'Indítás: érintsd meg újra';
        }
    } catch (e) {
        st.msg.textContent = 'Az AR most nem készíthető elő. A 3D nézet ettől működik.';
        st.arGomb.textContent = 'Nézd meg a szobádban (AR)';
    }
    st.arFolyik = false;
}

// Az ajtó (lapok + vasalat) zárt helyzetben, a fal síkja z = 0, a nyílás közepe x = 0, a padló y = 0
async function exportGlb() {
    lapokHelyzet(0);
    const kulso = new THREE.Group();
    const c = st.jel.ajtoG.clone(true);
    c.position.z = -st.jel.ff;
    kulso.add(c);
    kulso.updateMatrixWorld(true);
    lapokHelyzet(st.nyit);
    const exp = new THREE.GLTFExporter();
    return exp.parseAsync(kulso, { binary: true, onlyVisible: true });
}

export { render };
