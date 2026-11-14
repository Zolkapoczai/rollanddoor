// A Turnstile sitekey, a fotó-limitek és a shrinkPhoto a kozos.js-ben van (előbb töltődik be).
const PHONE_DISPLAY = '06 20 565 0661';
const PHONE_HREF = 'tel:+36205650661';

// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (!navbar) return;
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile menu
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

function setMenu(open) {
    if (!navToggle || !navLinks) return;
    navLinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Menü bezárása' : 'Menü megnyitása');
}

if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
    });
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') setMenu(false);
    });
}

// Turnstile: set the site key before api.js renders the widget (script order matters, see index.html)
document.querySelectorAll('.cf-turnstile').forEach(el => {
    el.setAttribute('data-sitekey', TURNSTILE_SITEKEY);
});

// Quote form
const quoteForm = document.getElementById('quoteForm');

if (quoteForm) {
    const errorBox = document.getElementById('formError');
    const submitBtn = quoteForm.querySelector('button[type="submit"]');
    const photoInput = document.getElementById('fotok');

    function showError(html) {
        errorBox.innerHTML = html;
        errorBox.classList.add('show');
        errorBox.focus();
    }

    function clearError() {
        errorBox.textContent = '';
        errorBox.classList.remove('show');
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function phoneHint() {
        return ' Hívj minket: <a href="' + PHONE_HREF + '">' + PHONE_DISPLAY + '</a>.';
    }

    function checkPhotos() {
        const files = Array.from(photoInput.files);
        if (files.length > MAX_PHOTOS) {
            return 'Legfeljebb 2 fotót tudsz csatolni. Válassz ki kettőt.';
        }
        const tooBig = files.find(f => f.size > MAX_PHOTO_BYTES);
        if (tooBig) {
            return 'A(z) „' + escapeHtml(tooBig.name) + '” túl nagy. Egy kép legfeljebb 25 MB lehet.';
        }
        return '';
    }

    photoInput.addEventListener('change', () => {
        const msg = checkPhotos();
        if (msg) {
            showError(msg);
            photoInput.value = '';
        } else {
            clearError();
        }
    });

    quoteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();

        if (!quoteForm.checkValidity()) {
            quoteForm.reportValidity();
            return;
        }

        const photoMsg = checkPhotos();
        if (photoMsg) {
            showError(photoMsg);
            return;
        }

        const originalLabel = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Küldés folyamatban…';

        const data = new FormData();
        data.append('forras', 'urlap');
        ['nev', 'email', 'telefon', 'uzenet'].forEach(name => {
            data.append(name, quoteForm.elements[name].value.trim());
        });
        // A telefonos fotókat küldés előtt lekicsinyítjük (max. 1600 px), hogy gyors legyen a feltöltés.
        const photos = await Promise.all(Array.from(photoInput.files).map(shrinkPhoto));
        photos.forEach(f => data.append('fotok', f));
        const tokenField = quoteForm.querySelector('[name="cf-turnstile-response"]');
        data.append('cf-turnstile-response', tokenField ? tokenField.value : '');

        try {
            const res = await fetch('/api/igeny', { method: 'POST', body: data });
            let json = null;
            try { json = await res.json(); } catch (_) { /* not JSON */ }

            if (res.ok && json && json.ok === true) {
                quoteForm.outerHTML =
                    '<div class="thanks" role="status" tabindex="-1" id="thanks">' +
                    '<h3>Megkaptuk!</h3>' +
                    '<p>1 munkanapon belül keresünk. Küldtünk egy visszaigazoló e-mailt is.</p>' +
                    '</div>';
                const thanks = document.getElementById('thanks');
                if (thanks) thanks.focus();
                return;
            }

            const msg = (json && json.hiba) ? escapeHtml(json.hiba) : 'Valami elromlott, nem sikerült elküldeni.';
            showError('<strong>Nem sikerült elküldeni.</strong> ' + msg + phoneHint());
        } catch (_) {
            showError('<strong>Nem sikerült elküldeni.</strong> Nincs kapcsolat a szerverrel.' + phoneHint());
        }

        // Failure: keep the entered data, re-enable, get a fresh Turnstile token
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
        if (window.turnstile) {
            try { window.turnstile.reset(); } catch (_) { /* ignore */ }
        }
    });
}

// Lightbox Gallery Logic
const galleryImages = [
    { src: 'img/gallery1.webp', alt: 'Modern fehér kétszárnyú tolóajtó' },
    { src: 'img/gallery2.webp', alt: 'Rusztikus fa pajtaajtó sötét vasalattal' },
    { src: 'img/hero.webp', alt: 'Masszív fahatású tolóajtó kilátással' },
    { src: 'img/sajat-vasalat.webp', alt: 'Matt fekete sínrendszer és görgő részlet' }
];

const lightbox = document.getElementById('lightbox');

if (lightbox) {
    const lightboxImg = document.getElementById('lightbox-img');
    const captionText = document.getElementById('lightbox-caption');
    let currentImageIndex = 0;
    let lastFocus = null;

    function updateLightboxImage() {
        const item = galleryImages[currentImageIndex];
        lightboxImg.src = item.src;
        lightboxImg.alt = item.alt;
        captionText.textContent = item.alt;
    }

    function openLightbox(index) {
        lastFocus = document.activeElement;
        currentImageIndex = index;
        lightbox.style.display = 'block';
        updateLightboxImage();
        document.body.style.overflow = 'hidden';
        document.getElementById('lightboxClose').focus();
    }

    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = 'auto';
        if (lastFocus) lastFocus.focus();
    }

    function changeImage(step) {
        currentImageIndex = (currentImageIndex + step + galleryImages.length) % galleryImages.length;
        updateLightboxImage();
    }

    document.querySelectorAll('.gallery-item').forEach(btn => {
        btn.addEventListener('click', () => openLightbox(Number(btn.dataset.index)));
    });
    document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
    document.getElementById('lightboxPrev').addEventListener('click', () => changeImage(-1));
    document.getElementById('lightboxNext').addEventListener('click', () => changeImage(1));
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (event) => {
        if (lightbox.style.display === 'block') {
            if (event.key === 'Escape') closeLightbox();
            if (event.key === 'ArrowRight') changeImage(1);
            if (event.key === 'ArrowLeft') changeImage(-1);
        }
    });
}
