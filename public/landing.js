// A TURNSTILE_SITEKEY a kozos.js-ben van (előbb töltődik be).
// A navigációs rész a mintaoldal script.js-ével azonos; az ajánlatkérő űrlap valódi, a galéria körhinta lett.

// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        const targetId = this.getAttribute('href');
        if(targetId === '#') return;

        const targetElement = document.querySelector(targetId);
        if(targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Quote Form Submission (valódi beküldés a /api/igeny végpontra)
const CHECK_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>';
const quoteForm = document.getElementById('quoteForm');
const quoteError = document.getElementById('quoteError');
let quoteWidget = null;

function renderQuoteTurnstile() {
    if (!quoteForm || quoteWidget !== null) return;
    if (!window.turnstile) { setTimeout(renderQuoteTurnstile, 300); return; }
    quoteWidget = window.turnstile.render('#quoteTurnstile', {
        sitekey: TURNSTILE_SITEKEY,
        appearance: 'interaction-only'
    });
}
renderQuoteTurnstile();

function showQuoteError(text) {
    quoteError.textContent = text + ' Hívj minket: ';
    const a = document.createElement('a');
    a.href = 'tel:+36205650661';
    a.textContent = '06 20 565 0661';
    quoteError.appendChild(a);
    quoteError.hidden = false;
}

async function waitForTurnstileToken(maxMs) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
        try {
            const t = window.turnstile && quoteWidget !== null ? window.turnstile.getResponse(quoteWidget) : '';
            if (t) return t;
        } catch (_) { /* még nincs kész */ }
        await new Promise(r => setTimeout(r, 250));
    }
    return '';
}

if (quoteForm) quoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    quoteError.hidden = true;
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = 'Küldés folyamatban...';
    btn.style.opacity = '0.7';

    const interest = document.getElementById('interest');
    const dims = document.getElementById('dimensions').value.trim();
    const uzenet = 'Mire van szükség: ' + interest.options[interest.selectedIndex].text + '\n' +
        'Közelítő méret: ' + (dims || 'nem adta meg');

    const data = new FormData();
    data.append('forras', 'urlap');
    data.append('nev', document.getElementById('name').value.trim());
    data.append('email', document.getElementById('email').value.trim());
    data.append('uzenet', uzenet);
    data.append('cf-turnstile-response', await waitForTurnstileToken(6000));

    try {
        const res = await fetch('/api/igeny', { method: 'POST', body: data });
        let json = null;
        try { json = await res.json(); } catch (_) { /* nem JSON */ }

        if (res.ok && json && json.ok === true) {
            btn.innerHTML = 'Sikeres Ajánlatkérés! ' + CHECK_ICON;
            btn.style.backgroundColor = '#4ade80'; // Success green
            btn.style.color = '#121212';
            btn.style.opacity = '1';
            e.target.reset();

            if (!document.getElementById('quoteThanks')) {
                const thanks = document.createElement('div');
                thanks.id = 'quoteThanks';
                thanks.className = 'quote-thanks';
                thanks.setAttribute('role', 'status');
                const h = document.createElement('h3');
                h.textContent = 'Megkaptuk!';
                const p = document.createElement('p');
                p.textContent = '1 munkanapon belül keresünk. Küldtünk egy visszaigazoló e-mailt is.';
                thanks.appendChild(h);
                thanks.appendChild(p);
                quoteForm.insertBefore(thanks, btn.nextSibling);
            }

            // Return to normal after 3 seconds (ahogy a mintán)
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.backgroundColor = '';
                btn.style.color = '';
                btn.disabled = false;
            }, 3000);
        } else {
            showQuoteError((json && json.hiba) || 'Nem sikerült elküldeni.');
            btn.innerHTML = originalText;
            btn.style.opacity = '';
            btn.disabled = false;
        }
    } catch (_) {
        showQuoteError('Nem sikerült elküldeni, kérjük, próbáld újra később.');
        btn.innerHTML = originalText;
        btn.style.opacity = '';
        btn.disabled = false;
    }
    if (window.turnstile && quoteWidget !== null) {
        try { window.turnstile.reset(quoteWidget); } catch (_) { /* ignore */ }
    }
});

// Galéria: a képek sorrendje és neve egyetlen helyen, itt van (az index.html-ben nincs külön lista).
// [fájlnév kiterjesztés nélkül, megjelenő név, 1 = vasalat-részletkép]
// A típusnevek a docs/ajtomintaelnevezések.jpg ábráját követik. Ugyanannak a lakásnak a képei
// legalább 12 hellyel távolabb vannak egymástól, a részletképek kb. minden 8. helyen jönnek.
const galleryImages = [
    ['ref-01-nappali-fa-ajto', 'Sima – natúr fa'],
    ['ref-05-rusztikus-ajtopar', 'Dupla Z, kétszárnyú – natúr fa'],
    ['ref-03-fenyo-ajtopar-haloszoba', 'Vízszintes osztó, kétszárnyú – natúr fa'],
    ['ref-12-turkiz-biciklis-lampa', 'Átló – petrolzöld'],
    ['ref-09-kandallo-z-ajto', 'Átló – mézbarna'],
    ['ref-14-szurke-x-ketszarnyu', 'Dupla Z, kétszárnyú – szürkésbarna'],
    ['ref-38-logos-sinveg-gorgo', 'Sínvég logóval – fekete', 1],
    ['ref-08-furdo-rusztikus', 'Dupla Z – rusztikus barna'],
    ['ref-37-konyha-z-ajto', 'Átló – mézbarna'],
    ['ref-17-fekete-osztasu-uveg', 'Üveges, kétszárnyú – natúr fa'],
    ['ref-67-turkiz-z-gardrob', 'Dupla Z – kék'],
    ['ref-28-zold-uveges', 'Üveges – zöld'],
    ['ref-80-z-ajto-kutyak', 'Dupla Z – mézbarna'],
    ['ref-72-fenyo-deszka-gorgos', 'Sima – natúr fa'],
    ['ref-39-sinrendszer-reszlet', 'Kültéri sín – fekete', 1],
    ['ref-20-fekete-uveges-furdo', 'Üveges – fehér'],
    ['ref-02-feher-uveges-ketszarnyu', 'Üveges, kétszárnyú – kopott fehér'],
    ['ref-11-mentazold-furdo', 'Dupla Z – menta'],
    ['ref-56-rusztikus-z-folyoso', 'Átló – mézbarna'],
    ['ref-04-szurkeszold-ketszarnyu', 'Dupla Z, kétszárnyú – szürkészöld'],
    ['ref-68-szurkesfeher-z', 'Átló – szürke'],
    ['ref-87-logos-sinveg-feher-fal', 'Sínvég logóval – fekete', 1],
    ['ref-07-sotet-fal-fenyo', 'Átló – natúr fa'],
    ['ref-19-mertani-uveges', 'Üveges, kétszárnyú – kopott fehér'],
    ['ref-73-iroasztalos-sarok', 'Vízszintes osztó – natúr fa'],
    ['ref-51-sarga-fal-natur-fekete', 'Átló és fekete betétes, kétszárnyú – mézbarna'],
    ['ref-55-halvanyzold-nyilhegy', 'Átló – világoszöld'],
    ['ref-25-elfas-furdo', 'Szeletelt fatörzs – natúr fa'],
    ['ref-36-kulteri-fa', 'Átló, kétszárnyú – mézbarna'],
    ['ref-88-gorgo-akaszto-turkiz', 'Görgő közelről – türkiz ajtón', 1],
    ['ref-49-sotet-voros-deszkas', 'Fejelőléces – sötétbarna'],
    ['ref-23-templomos-minta', 'Fotónyomatos (szegedi dóm) – fekete'],
    ['ref-06-konyha-fa-ajto', 'Átló – natúr fa'],
    ['ref-44-uveges-sarok-fotel', 'Üveges – kopott fehér'],
    ['ref-34-sarga-folyoso', 'Vízszintes osztó – sárga'],
    ['ref-54-feher-x-nyilhegy', 'Dupla Z – kopott fehér'],
    ['ref-46-fenyo-z-sotet-fal', 'Átló – natúr fa'],
    ['ref-86-gorgo-szurke-fem', 'Görgő közelről – acél', 1],
    ['ref-64-feher-deszkas-furdo', 'Alsó Z – kopott fehér'], // TODO Ricsi: nincs a 8 típus között (felül sima, alul átló)
    ['ref-16-uveges-nappali', 'Üveges, kétszárnyú – natúr fa'],
    ['ref-10-feher-x-ajto', 'Alsó X – fehér'], // TODO Ricsi: nincs a 8 típus között (az X alul van)
    ['ref-13-kek-gardrob', 'Dupla Z – kék'],
    ['ref-15-feher-x-ketszarnyu', 'Dupla Z, kétszárnyú – fehér'],
    ['ref-32-sotetbarna-ketszarnyu', 'Fejelőléces, kétszárnyú – sötétbarna'], // TODO Ricsi: középen osztó is van
    ['ref-45-fenyo-marvanypadlo', 'Vízszintes osztó – natúr fa'],
    ['ref-60-feher-fekete-lepcso', 'Krétatáblás – fehér-fekete'],
    ['ref-48-fenyo-ketszarnyu-fa-mennyezet', 'Dupla Z, kétszárnyú – natúr fa'],
    ['ref-84-lyukmintas-vilagito', 'Sín lyukmintás ajtón – szürke', 1],
    ['ref-57-szurkesbarna-z-konyha', 'Dupla Z – szürkésbarna'],
    ['ref-41-natur-teglafal-fenyfuzer', 'Sima – natúr fa'],
    ['ref-62-feher-deszkas', 'Vízszintes osztó – fehér'],
    ['ref-27-kazettas-felujitott', 'Antik kazettás – natúr fa'],
    ['ref-70-natur-furdo-bejarat', 'Átló – natúr fa'],
    ['ref-52-feher-matt-uveg-kopott', 'Üveges – kopott fehér'],
    ['ref-63-feher-kazettas-kanape', 'Kazettás – fehér'],
    ['ref-40-kreta-szerelem', 'Krétatáblás – fekete'],
    ['ref-85-rez-ajtolap-logos', 'Görgő logóval – acél', 1],
    ['ref-69-feher-kazettas-gorgo', 'Vízszintes osztó – fehér'],
    ['ref-24-elfas-halo', 'Szeletelt fatörzs – natúr fa'],
    ['ref-74-regi-kazettas-rombusz', 'Antik kazettás – barna'],
    ['ref-53-feher-matt-uveg-parketta', 'Üveges – fehér'],
    ['ref-82-hid-minta-biciklis', 'Fotónyomatos (híd) – kék'],
    ['ref-65-tukros-furdo', 'Tükrös – fehér'],
    ['ref-30-etterem-kek', 'Dupla Z – kék'], // TODO Ricsi: a képen az ajtó csak részben látszik
    ['ref-90-logos-sinveg-szott-fal', 'Sínvég logóval – fekete', 1],
    ['ref-42-uveges-par-teglafal', 'Üveges, kétszárnyú – kopott fehér'],
    ['ref-21-fekete-negyosztasu', 'Üveges – fekete'],
    ['ref-26-antik-diszes', 'Antik, faragott – kopott patinás krémszín'],
    ['ref-61-feher-kazettas-folyoso', 'Vízszintes osztó – fehér'],
    ['ref-33-sarga-uveges-ketszarnyu', 'Üveges, kétszárnyú – sárga'],
    ['ref-31-leces-zold-fal', 'Lécezett – natúr fa'],
    ['ref-35-lezervagott-feher', 'Lézervágott, kétszárnyú – fehér'],
    ['ref-89-rozsdas-ipari', 'Görgő közelről – rozsdás', 1],
    ['ref-29-femburkolatu', 'Fém, szegecselt – acél'],
    ['ref-18-rombuszos-uveges', 'Üveges, kétszárnyú – natúr és fekete'],
    ['ref-22-fenykepes-nappali', 'Fotónyomatos – fehér'],
    ['ref-47-feher-z-parketta', 'Átló – fehér'],
    ['ref-71-natur-deszkas-mosdo', 'Fejelőléces – natúr fa'],
    ['ref-59-feher-fekete-ketszarnyu', 'Krétatáblás, kétszárnyú – fehér-fekete'],
    ['ref-58-eloszoba-etkezo', 'Vízszintes osztó – natúr fa']
].map(([file, name, detail]) => ({
    src: 'img/referencia/' + file + '.webp',
    thumb: 'img/referencia/' + file + '-s.webp',
    name,
    alt: detail ? 'Tolóajtó-vasalat: ' + name : name + ' tolóajtó'
}));

// Galéria-körhinta: középen a nagy kép, két oldalt egy-egy kisebb szomszéd, magától lapoz.
// Egyszerre csak az aktív kép, a két szomszéd és a következő néhány kép töltődik be.
(function () {
    const root = document.getElementById('gallery-carousel');
    if (!root) return;

    const AUTO_MS = 2000;        // ennyi ideig áll egy kép
    const TOUCH_RESUME_MS = 2000; // érintés után ennyivel indul újra
    const n = galleryImages.length;
    const stage = root.querySelector('.gallery-stage');
    const caption = root.querySelector('.gallery-caption');
    const count = root.querySelector('.gallery-count');
    const live = root.querySelector('.gallery-live');
    const playBtn = root.querySelector('.gallery-play');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const saveData = !!(navigator.connection && navigator.connection.saveData);

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxClose = lightbox.querySelector('.close-lightbox');

    let current = 0;
    let timer = null;
    let userPaused = false;   // a látogató megállította
    let forced = false;       // a látogató kifejezetten elindította: a billentyűzet-fókusz sem állítja meg
    let touchHold = false;
    let touchTimer = null;
    let onScreen = false;
    let lightboxOpen = false;
    let swiped = false;

    const slides = galleryImages.map((item, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gallery-slide';
        const blur = document.createElement('span');
        blur.className = 'gallery-slide-blur';
        blur.setAttribute('aria-hidden', 'true');
        const img = document.createElement('img');
        img.alt = item.alt;
        img.decoding = 'async';
        img.draggable = false;
        btn.append(blur, img);
        btn.addEventListener('click', () => {
            if (swiped) return;
            if (i === current) openLightbox(); else show(i, true);
        });
        stage.appendChild(btn);
        return { btn, blur, img, loaded: false, full: false };
    });

    // Hány hellyel van a kép az aktívtól (körbeér: -n/2 … n/2).
    const offset = (i) => ((i - current + n + Math.floor(n / 2)) % n) - Math.floor(n / 2);

    function load(i) {
        const s = slides[i];
        if (s.loaded) return;
        s.loaded = true;
        s.img.src = galleryImages[i].thumb;
        s.blur.style.backgroundImage = 'url("' + galleryImages[i].thumb + '")';
    }

    // Az aktív kép a kis változattal jelenik meg azonnal, majd élesebbre cserélődik.
    function sharpen(i) {
        const s = slides[i];
        if (s.full || saveData) return;
        s.full = true;
        const hi = new Image();
        hi.onload = () => { s.img.src = hi.src; };
        hi.src = galleryImages[i].src;
    }

    const POS = { '-2': 'is-far-prev', '-1': 'is-prev', '0': 'is-active', '1': 'is-next', '2': 'is-far-next' };

    function render() {
        slides.forEach((s, i) => {
            const d = offset(i);
            const cls = POS[d] || '';
            s.btn.className = 'gallery-slide' + (cls ? ' ' + cls : '');
            const reachable = Math.abs(d) <= 1;
            s.btn.tabIndex = reachable ? 0 : -1;
            s.btn.inert = !reachable;
            if (reachable) s.btn.removeAttribute('aria-hidden'); else s.btn.setAttribute('aria-hidden', 'true');
            const name = galleryImages[i].name;
            if (d === 0) s.btn.setAttribute('aria-label', 'Nagyítás: ' + name);
            else if (d === -1) s.btn.setAttribute('aria-label', 'Előző kép: ' + name);
            else if (d === 1) s.btn.setAttribute('aria-label', 'Következő kép: ' + name);
            else s.btn.removeAttribute('aria-label');
            if (d >= -1 && d <= 3) load(i);
        });
        sharpen(current);
        caption.textContent = galleryImages[current].name;
        count.textContent = (current + 1) + ' / ' + n;
    }

    function show(i, manual) {
        current = ((i % n) + n) % n;
        render();
        if (manual) live.textContent = (current + 1) + ' / ' + n + ': ' + galleryImages[current].name;
        if (lightboxOpen) updateLightbox();
        schedule();
    }
    const step = (dir, manual) => show(current + dir, manual);

    // --- Automatikus lapozás ---
    function keyboardFocusInside() {
        const a = document.activeElement;
        return !!a && root.contains(a) && a.matches(':focus-visible');
    }
    function canPlay() {
        if (calm.matches || userPaused || lightboxOpen || touchHold || !onScreen || document.hidden) return false;
        // Az egér nem állítja meg (Zoli kérése): csak a billentyűzet-fókusz és a megállító gomb.
        return forced || !keyboardFocusInside();
    }
    function schedule() {
        clearTimeout(timer);
        timer = null;
        if (canPlay()) timer = setTimeout(() => step(1, false), AUTO_MS);
    }
    function syncPlayButton() {
        playBtn.hidden = calm.matches;
        playBtn.classList.toggle('is-paused', userPaused);
        playBtn.setAttribute('aria-label', userPaused ? 'Automatikus lapozás indítása' : 'Automatikus lapozás megállítása');
    }

    playBtn.addEventListener('click', () => {
        userPaused = !userPaused;
        forced = !userPaused;
        syncPlayButton();
        schedule();
    });
    root.querySelector('.gallery-prev').addEventListener('click', () => step(-1, true));
    root.querySelector('.gallery-next').addEventListener('click', () => step(1, true));

    root.addEventListener('focusin', schedule);
    root.addEventListener('focusout', () => setTimeout(schedule, 0));
    document.addEventListener('visibilitychange', schedule);
    calm.addEventListener('change', () => { syncPlayButton(); schedule(); });
    new IntersectionObserver((entries) => {
        onScreen = entries[0].isIntersecting;
        schedule();
    }, { threshold: 0.3 }).observe(stage);

    // --- Érintés és húzás ---
    let down = null;
    root.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return;
        touchHold = true;
        clearTimeout(touchTimer);
        schedule();
    });
    stage.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    function pointerEnd(e) {
        if (e.pointerType !== 'mouse') {
            clearTimeout(touchTimer);
            touchTimer = setTimeout(() => { touchHold = false; schedule(); }, TOUCH_RESUME_MS);
        }
        if (!down || down.id !== e.pointerId) return;
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        down = null;
        if (e.type === 'pointerup' && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            swiped = true; // a húzás végi kattintás ne nyisson nagyítót
            setTimeout(() => { swiped = false; }, 350);
            step(dx < 0 ? 1 : -1, true);
        }
    }
    window.addEventListener('pointerup', pointerEnd);
    window.addEventListener('pointercancel', pointerEnd);

    // --- Nagyító ---
    function updateLightbox() {
        lightboxImg.src = galleryImages[current].src;
        lightboxImg.alt = galleryImages[current].alt;
        lightboxCaption.textContent = galleryImages[current].name;
    }
    function openLightbox() {
        lightboxOpen = true;
        lightbox.style.display = 'block';
        updateLightbox();
        document.body.style.overflow = 'hidden';
        lightboxClose.focus();
        schedule();
    }
    function closeLightbox() {
        lightboxOpen = false;
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
        slides[current].btn.focus({ preventScroll: true });
        schedule();
    }
    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.querySelector('.lightbox-prev').addEventListener('click', () => step(-1, true));
    lightbox.querySelector('.lightbox-next').addEventListener('click', () => step(1, true));
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

    // --- Billentyűzet: nagyítóban mindig, egyébként ha a fókusz a galériában van (vagy sehol, és a galéria látszik) ---
    document.addEventListener('keydown', (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (lightboxOpen) {
            if (e.key === 'Escape') closeLightbox();
            else if (e.key === 'ArrowRight') step(1, true);
            else if (e.key === 'ArrowLeft') step(-1, true);
            return;
        }
        const a = document.activeElement;
        const here = root.contains(a) || ((!a || a === document.body) && onScreen);
        if (!here) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1, true); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1, true); }
    });

    syncPlayButton();
    render();
})();

// --- Tolóajtó-típusok: kattintásra részletes ablak. VÁZLAT-szövegek, validálásra várnak. ---
(function () {
    const dlg = document.getElementById('type-dialog');
    if (!dlg || typeof dlg.showModal !== 'function') return;
    // Ajtólapoknál Ricsi kérésére nincs részletes lista, csak nagy kép és rövid szöveg.
    const TYPES = {
        tomorfa: {
            title: 'Tömörfa ajtólapok',
            img: 'img/galeria-02-loft-tomorfa.webp',
            text: 'Természetes erezet, időtálló tartás és valódi fa karakter, egyedi méretre és színre szabva. Bármelyik vasalatunkkal kérheted.',
            list: []
        },
        nyomatos: {
            title: 'Nyomatos ajtólapok',
            img: 'img/referencia/ref-23-templomos-minta.webp',
            text: 'Egyedi grafika, fotó vagy minta prémium minőségben – az ajtód az otthonod központi dizájneleme lesz. Bármelyik vasalatunkkal kérheted.',
            list: []
        },
        fem: {
            title: 'Fém ajtólapok',
            img: 'img/ajtolap-fem.webp',
            text: 'Letisztult, indusztriális megjelenés és masszív szerkezet modern vagy loft terekbe tervezve. Bármelyik vasalatunkkal kérheted.',
            list: []
        },
        antik: {
            title: 'Antik ajtólapok',
            img: 'img/galeria-06-antik-diszes-ajto.webp',
            text: 'Különleges, patinás és rusztikus darabok egyedi történettel, modern dupla sínes működésre hangolva. Bármelyik vasalatunkkal kérheted.',
            list: []
        },
        uveg: {
            title: 'Üvegbetétes ajtólapok',
            img: 'img/galeria-09-feher-uveges-ajto.webp',
            text: 'Az üvegbetét átengedi a fényt, így a tér nyitottabb és világosabb marad. Bármelyik vasalatunkkal kérheted.',
            list: []
        },
        pajta: {
            title: 'Pajtaajtó-vasalat látszó görgőkkel',
            img: 'img/tipus-pajta.webp',
            text: 'A klasszikus pajtaajtó: a fémsín és a görgők szándékosan látszanak, a vasalat a helyiség jellegzetes eleme lesz. Ipari, loft és vidéki stílushoz egyaránt jól illik.',
            list: ['Látszó fémsín a fal előtt, görgőkkel és konzolokkal', 'Szín: RAL/NCS szerint festve', 'Az ajtólap kiegészíti a vasalatot, a kettő egy látványelem', 'Falra szerelhető: a fal teherbírását előre ellenőrizzük (TODO: pontos feltételek)']
        },
        rejtett: {
            title: 'Rejtett, csapágyazott görgős vasalat',
            img: 'img/tipus-rejtett.webp',
            text: 'A csapágyazott görgők rejtett sínben futnak, így az ajtó csendesen és könnyen mozog, a vasalatból pedig alig látszik valami. Letisztult, modern terekhez.',
            list: ['Csapágyazott görgők, halk és sima futás', 'A sín a mennyezetbe vagy a falba süllyesztve', 'Visszafogott megjelenés, az ajtólap kerül előtérbe', 'Beépítés előtt a helyszín felmérése szükséges (TODO: részletek)']
        },
        lebego: {
            title: 'Lebegő, láthatatlan vasalat',
            img: 'img/tipus-lebego.webp',
            text: 'Az ajtólap mintha a levegőben lebegne: a vasalat a felső szerkezetben vagy a lap élében rejtőzik, így nincs látható sín vagy görgő. Prémium, minimalista hatás.',
            list: ['A vasalat nem látszik, az ajtólap „úszik"', 'Tiszta vonalak, nincs látható sín', 'Szabott méret és felület az ajtólaphoz', 'Teherbírás, lapvastagság, méretkorlát: TODO (validálandó)']
        },
        falban: {
            title: 'Falban futó ajtó',
            img: 'img/tipus-falban.webp',
            text: 'Nyitott állapotban az ajtó teljesen a falba csúszik, és nem látszik. Nem foglal helyet a szobában, és nem kell kitérni előle. Szűk terekhez és letisztult folyosókhoz ideális.',
            list: ['Az ajtólap a falszerkezetben fut (zsebes megoldás)', 'Nyitva nincs útban az ajtó, helyet takarít meg', 'Beépítése falszerkezeti munkát igényel, érdemes a tervezés elején eldönteni', 'Falvastagság és szerkezeti feltételek: TODO (validálandó)']
        }
    };
    let opener = null;
    const imgEl = dlg.querySelector('.type-dialog-img');
    document.querySelectorAll('.type-card').forEach((btn) => {
        btn.addEventListener('click', () => {
            const t = TYPES[btn.dataset.type];
            if (!t) return;
            opener = btn;
            dlg.querySelector('#type-dialog-title').textContent = t.title;
            dlg.querySelector('.type-dialog-text').textContent = t.text;
            const ul = dlg.querySelector('.type-dialog-list');
            ul.replaceChildren(...t.list.map((s) => { const li = document.createElement('li'); li.textContent = s; return li; }));
            imgEl.style.backgroundImage = "url('" + t.img + "')";
            imgEl.setAttribute('aria-label', t.title);
            dlg.showModal();
            document.body.style.overflow = 'hidden';
        });
    });
    dlg.addEventListener('close', () => { document.body.style.overflow = ''; if (opener) opener.focus({ preventScroll: true }); });
    dlg.querySelector('.type-dialog-close').addEventListener('click', () => dlg.close());
    dlg.querySelector('.type-dialog-cta').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
})();
