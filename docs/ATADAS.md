# Átadás – aktuális állapot

Rövid, mindig naprakész összefoglaló annak, aki átveszi vagy folytatja a munkát. **Minden változtatással együtt frissítendő, ugyanabban a commitban.** A döntések indoklása és a részletes előzmények a [`TERV.md`](TERV.md)-ben vannak, a backend beállítása a [`../worker/README.md`](../worker/README.md)-ben.

Utolsó frissítés: 2026-11-25

## Kik

- **Ricsi:** tulajdonos, nem technikai ember. Az üzleti tényeket (ár, anyag, rögzítés, garancia) ő hagyja jóvá.
- **Zoli:** fejlesztő.

## Mi működik most

| Rész | Állapot |
|---|---|
| Főoldal (mintaoldal-másolat, galéria 80 valódi fotóval, GYIK, ajánlatkérő) | kész, workers.dev-en fut |
| Ajtólap- és vasalattípus-kártyák, részletes felugró ablakkal | kész; a vasalatoknál diavetítés (lent) |
| Ajtótervező (6 lépés, fotófeltöltés) → `POST /api/igeny` | kész |
| Fotóillesztés a tervező 6. lépésében (az ajtó az ügyfél saját fotóján) | **prototípus**, helyben kipróbálva, nincs élesítve |
| Technológia a főoldalon: „Így működik a dupla sín” cím és bevezető szöveg | kész. A videó és a faltípusos rögzítés 2026-11-25-én kikerült (Zoli). A `technologia.html` oldal és a `public/video/` fájlok a repóban maradtak, de a főoldal nem hivatkozik rájuk. |
| Megrendelés 7 állomása, automatikus levelek, cron | backend kész, élesben végigpróbálva |
| Ricsi dashboardja (`/dashboard`) | kész, **átmenetileg belépés nélkül nyitott** |
| Saját domain (`rollndoor.hu`) | **nincs átállítva**, a régi WordPress fut rajta |

### Vasalattípus-ablakok diavetítése (2026-11-24)

- A pajta, rejtett, lebegő és falban futó ablak bal oldalán ugyanaz a jelenet négy ajtólappal (tömörfa, nyomatos, fém, antik), 1,6 mp-es áttűnéssel, képenként 4,5 mp-ig. Az 5. dia a működés animációja (kb. 15 mp, mindig elölről indul). Pöttyökkel kézzel is lapozható. Csökkentett mozgásnál nincs automatikus lapozás.
- A képek montázsok, nem MI-generálások: az eredeti `public/img/tipus-*.webp` jelenet pixelre megmarad, csak az ajtólap felülete cserélődik a saját fotóinkból. Újragyártás: `python tools/ajtolap-montazs.py`. Az ajtólap maszkja a kimért sarkokból rajzolt, élsimított sokszög. A sötét, szürke vasalat (pánt, fogantyú) kimarad belőle, a barnás lapél viszont cserélődik (2026-11-25: így tűnt el a lebegő képek cakkos széle, a foltja és a barna élsávja).
- **Falban futó (2026-11-25):** az ajtó félig nyitva látszik, a lap elülső éle a nyílás közepén van. Az alapképen szinte teljesen a falban volt, ezért itt a lapot mi rajzoljuk be (`falban_felig()`). A tömörfa anyagot és a fogantyút a rejtett-kép adja, mert ugyanaz a jelenet.
- Az ablak 2026-11-25 óta 25%-kal nagyobb (max. 1125 px széles).
- **Ajtólap-ablakok (tömörfa, nyomatos, fém, antik), 2026-11-25:** a kép levágás nélkül, teljes egészében látszik, mögötte a saját elmosott változata (`.td-blur`, `.td-fit`, ugyanúgy, mint a galériában). A nyomatos ablak képe az izlandi fotónyomatos ajtó (`ref-22-fenykepes-nappali`), Zoli kérésére.
- Az animációk SVG + CSS rajzok. Újragyártás: `python tools/vasalat-animaciok.py`. Kód: `public/landing.js` (a típusablak része), stílus: `public/landing.css` (`.td-*`).
- **Ricsi nézze át:** a rejtett és a lebegő vasalat szerkezetét a felugró ablak szövegéből rajzoltuk, nem valódi műszaki rajzból.

### Fotóillesztés a tervezőben (2026-11-25, prototípus)

- A 6. lépésben az összegzés alatt egy lenyíló doboz van: „Nézd meg az ajtót a saját fotódon”. Az ügyfél a 2. lépésben feltöltött első fotón a 4 kerek pöttyöt a nyílás 4 sarkára húzza, és a választott ajtó perspektívahelyesen rákerül: ajtólap, szín, vasalat (pajtánál sín és görgők, lebegőnél árnyék, falban futónál félig nyitva), elrendezés (egy- vagy kétszárnyú), tolási irány és fogantyú.
- Kód: `public/fotoillesztes.js`, külső könyvtár nélkül (canvas, homográfia, háromszögrács). Textúrák: `public/img/illesztes/` (a `tools/ajtolap-montazs.py` gyártja). Stílus: `public/tervezo.css` (`.fi-*`).
- A fotó és a sarkok nem hagyják el a böngészőt, a szerverre csak a megszokott ajánlatkérés megy. „Kép mentése”: JPG-letöltés az ügyfél gépére.
- Felirat: „Szemléltető kép. A pontos látványtervet megrendelés után kapod.” **Ricsinek tudnia kell róla**, hogy az ügyfél ezt ne vegye ígéretnek.
- Korlátok: a nyomatos lapon mintakép van (a szegedi dóm), nem az ügyfél grafikája. Az üveg és a fém keretes üveg rajzolt, nem fotós. Fekvő fotón keskeny nyílásnál a pöttyök közel kerülnek egymáshoz. Valódi telefonon még nincs kipróbálva.

## Telepítés

- A `main` ágra pusholt commitokat a GitHub Actions élesítené, de **a repóból hiányzik a `CLOUDFLARE_API_TOKEN` és a `CLOUDFLARE_ACCOUNT_ID` secret**, ezért ezek a futások elbuknak. Amíg ez nincs beállítva, kézzel kell telepíteni a `main` ágról: `node node_modules/wrangler/bin/wrangler.js deploy`. A secret beállítása: `worker/README.md`, 10. pont.
- Az adatbázis-változáshoz külön migráció kell (`worker/migrations/`). A deploy ezt nem futtatja.

## Élesítés (domainváltás) előtt kötelező

1. A `/dashboard` belépés mögé: töröld a `DASHBOARD_NYILT` sort a `wrangler.jsonc`-ból, és vedd ki a „Dashboard” menüpontot. A próbamegrendeléseket töröld az éles D1-ből.
2. ~~A Technológia faltípusos része~~: 2026-11-25-én kikerült a főoldalról, nincs teendő.
3. A DNSSEC kikapcsolása az Integrityn, utána a névszerver-váltás, végül a `SITE_URL` visszaállítása a `wrangler.jsonc`-ban. A pontos sorrend a `TERV.md` 6. pontjában van.
4. Resend: domain és a `valasz` aldomain, webhook, DMARC-rekord.
5. Ricsi tartalmi teendői: GYIK-válaszok, cégadatok, adatkezelési szöveg, 4 galérianév, a `TODO`-k a típusablakokban.

## Buktatók

- **Windows, `&` a mappanévben:** az `npm run` és az `npx` nem működik, közvetlenül hívd a `node node_modules/...` formát.
- **Titkok:** `.dev.vars` és az API-kulcs-exportok (`*api-keys*.csv`) gitignore-ban vannak. Soha ne commitold őket.
- **Fotók:** a forrásfájlnevekben ügyfélnevek vannak. Feldolgozáskor töröld az EXIF/GPS adatokat, és adj névmentes fájlnevet.
- A `forras-kepek/` nagy része nincs a gitben, csak helyben van meg.
