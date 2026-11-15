// A TURNSTILE_SITEKEY a kozos.js-ben van (előbb töltődik be).
// A navigációs és galéria rész a mintaoldal script.js-ével azonos; csak az ajánlatkérő űrlap lett valódi.

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

// Lightbox Gallery Logic
const galleryImages = [
    { src: "img/referencia/ref-01-nappali-fa-ajto.webp", alt: "Fa tolóajtó fekete sínen egy nappaliban, pampafű és zöld bársony fotel mellett" },
    { src: "img/referencia/ref-02-feher-uveges-ketszarnyu.webp", alt: "Fehér, kopott festésű, üveges kétszárnyú tolóajtó fekete sínen, téglafal és tükör mellett" },
    { src: "img/referencia/ref-03-fenyo-ajtopar-haloszoba.webp", alt: "Két natúr fenyő tolóajtó egy nappali és egy hálószoba között" },
    { src: "img/referencia/ref-04-szurkeszold-ketszarnyu.webp", alt: "Szürkészöld, Z-merevítéses kétszárnyú tolóajtó fekete sínen" },
    { src: "img/referencia/ref-05-rusztikus-ajtopar.webp", alt: "Rusztikus, Z-mintás tolóajtópár egy hálószobában" },
    { src: "img/referencia/ref-06-konyha-fa-ajto.webp", alt: "Fa tolóajtó egy konyhában, kék konyhaszigettel" },
    { src: "img/referencia/ref-07-sotet-fal-fenyo.webp", alt: "Natúr fenyő tolóajtó sötét falon, hosszú fekete sínen" },
    { src: "img/referencia/ref-08-furdo-rusztikus.webp", alt: "Rusztikus fa tolóajtó egy fürdőszoba bejáratánál" },
    { src: "img/referencia/ref-09-kandallo-z-ajto.webp", alt: "Z-merevítéses fa tolóajtó kandalló mellett" },
    { src: "img/referencia/ref-10-feher-x-ajto.webp", alt: "Fehér, X-merevítéses tolóajtó fekete sínen" },
    { src: "img/referencia/ref-11-mentazold-furdo.webp", alt: "Mentazöld tolóajtó egy fürdőszobában" },
    { src: "img/referencia/ref-12-turkiz-biciklis-lampa.webp", alt: "Türkizkék, deszkázott tolóajtó biciklis függőlámpa alatt" },
    { src: "img/referencia/ref-13-kek-gardrob.webp", alt: "Élénkkék, Z-merevítéses tolóajtó egy gardróbszobában" },
    { src: "img/referencia/ref-14-szurke-x-ketszarnyu.webp", alt: "Szürke, X-mintás kétszárnyú tolóajtó" },
    { src: "img/referencia/ref-15-feher-x-ketszarnyu.webp", alt: "Fehér, X-merevítéses kétszárnyú tolóajtó fa burkolatú falon" },
    { src: "img/referencia/ref-16-uveges-nappali.webp", alt: "Üveges, fa keretes kétszárnyú tolóajtó egy nappaliban, kandalló mellett" },
    { src: "img/referencia/ref-17-fekete-osztasu-uveg.webp", alt: "Fa keretes, fekete osztású üveges tolóajtópár" },
    { src: "img/referencia/ref-18-rombuszos-uveges.webp", alt: "Régi ajtólapokból készült, rombusz díszes, üveges tolóajtópár" },
    { src: "img/referencia/ref-19-mertani-uveges.webp", alt: "Fehér keretes, mértani mintás üveges tolóajtópár" },
    { src: "img/referencia/ref-20-fekete-uveges-furdo.webp", alt: "Fekete osztású üveges tolóajtó, mögötte fürdőszoba" },
    { src: "img/referencia/ref-21-fekete-negyosztasu.webp", alt: "Fekete keretes, négyosztású üveges tolóajtó" },
    { src: "img/referencia/ref-22-fenykepes-nappali.webp", alt: "Fényképes mintával nyomtatott tolóajtó egy nappaliban" },
    { src: "img/referencia/ref-23-templomos-minta.webp", alt: "Templomot ábrázoló mintás fekete tolóajtó" },
    { src: "img/referencia/ref-24-elfas-halo.webp", alt: "Élfás, természetes szélű fa tolóajtó egy hálószobában, lámpák alatt" },
    { src: "img/referencia/ref-25-elfas-furdo.webp", alt: "Természetes erezetű, élfás fa ajtólap egy fürdőszoba bejáratánál" },
    { src: "img/referencia/ref-26-antik-diszes.webp", alt: "Régi, díszes, kopott ajtólap tolóajtóként felszerelve" },
    { src: "img/referencia/ref-27-kazettas-felujitott.webp", alt: "Felújított, kazettás fa ajtólap tolóajtóként" },
    { src: "img/referencia/ref-28-zold-uveges.webp", alt: "Zöldre festett, üveges tolóajtó" },
    { src: "img/referencia/ref-29-femburkolatu.webp", alt: "Fém burkolatú, szegecselt tolóajtó" },
    { src: "img/referencia/ref-30-etterem-kek.webp", alt: "Kék tolóajtó egy étterem belső terében" },
    { src: "img/referencia/ref-31-leces-zold-fal.webp", alt: "Léces, fa borítású tolóajtó zöld fal mellett" },
    { src: "img/referencia/ref-32-sotetbarna-ketszarnyu.webp", alt: "Sötétbarna, deszkázott kétszárnyú tolóajtó" },
    { src: "img/referencia/ref-33-sarga-uveges-ketszarnyu.webp", alt: "Sárgára pácolt, üveges kétszárnyú tolóajtó kék falon, díszes pántokkal" },
    { src: "img/referencia/ref-34-sarga-folyoso.webp", alt: "Sárga tolóajtók egy hosszú folyosón" },
    { src: "img/referencia/ref-35-lezervagott-feher.webp", alt: "Lézerrel vágott mintás fehér tolóajtó" },
    { src: "img/referencia/ref-36-kulteri-fa.webp", alt: "Kültéri, Z-merevítéses fa tolóajtó téglafal mellett, fedett teraszon" },
    { src: "img/referencia/ref-37-konyha-z-ajto.webp", alt: "Z-merevítéses fa tolóajtó egy konyhában" },
    { src: "img/referencia/ref-38-logos-sinveg-gorgo.webp", alt: "Roll’n’Door logós sínvég és görgő közelről" },
    { src: "img/referencia/ref-39-sinrendszer-reszlet.webp", alt: "Sínrendszer és görgő közelről, fedett teraszon" },
    { src: "img/referencia/ref-40-kreta-szerelem.webp", alt: "Fekete tolóajtó, rajta krétával: I ♥ Roll’n’Door" }
];

// Galéria-sáv: nyilak (érintőképernyőn az ujjmozdulat elég), a szélén a nyíl eltűnik.
(function () {
    const strip = document.getElementById('gallery-strip');
    if (!strip) return;
    const prev = document.querySelector('.gallery-prev');
    const next = document.querySelector('.gallery-next');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const go = (dir) => strip.scrollBy({ left: dir * strip.clientWidth * 0.8, behavior: calm ? 'auto' : 'smooth' });
    const sync = () => {
        prev.disabled = strip.scrollLeft < 8;
        next.disabled = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 8;
    };
    prev.addEventListener('click', () => go(-1));
    next.addEventListener('click', () => go(1));
    strip.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
})();

let currentImageIndex = 0;
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const captionText = document.getElementById('lightbox-caption');

function openLightbox(index) {
    currentImageIndex = index;
    lightbox.style.display = 'block';
    updateLightboxImage();
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function changeImage(step) {
    currentImageIndex += step;
    if (currentImageIndex >= galleryImages.length) {
        currentImageIndex = 0;
    } else if (currentImageIndex < 0) {
        currentImageIndex = galleryImages.length - 1;
    }
    updateLightboxImage();
}

function updateLightboxImage() {
    lightboxImg.src = galleryImages[currentImageIndex].src;
    captionText.textContent = galleryImages[currentImageIndex].alt;
}

document.addEventListener('keydown', function(event) {
    if (lightbox && lightbox.style.display === 'block') {
        if (event.key === "Escape") closeLightbox();
        if (event.key === "ArrowRight") changeImage(1);
        if (event.key === "ArrowLeft") changeImage(-1);
    }
});
