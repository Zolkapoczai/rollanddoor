# Roll’n’Door – terv és állapot

Ez a fájl a tervezési beszélgetés döntéseit rögzíti. Ha a kód és ez a fájl ellentmond, a tulajdonossal (Ricsi) és a fejlesztővel (Zoli) kell egyeztetni, nem találgatni.

## 1. Kinek és mire

- **Roll’n’Door** (így írjuk, tipográfiai aposztróffal): egyszemélyes vállalkozás, egyedi tolóajtók. Ricsi viszi egyedül, nem technikai ember.
- **Fő termék:** ajtólap + vasalat + beszerelés egyben. Minden egyedi, nincs szabvány méret. Ricsi szerel, országosan. Bemutatóterem nincs.
- **USP:** dupla sínes vasalat minden szetthez (stabil, nem leng ki). A versenytársak szimpla sínt használnak. Ezt mindenhol elöl kell tartani, versenytárs megnevezése nélkül.
- **Vevők:** főleg magánemberek, sokan nem gyakorlottak, telefonról jönnek.
- **Mennyiség:** egyszerre 1–5 megrendelés, havi kb. 7–8 érdeklődő, 40% rendel. A cél **több érdeklődő**, nem több adminisztráció.
- **Honnan jönnek:** Facebook, Google, ChatGPT, ajánlás. Ezért a keresőknek és az LLM-eknek szóló tartalom (strukturált adat, GYIK, llms.txt) az alap része.

## 2. Alapelvek – minden javaslatnál kötelezőek

1. 1–2 fő használja. Semmi, ami ennél nagyobb cégre való.
2. **Nincs:** regisztráció, jelszó, jogosultsági szintek, fizetés, számlázás, készlet, kosár, árkalkulátor.
3. Az ügyfél e-mailben kap linket, azon látja, hol tart az ajtaja. Aki nem akar felületet, annak az e-mail ugyanazt adja.
4. A legkevésbé gyakorlott ügyfélnek is elsőre érthető: kevés lépés, nagy betű (≥17 px), egyszerű szavak, tegezés, telefonon is. Gombok ≥48 px.
5. Minden menjen hagyományosan is (e-mail, telefon). Ricsi felülete csak lehetőség.
6. Kész eszköz egyedi fejlesztés helyett.
7. Minden új funkciónál: kell ez most? Ha kétséges, nem kell.
8. Üzleti tényt (ár, határidő, anyag, garancia) nem találunk ki. Ami nincs megerősítve, az `data-todo` jelölést vagy `TODO` megjegyzést kap.
9. Nincs keretrendszer és build lépés a felületen: sima HTML/CSS/JS, a `public/style.css` arculatával.

## 3. Architektúra

Egy Cloudflare Worker szolgálja ki a statikus oldalt (`public/`) és az API-t (`worker/`). Egy repo, egy deploy.

| Rész | Technológia | Megjegyzés |
|---|---|---|
| Felület | HTML/CSS/JS a `public/` alatt | Sötét arculat, kiemelő szín `#d4a373`, Inter + Outfit |
| API | Worker, TypeScript (`worker/src/`) | Csak `/api/*`, `/r/*`, `/m/*`, `/le/*`, `/pult` útvonalakon fut elsőként |
| Adat | Cloudflare D1 (`worker/schema.sql`) | `megrendeles`, `uzenet`, `fajl`, `allomas_naplo` |
| Fájlok | Cloudflare R2, privát | Ügyfélfotók, látványtervek, csatolmányok |
| Robotszűrő | Cloudflare Turnstile | Helyben a mindig-átmegy tesztkulcsok |
| Levél | Resend, kizárólag a `worker/src/mail.ts` `sendMail()` függvényén át | Szolgáltatócsere egy helyen történjen |
| Átirányítások | `public/_redirects` | A régi WordPress-címek 301-gyel az új helyükre |

Hozzáférés: megrendelésenként két hosszú véletlen token (`ugyfel_token`, `ricsi_token`), nincs bejelentkezés. A megrendelés saját válaszcíme: `rendeles-{id}-{valasz_kulcs}@valasz.rollndoor.hu`.

Elvetve, ne kerüljön vissza kérés nélkül: Google Cloud/Workspace átállás, Cloudflare saját levélküldője (béta), ingyenes Gemini (EU-ban nem használható így, ügyféladat menne tanításra), SketchUp-összekötés (nincs hozzá hivatalos API; Ricsi képként tölti fel a látványtervet), saját diktáló gomb (a telefon billentyűzete tudja).

## 4. A megrendelés 7 állomása – ez a szerződés

Az adatbázis, a levelek és mindkét felület erre épül. Módosítani csak Ricsivel egyeztetve.

| # | Állomás | Ügyfél ezt látja | Ügyfél gombja | Ricsi gombja | Automatikus levél az állomásra érkezéskor |
|---|---|---|---|---|---|
| 1 | Igény beérkezett | „Megkaptuk, 1 munkanapon belül keresünk” | Üzenet | Egyeztetés kész | Megkaptuk az igényed |
| 2 | Egyeztetés | „Egyeztetünk a részletekről” | Üzenet; Méretek megadása (tervező) | Ajánlat elküldve (+ összeg) | – |
| 3 | Ajánlat elküldve | Az ajánlat összege és tartalma | Elfogadom / Kérdésem van | Előleg megérkezett | Ajánlat; emlékeztető a 3. és 7. napon, utána csend |
| 4 | Előleg megérkezett | „Köszönjük, készül a látványterv” | Üzenet | Látványterv feltöltése | Megérkezett az előleg |
| 5 | Látványterv | A kép nagyban | Jóváhagyom / Módosítást kérek | Gyártás indul (csak jóváhagyás után) | Kész a látványterv |
| 6 | Gyártás (kb. 4 hét) | Várható beszerelési dátum | Üzenet | Elkészült, időpont (+ dátum) | Elkészült, egyeztessünk; előző napi emlékeztető |
| 7 | Beszerelve | „Köszönjük!” | Vélemény és fotó küldése | Lezárás | Vélemény- és fotókérés |

- Minden levél alján „Nem kérek több levelet” link; aki megnyomja, Ricsinél „nem érdeklődik” jelzést kap.
- Ricsi oldalán mindig van „Visszalépés” és „Nem érdeklődik”.
- A kattintható minta: `public/minta/ugyfel.html` és `public/minta/ricsi.html` (kitalált adatok, `localStorage`). A 2. kör valódi oldalai ezt kövessék.

## 5. Ajtótervező (`public/tervezo.html`)

Irányított igényfelvétel, **nem** árkalkulátor. Hat lépés: elrendezés → nyílás és fal (méret, falanyag, 1–2 fotó, mérési segédlet) → ajtólap → szín → vasalat és kiegészítők → elérhetőség + „a méretekért én felelek” pipa.

- Semmit nem tilt le, árat nem mutat. Összeférhetetlenségi szabályok később, Ricsivel.
- Súlyhatár: az ajtólap legfeljebb 80 kg. A tervező nem számol súlyt, Ricsi dönt.
- A tervező célja a helyszíni felmérés kiváltása; a méretért az ügyfél felel.
- Képek alatt: „Szemléltető kép. A pontos látványtervet megrendelés után kapod.”
- API: `POST /api/igeny`, `multipart/form-data`; mezők és az `igeny_json` formátuma a `worker/src/igeny.ts`-ben.

## 6. Állapot

### Kész (1. kör kódja, helyben kipróbálva)

- Landing: tömörített képek, régi logó, rövid űrlap, „Így készül az ajtód”, GYIK, strukturált adat, sitemap, robots.txt, llms.txt, jogi oldalak vázlata.
- 6 lépéses tervező fotófeltöltéssel (a böngésző 1600 px-re kicsinyít küldés előtt).
- Worker: igény mentése, levél Ricsinek és visszaigazolás az ügyfélnek, levéltovábbító (bejövő Resend webhook), átirányítások.
- Kattintható minta a két megrendelés-oldalról.

### Kész (2. kör backend, helyben kipróbálva)

- API: ügyfél (`/api/r/*`, `/api/le/*`) és Ricsi (`/api/m/*`), tokenes HTML-vázak, 7 állomás léptetése ellenőrzésekkel, fájlfeltöltés/-kiszolgálás, válasz írása, vélemény- és fotókérés.
- 8 automatikus levél + leiratkozás + napi cron (emlékeztetők, szerelés előtti nap), `statusz` és `levelnaplo` a DB-ben. Részletek: `worker/README.md`.
- Még nincs kész: a böngészős oldalak bekötése (`public/r.html`, `m.html`, `le.html`) és a valódi levélküldés próbája.

### Éles próba (workers.dev): állapot, 2026-11-14

- **Kész a Cloudflare-en:** D1 `rollndoor` (az azonosító a `wrangler.jsonc`-ban), R2 `rollndoor-files`, a séma betöltve az éles D1-be, titkok beállítva (`RESEND_API_KEY`, `TURNSTILE_SECRET`; a `RESEND_WEBHOOK_SECRET` még nincs, az a Resend-domain után jön), Turnstile site key a `public/kozos.js`-ben (localhoston automatikusan a teszt-kulcs), feltöltve: https://rollndoor.poczaizoltan30.workers.dev (a Turnstile-widget hosztnevei között szerepel). A robotszűrő élesben ellenőrizve (érvénytelen token 403).
- **A `rollndoor.hu` hozzáadva a Cloudflare-fiókhoz, de a névszerverek NINCSENEK átállítva**: a domain az Integrityn marad, a régi WordPress szolgálja ki, a levelezés (messanet) érintetlen. Az átállás előfeltétele, hogy **a domainen be van kapcsolva a DNSSEC** (DS rekord, keytag 8330): előbb ki kell kapcsolni az Integrityn (Ricsi fér hozzá), várni legalább 1 órát (a DS TTL-je 3600 mp), és csak utána cserélni a névszervereket `greg.ns.cloudflare.com` és `joselyn.ns.cloudflare.com` értékre. Különben a domain (oldal és levelezés is) elérhetetlen lehet. A Cloudflare DNS-ben a régi rekordok be vannak másolva (A, www A, MX `mx.messanet.hu` DNS only, SPF TXT); a `_dmarc` TXT (`v=DMARC1; p=none;`) felvétele ellenőrizendő.
- **Átmeneti beállítások, az átállításkor visszaállítandók:** `wrangler.jsonc` `SITE_URL` jelenleg a workers.dev cím (vissza: `https://rollndoor.hu`). A levélpróbához egyszeri deploy-kapcsolók valók, amik nem kerülnek a repóba, és a következő sima `deploy` törli őket: `--var MAIL_TEST_FROM:onboarding@resend.dev --var RICSI_EMAIL:<a Resend-fiók e-mail címe>` (a Resend megerősítetlen domainről nem küld; `MAIL_TEST_FROM` a `worker/src/mail.ts`-ben).
- **Elvégezve (2026-11-14):** (1) levélpróba a workers.dev címen: mindkét igény-levél megjött, a linkek jók (az első próbán a Resend-kulcs érvénytelen volt, újra beállítva); (2) az állomások végigjárása élesben, a 7 állomás és az automatikus levelek megjöttek. Nincs kipróbálva: leiratkozás-link, szerelés előtti napi emlékeztető (cron), a bejövő levelek útja. A próbamegrendelés az éles D1-ben van, élesítés előtt törlendő.
- **Következő lépések:** (3) Resend: `rollndoor.hu` domain megerősítése (a DNS-rekordok a Cloudflare-be vagy az Integrityhez kerülnek, attól függően, hol van akkor a DNS) és a `valasz` aldomain MX-e + webhook; (4) DNSSEC kikapcsolása → névszerver-váltás → `SITE_URL` vissza; (5) Ricsi tartalmi teendői (lásd lent).
- **Windowson** az `npm run` és az `npx` a mappanévben lévő `&` miatt nem működik: `node node_modules/wrangler/bin/wrangler.js <parancs>` formában kell hívni (a hivatkozott `npx wrangler` parancsokat is így).

### Nincs kipróbálva

- Valódi levélküldés (Resend-kulcs nélkül csak próbaüzem fut, a levelek kinézetét senki nem látta).
- A bejövő levelek útja: lekérés, csatolmányok, továbbítás, irányfelismerés. Csak élő Resend-fiókkal tesztelhető; a webhook `headers` mezőjének alakja nincs dokumentálva.
- Valódi telefon (csak böngészős telefonnézet), a tervező széles képernyőn.
- Az ingyenes Worker 10 ms CPU-kerete nagy csatolmányoknál.
- Az új oldal sebessége (Core Web Vitals): csak kitett oldalon mérhető. Kiinduló érték a régi oldalon: mobil LCP 6,3 mp.

### Élesítés előtt kötelező

1. **Landing = a mintaoldal pontos másolata** (Ricsi döntése, 2026-11-14): `forras-kepek/mintaoldal/` (az eredeti `rollndoor.zip` tartalma) szövege, szerkezete és CSS-e változatlan (`public/landing.css`, `public/index.html`, `public/blog.html`, `public/landing.js`). Eltérések: külső függőségek helyi másolatra cserélve (Unsplash-képek, Phosphor ikonok → inline SVG), a hamis ajánlatkérő űrlap valódi (`/api/igeny`, Turnstile), adatkezelési megjegyzés az űrlap alatt, jogi hivatkozások a láblécben, Instagram-ikon törölve (nincs fiók), Facebook valós címmel. A minta 3. kártyájának és a blog 3 képének Unsplash-forrása már nem elérhető (404): valódi fotó került a helyére. A minta telefonon elrejti a menüt (nincs hamburger), ezt változatlanul hagytuk. **A minta képei gépi generáltnak tűnnek, de „Referenciáink" felirat alatt szerepelnek** (a minta szövege), élesítés előtt ezt Ricsinek át kell gondolnia. A mintához Ricsi kérésére visszakerült: a dupla sín kiemelése (hero-sor, jelvényes első kártya a valódi dupla sínes fotóval), az „Így készül az ajtód" szakasz, a GYIK (3 megválaszolt kérdés; 2 vár Ricsi válaszára, HTML-megjegyzésben), valamint a link az ajtótervezőre (menü + az ajánlatkérő szakasz tetején). A korábbi, valódi fotós galériás landing a `7e954ce` commitban van, a feldolgozott valódi fotók a `public/img/` alatt (`galeria-*`, `hero-lakas-*`) használaton kívül állnak. Feldolgozási szabály a fotókra: EXIF-forgatás, minden metaadat (GPS!) törölve, WebP, ékezet- és névmentes fájlnevek (a forrásfájlnevekben ügyfélnevek vannak). A tervező 3. lépése még a valódi fotókat használja. A dupla sínt a régi oldalról átvett `dupla_sín.jpg` mutatja. Nem használjuk: a két felismerhető emberes kép, és a piros sapkás férfi képe, amíg nem tisztázott, hogy ki az. **Szlogen (végleges, Ricsi): „ajtó másképp"** mindenhol. A képes logó (`public/img/logo.webp`) szlogenje ennek megfelelően újra lett rajzolva (Century Gothic, az eredeti „másként" helyett); az eredeti logó a `forras-kepek/Rollndoor_ajto_maskent_logo.png` fájlban van.
2. **Ricsi tölti ki / hagyja jóvá:** 2 GYIK-válasz (`data-todo` az `index.html`-ben: görgők anyaga, látszik-e a furat), cégadatok (`[CÉGNÉV]`, `[SZÉKHELY]`, `[ADÓSZÁM]`), adatkezelési tájékoztató szövege, a tervező színlistája, a fogantyú és a zár egysoros magyarázata, visszakerüljön-e a „GLS-sel akár másnap” mondat.
3. **Cloudflare:** fiók, a `rollndoor.hu` hozzáadása. Hogy a `.hu` végződést befogadja-e, nincs megerősítve; ezt kell először kipróbálni. A domain az Integritynél marad, csak a névszerver változik.
4. **DNS átállításkor:** a levelezés bejegyzéseit pontosan át kell másolni (MX: `mx.messanet.hu`, SPF: `include:_spf.messanet.hu`), különben megáll az `info@rollndoor.hu`.
5. **DMARC:** a `rollndoor.hu`-n nincs `_dmarc` bejegyzés. A levéltovábbító Ricsi nevében csak DMARC-hiteles levelet fogad el, e nélkül minden válasza elakad (ilyenkor „NEM MENT KI” levelet kap). Fel kell venni.
6. **Resend:** fiók, domain és a `valasz` aldomain MX-e, webhook, API-kulcs. Lépések: `worker/README.md`.
7. **Turnstile:** kész (éles site key a `public/kozos.js`-ben, a secret beállítva a Workeren). Az éles `rollndoor.hu` és `www.rollndoor.hu` hosztnevet a widgetben fel kell venni az átállás előtt.
8. Élő próba: egy igény végigküldése, válasz mindkét irányban, csatolmánnyal.
9. A régi oldal hibái az átállással szűnnek meg (elavult WordPress, 2017-es akció, nem létező szegedi bemutatótermek, szemétoldalak a sitemapben).

### 2. kör (kb. 5,5 munkanap)

| Feladat | Nap |
|---|---|
| Ügyfél követőoldala (`/r/{token}`) | 1 |
| Ricsi megrendelés-oldala (`/m/{token}`): léptetés, megjegyzés, látványterv feltöltése | 1,5 |
| 7 automatikus levél, emlékeztetők (Cron, napi 1 futás), leiratkozás (`/le/{token}`) | 1,5 |
| Válasz írása a felületről (a továbbító már gyűjti a leveleket) | 1 |
| Beszerelés utáni vélemény- és fotókérés | 0,5 |

### Később

Fizetős Gemini az ajánlat megírásához, ajtó ráillesztése az ügyfél fotójára, „mi nem megy együtt” szabályok, ár vagy „-tól” ár, új logó, Analytics bekötése, heti D1-mentés.

### Ricsi összesítője (`/pult`), 2026-11-14, helyben kipróbálva

- Nyitóképernyő: 4 nagy csempe a darabszámmal (Rám vár · Készül · Ügyfélre vár · Lezárt); a csempére bökve jön az ügyek listája, a „Vissza” gomb és a telefon vissza-gombja is a csempékhez visz. Csoportok: **Rám vár** (1., 2., 4. állomás, jóváhagyott látványterv, megválaszolatlan ügyfél-üzenet), **Készül** (6., a beszerelés dátumával), **Ügyfélre vár** (3., jóváhagyásra váró 5., 7.), **Lezárt** (lezárt és „nem érdeklődik”, a legutóbbi 30). Minden sor a megrendelés `/m/…` oldalára visz.
- „Megválaszolatlan”: az utolsó ügyfél-üzenet (`uzenet.irany = 'be'`) frissebb, mint Ricsi utolsó válasza, megjegyzése vagy állomásváltása.
- Belépés: Ricsi a `/pult` oldalon belépőlinket kér, ami a `RICSI_EMAIL` címre megy (a cím kívülről nem adható meg). A link 15 percig él, egyszer használható, és csak gombnyomásra léptet be (a levelezők linkellenőrzője ne használja el). Utána `HttpOnly`, `SameSite=Strict` süti, 60 napig. Óránként legfeljebb 5 link kérhető. A tokenek csak SHA-256 hash-ként vannak a D1-ben (`pult_belepo`, `pult_munkamenet`).
- Élesítéshez: `worker/migrations/0003_pult.sql` a távoli D1-re, utána deploy. A megrendelésenkénti `/m/…` linkek változatlanul működnek.

## 7. Ismert kockázatok

- **Ricsi linkje jelszó nélküli:** aki megszerzi, léptethet és látja az ügyfél adatait. Nem szabad továbbküldeni.
- **Nincs sebességkorlát** az `/api/igeny`-en, csak Turnstile.
- **Nincs automatikus mentés** a D1-ről.
- **Resend:** amerikai cég, az adattárolás helye nincs ellenőrizve; az adatkezelési tájékoztatóban szerepel. EU-s csere: Brevo.
- **Windows:** ha a projekt útvonalában `&` van, az `npm run` és az `npx` elromlik. Klónozd tiszta útvonalra, vagy hívd közvetlenül: `node node_modules/wrangler/bin/wrangler.js dev`.

## 8. Mitől sikeres

| Cél | Kiinduló | 3 hónap múlva |
|---|---|---|
| Érdeklődők havonta | kb. 7–8 (becslés) | 15 |
| Válasz nélkül maradt ajánlatok | a nem rendelők többsége | a 2. kör után a fele |
| Mobil betöltés (LCP) | 6,3 mp | 2,5 mp alatt |
