// Az adatkezelési és az impresszum oldal közös szkriptje: a menüsáv görgetésre és a telefonos menü.
// (A régi landing ajánlatkérő űrlapja és galériája innen 2026-11-25-én kikerült: a főoldal a landing.js-t,
// a tervező a tervezo.js-t használja.)

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
