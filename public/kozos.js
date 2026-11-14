// Közös kód a főoldalhoz (script.js) és az ajtótervezőhöz (tervezo.js). Klasszikus script: a const-ok globálisak.
// Cloudflare Turnstile site key. Public value, safe in the browser.
// This is the official always-pass TEST key: REPLACE with the real site key before launch.
const TURNSTILE_SITEKEY = '1x00000000000000000000AA';

const MAX_PHOTOS = 2;
// A kliens 25 MB-ig enged: küldés előtt úgyis lekicsinyítjük. A szerver határa 8 MB / kép.
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;
const PHOTO_MAX_SIDE = 1600;

// Kép lekicsinyítése a böngészőben. Ha bármi nem sikerül (pl. nem támogatott formátum), az eredeti fájl megy.
async function shrinkPhoto(file) {
    try {
        if (!file.type.startsWith('image/') || file.size < 400 * 1024) return file;
        const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (_) {
        return file;
    }
}
