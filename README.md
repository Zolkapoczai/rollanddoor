# Roll’n’Door – ajtó másképp

Egyedi tolóajtók (ajtólap + dupla sínes vasalat + beszerelés) weboldala és megrendelés-követője. Egyszemélyes vállalkozásnak készült, 1–2 felhasználóra: nincs regisztráció, jelszó, fizetés vagy árkalkulátor.

Egy Cloudflare Worker szolgálja ki a statikus oldalt (`public/`) és az API-t (`worker/`). Egy repó, egy deploy.

## Hol mit találsz

| Mi | Hol |
|---|---|
| **Átadás: aktuális állapot, nyitott teendők, buktatók** | [`docs/ATADAS.md`](docs/ATADAS.md) |
| Döntések, alapelvek, a 7 állomás, részletes előzmények | [`docs/TERV.md`](docs/TERV.md) |
| Backend telepítése, Resend, Turnstile, D1/R2 | [`worker/README.md`](worker/README.md) |
| Főoldal (landing) | `public/index.html`, `landing.css`, `landing.js` |
| Ajtótervező (irányított igényfelvétel) | `public/tervezo.*`, fotóillesztés: `public/fotoillesztes.js`, 3D előnézet: `public/elonezet3d.js` + `public/vendor/three/` (three.js, MIT) és `public/vendor/model-viewer/` (AR, Apache-2.0) |
| Technológia (dupla sín animáció, videó): a főoldalon nem szerepel, tartalékban | `public/technologia.*`, videó: `public/video/` |
| Ügyfél / Ricsi megrendelés-oldala, leiratkozás | `public/r.*`, `public/m.*`, `public/le.*` |
| Ricsi dashboardja | `public/dashboard.*`, `worker/src/dashboard.ts` |
| API, levelek, cron | `worker/src/` |
| Adatbázis-séma és migrációk | `worker/schema.sql`, `worker/migrations/` |
| Képgeneráló és videófelvevő szkriptek | `tools/` |

## Helyi futtatás

Kell hozzá Node.js 22 és `npm install`.

```bash
cp .dev.vars.example .dev.vars    # teszt Turnstile-kulcs; Resend-kulcs nélkül a levelek csak logolódnak
npm run db:local                  # séma a helyi D1-be
npm run dev                       # http://localhost:8787
npm run typecheck
```

**Windows, ha az útvonalban `&` van** (pl. `R&D`): az `npm run` és az `npx` elhasal. Ilyenkor közvetlenül hívd:

```powershell
node node_modules/wrangler/bin/wrangler.js dev --port 8787
node node_modules/typescript/bin/tsc --noEmit -p .
```

## Telepítés

- **Automatikusan:** minden push a `main` ágra típusellenőrzés után élesbe megy (`.github/workflows/deploy.yml`). Ehhez két repó-secret kell: `CLOUDFLARE_API_TOKEN` és `CLOUDFLARE_ACCOUNT_ID` (lásd `worker/README.md` 10. pont).
- **Kézzel**, bejelentkezett wranglerrel: `node node_modules/wrangler/bin/wrangler.js deploy`.

Az éles próba jelenleg a workers.dev címen fut. A `rollndoor.hu` névszerver-váltása még hátravan (feltételei: `docs/TERV.md`, 6. pont).

## Szabályok a fejlesztéshez

- Sima HTML/CSS/JS, nincs keretrendszer és build lépés a felületen.
- Üzleti tényt (ár, határidő, anyag, garancia) nem találunk ki: ami nincs megerősítve, `TODO` jelölést kap.
- Titok (`.dev.vars`, API-kulcs) nem kerülhet a repóba.
- **Minden változtatással együtt frissül a `docs/ATADAS.md`** (és ha döntés született, a `docs/TERV.md`), ugyanabban a commitban.
