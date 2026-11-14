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
    { src: "img/minta/gallery1.webp", alt: "Modern fehér kétszárnyú tolóajtó" },
    { src: "img/minta/gallery2.webp", alt: "Rusztikus fa pajtaajtó sötét vasalattal" },
    { src: "img/minta/hero.webp", alt: "Masszív fahatású tolóajtó kilátással" },
    { src: "img/minta/sajat-vasalat.webp", alt: "Prémium matt fekete sínrendszer és görgő részlet" },
    { src: "img/minta/gallery1.webp", alt: "Modern fehér ajtó minimalista enteriőrben" },
    { src: "img/minta/gallery2.webp", alt: "Klasszikus fa tolóajtó meleg fényekkel" }
];

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
