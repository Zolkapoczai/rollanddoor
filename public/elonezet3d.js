/* 3D előnézet a tervezőben: a választásokból (méret, elrendezés, ajtólap, szín, vasalat, irány, fogantyú)
 * egy forgatható jelenet, az ajtó gombra kinyílik. Szemléltetés, nem látványterv.
 * three.js (MIT): public/vendor/three/. Ezt a modult a tervezo.js csak a doboz kinyitásakor tölti be. */
import * as THREE from './vendor/three/three.module.min.js';

const TEX = { tomorfa: 'tomorfa', fem: 'fem', nyomatos: 'nyomatos', antik: 'antik' };
const FESTETT = { ral9016: 0xeeede6, ral9005: 0x141517, ral7016: 0x383e42, ral7035: 0xc5c7c4 };
const FAL_V = 0.14;     // falvastagság (m)
const LAP_V = 0.04;     // ajtólap-vastagság (m)
const texCache = {};
let st = null;          // egyetlen nézet a lapon

function textura(nev) {
    if (!texCache[nev]) {
        texCache[nev] = new THREE.TextureLoader().loadAsync('img/illesztes/' + nev + '.webp').then((t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            t.anisotropy = 4;
            return t;
        });
    }
    return texCache[nev];
}

function anyag(o, tex) {
    const lap = TEX[o.lap] || (o.lap === 'uveg' || o.lap === 'fem_uveg' ? o.lap : 'tomorfa');
    const festett = FESTETT[o.szin];
    if (lap === 'uveg' || lap === 'fem_uveg') {
        return { uveg: true, keret: lap === 'fem_uveg' ? (festett ?? 0x151515) : 0x9a9a9a, kemeny: lap === 'fem_uveg' };
    }
    const m = new THREE.MeshStandardMaterial({ roughness: lap === 'fem' ? 0.45 : 0.7, metalness: lap === 'fem' ? 0.55 : 0 });
    if (festett && (lap === 'tomorfa' || lap === 'fem')) {
        m.color.setHex(festett); m.metalness = 0.1; m.roughness = 0.6;
    } else {
        m.map = tex;
        if (o.szin === 'pacolt_fa' && lap === 'tomorfa') { m.color.setHex(0x8a5a36); }
    }
    return { m };
}

function doboz(w, h, d, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
}

// Egy ajtólap: középpontja (0, h/2, 0), szemből a +z oldal látszik.
function ajtolap(w, h, a, fogantyuOldal, vanFogantyu) {
    const g = new THREE.Group();
    if (a.uveg) {
        const uveg = new THREE.MeshStandardMaterial({ color: 0xcfe0e4, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1 });
        const lap = doboz(w, h, 0.012, uveg); lap.position.y = h / 2; lap.castShadow = false; g.add(lap);
        const km = new THREE.MeshStandardMaterial({ color: a.keret, roughness: 0.5, metalness: 0.3 });
        const k = a.kemeny ? 0.045 : 0.02;
        [[w, k, 0, h - k / 2], [w, k, 0, k / 2], [k, h, -w / 2 + k / 2, h / 2], [k, h, w / 2 - k / 2, h / 2]].forEach(([bw, bh, x, y]) => {
            const b = doboz(bw, bh, 0.03, km); b.position.set(x, y, 0); g.add(b);
        });
        if (a.kemeny) {
            [h / 3, 2 * h / 3].forEach((y) => { const b = doboz(w, k * 0.7, 0.03, km); b.position.set(0, y, 0); g.add(b); });
        }
    } else {
        const el = new THREE.MeshStandardMaterial({ color: a.m.map ? 0x6b4a30 : a.m.color, roughness: 0.7 });
        const lap = doboz(w, h, LAP_V, [el, el, el, el, a.m, a.m]); // +x, -x, +y, -y, +z (szemből), -z
        lap.position.y = h / 2; g.add(lap);
    }
    if (vanFogantyu) {
        const fm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.6 });
        const x = fogantyuOldal === 'jobb' ? w / 2 - 0.07 : -w / 2 + 0.07;
        [1, -1].forEach((s) => { const f = doboz(0.02, 0.32, 0.025, fm); f.position.set(x, h * 0.48, s * (LAP_V / 2 + 0.02)); g.add(f); });
    }
    return g;
}

function epitJelenet(o, tex) {
    const W = Math.min(Math.max((Number(o.szelesseg) || 90) / 100, 0.5), 3);
    const H = Math.min(Math.max((Number(o.magassag) || 210) / 100, 1.6), 3);
    const falH = Math.max(2.7, H + 0.5);
    const falban = o.vasalatTipus === 'falban' || o.tipus === 'falban';
    const ket = o.tipus === 'ketszarnyu';
    const balra = o.irany !== 'jobbra';
    const falW = Math.max(W * 7, 9);
    const g = new THREE.Group();

    // fal a nyílással (bal, jobb, szemöldök)
    const falM = new THREE.MeshStandardMaterial({ color: 0xe9e4dc, roughness: 0.95 });
    const oldal = (falW - W) / 2;
    const bal = doboz(oldal, falH, FAL_V, falM); bal.position.set(-W / 2 - oldal / 2, falH / 2, 0);
    const jobb = doboz(oldal, falH, FAL_V, falM); jobb.position.set(W / 2 + oldal / 2, falH / 2, 0);
    const fent = doboz(W, falH - H, FAL_V, falM); fent.position.set(0, H + (falH - H) / 2, 0);
    g.add(bal, jobb, fent);
    // padló és a szomszéd szoba
    const padlo = new THREE.Mesh(new THREE.PlaneGeometry(falW, 8), new THREE.MeshStandardMaterial({ color: 0xc8b496, roughness: 0.85 }));
    padlo.rotation.x = -Math.PI / 2; padlo.position.z = 0; padlo.receiveShadow = true; g.add(padlo);
    const hatso = new THREE.Mesh(new THREE.PlaneGeometry(W * 3, falH), new THREE.MeshStandardMaterial({ color: 0x9aa39a, roughness: 1 }));
    hatso.position.set(0, falH / 2, -2.2); g.add(hatso);

    // ajtólapok
    const a = anyag(o, tex);
    const lapW = ket ? W / 2 + 0.04 : W + (falban ? 0.02 : 0.1);
    const lapH = H + (falban ? -0.01 : 0.05);
    const z = falban ? 0 : FAL_V / 2 + (o.vasalatTipus === 'pajta' ? 0.07 : 0.035);
    const mozog = [];
    const lapok = ket
        ? [{ x: -W / 4 - 0.02, ki: -(lapW + 0.02), fog: 'jobb' }, { x: W / 4 + 0.02, ki: lapW + 0.02, fog: 'bal' }]
        : [{ x: 0, ki: (balra ? -1 : 1) * (lapW + 0.02) * (falban ? 0.98 : 1), fog: balra ? 'jobb' : 'bal' }];
    lapok.forEach((l) => {
        const lap = ajtolap(lapW, lapH, a, l.fog, o.fogantyu);
        lap.position.set(l.x, falban ? 0.005 : 0.012, z);
        g.add(lap);
        mozog.push({ obj: lap, x0: l.x, ki: l.ki, kerekek: [] });
    });

    // vasalat
    const fekete = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.45, metalness: 0.6 });
    if (o.vasalatTipus === 'pajta' && !falban) {
        const hossz = ket ? W * 2 + 0.6 : W * 2 + 0.4;
        const kozep = ket ? 0 : (balra ? -W / 2 : W / 2);
        const sin = doboz(hossz, 0.05, 0.012, fekete); sin.position.set(kozep, lapH + 0.11, FAL_V / 2 + 0.035); g.add(sin);
        const sin2 = doboz(hossz, 0.04, 0.012, fekete); sin2.position.set(kozep, lapH + 0.11, FAL_V / 2 + 0.008); g.add(sin2); // belső sín
        mozog.forEach((m) => {
            [-lapW / 2 + 0.15, lapW / 2 - 0.15].forEach((dx) => {
                const kerek = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 32), fekete);
                kerek.rotation.x = Math.PI / 2; kerek.castShadow = true;
                const tarto = new THREE.Group();
                // a kerék a külső sín tetején ül; a lap csoportjához képest hátrébb, a sín síkjában
                tarto.position.set(dx, lapH + 0.19 - 0.012, -0.035);
                tarto.add(kerek);
                const pant = doboz(0.04, 0.34, 0.012, fekete); pant.position.set(0, -0.13, 0.035 + LAP_V / 2 + 0.006);
                tarto.add(pant);
                m.obj.add(tarto);
                m.kerekek.push(kerek);
            });
        });
    } else if (o.vasalatTipus === 'rejtett' && !falban) {
        // a sín a falon, falszínű takaróléc mögött: kívülről nem látszik
        const lec = doboz(W * 2 + 0.6, 0.12, 0.12, falM);
        lec.position.set(ket ? 0 : (balra ? -W / 2 : W / 2), lapH + 0.06, FAL_V / 2 + 0.06); g.add(lec);
    }
    // falban futó: a zseb a falon belül (a lap a fal dobozában eltűnik); a tok éle
    if (falban) {
        const tokM = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.9 });
        [-1, 1].forEach((s) => { const t = doboz(0.02, H, FAL_V + 0.01, tokM); t.position.set(s * (W / 2 - 0.01), H / 2, 0); g.add(t); });
    }
    return { g, mozog, W, H, falH };
}

function render(box, o) {
    if (!st || st.box !== box) { init(box); }
    st.o = o;
    const lapNev = TEX[o.lap] || 'tomorfa';
    textura(lapNev).then((tex) => {
        if (st.jel) { st.scene.remove(st.jel.g); dispose(st.jel.g); }
        st.jel = epitJelenet(o, tex);
        st.scene.add(st.jel.g);
        st.nyit = 0; st.cel = 0;
        st.gomb.textContent = 'Nyisd ki';
        st.meret.textContent = Math.round(st.jel.W * 100) + ' × ' + Math.round(st.jel.H * 100) + ' cm-es nyílás';
        kamera();
        rajzol();
    }).catch(() => { st.msg.textContent = 'Az előnézet most nem tölthető be. Az ajánlatkérést ez nem érinti.'; });
}

function dispose(obj) {
    obj.traverse((c) => { if (c.geometry) c.geometry.dispose(); });
}

function init(box) {
    box.textContent = '';
    const wrap = document.createElement('div'); wrap.className = 'd3-wrap';
    const help = document.createElement('p'); help.className = 'fi-help';
    help.textContent = 'Ujjal vagy egérrel forgathatod. A gombbal kinyithatod az ajtót.';
    const gombok = document.createElement('div'); gombok.className = 'fi-btns';
    const gomb = document.createElement('button'); gomb.type = 'button'; gomb.className = 'btn-primary fi-btn'; gomb.textContent = 'Nyisd ki';
    const alap = document.createElement('button'); alap.type = 'button'; alap.className = 'btn-primary btn-outline fi-btn'; alap.textContent = 'Szemből';
    const meret = document.createElement('span'); meret.className = 'd3-meret';
    gombok.append(gomb, alap, meret);
    const note = document.createElement('p'); note.className = 'pic-note';
    note.textContent = 'Szemléltető 3D kép, nem méretarányos részletekkel. A pontos látványtervet megrendelés után kapod.';
    const msg = document.createElement('p'); msg.className = 'fi-msg'; msg.setAttribute('role', 'status');
    box.append(help, wrap, gombok, msg, note);

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
        msg.textContent = 'Ez a böngésző nem tud 3D-t megjeleníteni. Az ajánlatkérést ez nem érinti.';
        wrap.remove(); gombok.remove();
        st = { box, scene: new THREE.Scene(), gomb, meret, msg };
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = 'd3-canvas';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', 'Az ajtó 3D előnézete a választásaid szerint');
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x5a5048, 1.7));
    const nap = new THREE.DirectionalLight(0xffffff, 2.1);
    nap.position.set(-2.5, 4, 4); nap.castShadow = true;
    nap.shadow.mapSize.set(1024, 1024);
    Object.assign(nap.shadow.camera, { left: -4, right: 4, top: 4, bottom: -1, near: 0.5, far: 15 });
    scene.add(nap);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);

    st = { box, wrap, renderer, scene, camera, gomb, meret, msg, yaw: 0.35, pitch: 0.12, nyit: 0, cel: 0, fut: false };

    gomb.addEventListener('click', () => {
        st.cel = st.cel ? 0 : 1;
        gomb.textContent = st.cel ? 'Csukd be' : 'Nyisd ki';
        anim();
    });
    alap.addEventListener('click', () => { st.yaw = 0; st.pitch = 0.08; kamera(); rajzol(); });

    // forgatás húzással (ujj és egér), a lap görgetését nem akadályozza: csak vízszintes húzás forgat
    let huz = null;
    const c = renderer.domElement;
    c.style.touchAction = 'pan-y';
    c.addEventListener('pointerdown', (e) => { huz = { x: e.clientX, y: e.clientY, yaw: st.yaw, pitch: st.pitch }; });
    c.addEventListener('pointermove', (e) => {
        if (!huz) return;
        st.yaw = Math.max(-1.0, Math.min(1.0, huz.yaw - (e.clientX - huz.x) * 0.006));
        st.pitch = Math.max(-0.05, Math.min(0.5, huz.pitch + (e.clientY - huz.y) * 0.004));
        kamera(); rajzol();
    });
    const vege = () => { huz = null; };
    c.addEventListener('pointerup', vege); c.addEventListener('pointercancel', vege); c.addEventListener('pointerleave', vege);

    if (window.ResizeObserver) { new ResizeObserver(() => { meretez(); rajzol(); }).observe(wrap); }
    meretez();
}

function meretez() {
    if (!st.renderer) return;
    const w = st.wrap.clientWidth || 600;
    const h = Math.round(Math.min(w * (w < 500 ? 1.1 : 0.75), window.innerHeight * 0.7)); // telefonon magasabb kép
    st.renderer.setSize(w, h, true);
    st.camera.aspect = w / h;
    st.camera.updateProjectionMatrix();
}

function kamera() {
    if (!st.renderer || !st.jel) return;
    const { W, H } = st.jel;
    // akkora távolság, hogy a nyílás, a kinyitott ajtó és a sín is beférjen
    const t2 = 2 * Math.tan(THREE.MathUtils.degToRad(st.camera.fov / 2));
    const szel = W * 2.2 + 0.6;   // nyílás + kinyitott ajtó + sín
    const mag = H + 0.55;         // padlótól a sín fölé
    const tav = 1.12 * Math.max(szel / (t2 * st.camera.aspect), mag / t2);
    const cel = new THREE.Vector3(st.o && st.o.tipus === 'ketszarnyu' ? 0 : (st.o && st.o.irany === 'jobbra' ? W * 0.45 : -W * 0.45), (H + 0.3) / 2, 0);
    st.camera.position.set(
        cel.x + Math.sin(st.yaw) * Math.cos(st.pitch) * tav,
        cel.y + Math.sin(st.pitch) * tav,
        Math.cos(st.yaw) * Math.cos(st.pitch) * tav
    );
    st.camera.lookAt(cel);
}

function rajzol() {
    if (!st.renderer || !st.jel) return;
    const k = st.nyit, sim = k * k * (3 - 2 * k); // finom indulás és megállás
    st.jel.mozog.forEach((m) => {
        m.obj.position.x = m.x0 + m.ki * sim;
        m.kerekek.forEach((r) => { r.rotation.y = -(m.ki * sim) / 0.055; });
    });
    st.renderer.render(st.scene, st.camera);
}

function anim() {
    if (st.fut) return;
    st.fut = true;
    const csendes = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let elozo = performance.now();
    const lep = (most) => {
        const dt = (most - elozo) / 1000; elozo = most;
        const v = csendes ? 1 : dt / 1.6; // 1,6 mp alatt nyílik
        st.nyit = st.cel > st.nyit ? Math.min(st.cel, st.nyit + v) : Math.max(st.cel, st.nyit - v);
        rajzol();
        if (st.nyit !== st.cel) requestAnimationFrame(lep); else st.fut = false;
    };
    requestAnimationFrame(lep);
}

export { render };
