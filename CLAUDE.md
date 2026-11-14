# Roll’n’Door

Először olvasd el a `docs/TERV.md` fájlt: az a döntések és az aktuális állapot forrása (alapelvek, architektúra, a 7 állomás, éles próba állapota, nyitott lépések). A `worker/README.md` a telepítési lépéseket tartalmazza.

## Mindig érvényes

- Magyarul válaszolj, hétköznapi nyelven. A felhasználó (Zoli) fejleszt, Ricsi a tulajdonos és nem technikai ember.
- Egyszemélyes vállalkozás, 1–2 felhasználó. Nincs regisztráció, jelszó, fizetés, kosár, árkalkulátor, keretrendszer vagy build lépés a felületen.
- Üzleti tényt (ár, határidő, anyag, garancia) ne találj ki. Ami nincs megerősítve, jelöld `TODO`-val.
- A szlogen „ajtó másképp", a név Roll’n’Door. A landing a mintaoldal (`forras-kepek/mintaoldal`) szövegét és kinézetét követi, a kiegészítések listája a `docs/TERV.md` 6. pontjában van.
- Titkot (API-kulcs, `.dev.vars`) ne írj ki és ne commitolj. Commitolni és pusholni csak kérésre.

## Windows

A mappa nevében `&` van, ezért az `npm run` és az `npx` nem működik. Közvetlenül hívd:

- Típusellenőrzés: `node node_modules/typescript/bin/tsc --noEmit -p .`
- Wrangler: `node node_modules/wrangler/bin/wrangler.js <parancs>`
- Helyi szerver: a `.claude/launch.json` `rollndoor-dev` bejegyzése (port 8787).
