# Roll’n’Door – ajánlatkérő backend (Cloudflare Worker)

Egy Worker szolgálja ki a statikus oldalt (`public/`) és az API-t. A Worker csak a `/api/*`, `/r/*`, `/m/*`, `/le/*` útvonalakra fut elsőként, minden mást közvetlenül a statikus assets szolgál ki. Az átirányítások a `public/_redirects`-ben vannak.

## Ellenőrzött dokumentáció

- Assets + `run_worker_first` tömb: https://developers.cloudflare.com/workers/static-assets/binding/
- `_redirects` Workers assetsnél: https://developers.cloudflare.com/workers/static-assets/redirects/
- Wrangler konfig (D1, R2, vars): https://developers.cloudflare.com/workers/wrangler/configuration/
- Turnstile siteverify: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ , teszt kulcsok: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
- Resend küldés: https://resend.com/docs/api-reference/emails/send-email
- Resend fogadás: https://resend.com/docs/dashboard/receiving/introduction , webhook: https://resend.com/docs/dashboard/receiving/create-receiving-webhook , levél lekérés: https://resend.com/docs/api-reference/emails/retrieve-received-email , csatolmányok: https://resend.com/docs/api-reference/emails/list-received-email-attachments , egyéni domain/MX: https://resend.com/docs/dashboard/receiving/custom-domains
- Webhook aláírás (Svix): https://resend.com/docs/webhooks/verify-webhooks-requests , https://docs.svix.com/receiving/verifying-payloads/how-manual

Eltérések a briefhez képest: (1) a `_redirects` támogatott, ezért nincs redirect-kód a Workerben; (2) az `uzenet` táblában van egy extra `kulso_id` oszlop (a webhook idempotenciájához); (3) a Resend inbound webhook csak metaadatot hoz, a szöveget/csatolmányokat külön API-hívással kell lekérni (`RESEND_API_KEY` kell hozzá).

## Egyszeri beállítás (sorrendben)

> Windowson, ha a projekt útvonala `&`-t tartalmaz (`R&D`), az `npm run` / `npx` elhasal (cmd.exe). Használd: `node node_modules/wrangler/bin/wrangler.js ...` vagy költöztesd a projektet `&`-mentes mappába.

1. `npm install`
2. `npx wrangler login` (te teszed meg, egyszer)
3. D1: `npx wrangler d1 create rollndoor` → a kapott `database_id`-t írd a `wrangler.jsonc`-ba, majd `npm run db:remote`
4. R2: `npx wrangler r2 bucket create rollndoor-files`
5. Titkok: `npx wrangler secret put RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `TURNSTILE_SECRET`
6. Resend: add hozzá a `rollndoor.hu` domaint (küldés: a Resend által megadott SPF/DKIM rekordok). Fogadás: a `valasz.rollndoor.hu` aldomainen add hozzá az MX rekordot – a pontos értéket és prioritást a Resend dashboard mutatja, onnan másold. Aldomain kell, hogy a fő domain levelezése ne sérüljön.
7. Resend webhook: esemény `email.received`, URL `https://rollndoor.hu/api/bejovo-level`; a kapott `whsec_...` titok megy a `RESEND_WEBHOOK_SECRET`-be.
8. Turnstile: widget létrehozása a dashboardon; a site key a form HTML-be, a secret az 5. lépésbe.
9. `wrangler.jsonc` `vars`: ellenőrizd `SITE_URL`, `RICSI_EMAIL`, `REPLY_DOMAIN`. Deploy: `npx wrangler deploy`.

## Helyi fejlesztés

```
cp .dev.vars.example .dev.vars        # teszt Turnstile secret, nincs RESEND_API_KEY -> levelek dry-run
npm run db:local                      # séma a helyi D1-be (friss telepítés)
npm run db:migrate:local              # MEGLÉVŐ (1. kori) helyi DB-hez: worker/migrations/0002_kor2.sql (egyszer futtatható)
npm run test:cron                     # a cron-logika tesztje kamu `now`-val a helyi D1 ellen
npm run dev                           # http://localhost:8787
npm run typecheck
```

Helyi Turnstile: a `cf-turnstile-response` értéke legyen `XXXX.DUMMY.TOKEN.XXXX`. A helyi D1/R2 a `.wrangler/` mappában él.

## Ismert korlátok

- **Feladó-hamisítás (fontos):** a `From` cím hamisítható. Ricsi leveleként csak akkor kezeljük a bejövő levelet, ha a Resend lekért levelében az `authentication.dmarc` értéke `pass`. Ha ez hiányzik vagy nem pass, a levelet eldobjuk (rendszer-megjegyzés az `uzenet`-ben). Ricsi domainjén legyen DMARC-rekord, különben a válaszai `gray` eredményt kapnak és el lesznek dobva. A webhook payload maga nem tartalmaz auth-eredményt. Nem tesztelt éles Resend-adattal.
- A bejövő payload/API-mezők (`email.received`, `authentication`, `headers` formátuma) dokumentáció alapján íródtak, helyben nem tesztelhetők. A `headers` alakját (objektum vagy name/value lista) mindkét módon kezeljük.
- Feltöltés: a törzs max ~20 MB és `Content-Length` kötelező. A multipart feldolgozás és a base64-kódolás (levélcsatolmány) memóriában történik; a free terv 10 ms CPU-limitje 2×8 MB fotónál túlléphető. Ha ez gond, Workers Paid (alap 30 s CPU) vagy kisebb fotólimit.
- Nincs rate limit a `/api/igeny`-n, csak Turnstile. Kell-e Cloudflare WAF rate limiting rule, azt élesítés előtt döntsd el.
- A levélküldés a válasz után fut (`waitUntil`); hiba esetén `rendszer` sor kerül az `uzenet`-be, nincs automatikus újrapróbálás.
- Bejövő levél: csak a szöveges rész továbbítódik (HTML-ből tagek nélküli szöveg, ha nincs text), max 20 csatolmány, a Resend letöltési URL-je 1 óráig él. Ugyanaz az `email_id` nem dolgozódik fel kétszer; ha a továbbítás elbukik, nem jön újrapróbálás.
- Az R2 bucket privát; a fájlokat csak az alábbi tokenes végpontok szolgálják ki.
- A `/api/*` többi útvonala 404 JSON.

## 2. kör (követőoldal, Ricsi-oldal, automatikus levelek)

Meglévő éles DB-hez egyszer: `npm run db:migrate:remote` (az `ALTER TABLE` nem ismételhető). Friss telepítésnél a `schema.sql` már tartalmazza (`megrendeles.statusz`, `levelnaplo`). Cron: a `wrangler.jsonc` `triggers.crons` (`0 7 * * *`, UTC) a deployjal él.

Fájlok: `allomasok.ts` (a 7 állomás, egyetlen forrás), `levelek.ts` (automatikus levelek + minden ügyfél-levél védőhálója), `vevo.ts` (`/api/r/*`, `/api/le/*`), `ricsi.ts` (`/api/m/*`), `cron.ts`, `megrendeles.ts`, `fajlok.ts`. A `/r/{token}`, `/m/{token}`, `/le/{token}` az `r.html`/`m.html`/`le.html` statikus fájlt adja (`Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, mindig 200, hiányzó fájlnál 503).

Szabályok, amik a kódban vannak:
- Ismeretlen / hibás / idegen token: mindig ugyanaz a 404 (`A link nem érvényes.`). Az ügyfél-token csak `/api/r`, `/api/le` alatt, a Ricsi-token csak `/api/m` alatt él.
- A `ricsi_token` csak Ricsinek menő levélben szerepel. Az ügyfélnek menő minden levél a `kuldUgyfelnek()`-en megy át, ami eldobja a levelet, ha a tokent tartalmazza.
- Automatikus levél nem megy ki, ha `leiratkozott=1` vagy `statusz!='aktiv'`. Ricsi kézi válasza (`/valasz`) mindig kimegy.
- 6. állomás: a továbblépő gomb a „Beszerelve”. Az időpont-megadás (`POST /api/m/{token}/idopont`) külön, nem lépteti az állomást; minden dátumváltáskor új levél megy, a cron a dátum előtti napon még egyet küld (`levelnaplo`: `szerelesi_emlekezo:<datum>`).
- Emlékeztetők: 3. állomáson, ha az érkezés óta nincs ügyfél-üzenet: a 3. naptól `emlekezo3`, a 7. naptól `emlekezo7` (legfeljebb a 14. napig; utána semmi). A 3. állomásra visszalépés újraindítja őket.
- Fájlok kiszolgálása: csak JPG/PNG/WebP/GIF/PDF megy `inline`, minden más (pl. bejövő levél csatolmánya) `attachment` + `application/octet-stream`. Az ügyfél csak `latvanyterv` (az 5. állomástól) és `kesz` fájlt kap.
- Dry-run módban (nincs `RESEND_API_KEY`) a log a levél tárgyát és a címzett szerepét (`ricsi`/`ugyfel`) írja ki, a valódi küldési úton nem logolunk tárgyat.
