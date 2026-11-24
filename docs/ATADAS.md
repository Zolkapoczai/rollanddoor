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
| Fotóillesztés a tervező 6. lépésében (az ajtó az ügyfél saját fotóján) | **prototípus**, élesben (workers.dev), valódi telefonon még nem kipróbálva |
| 3D előnézet a tervező 6. lépésében (Three.js) | **prototípus**; élesben a 2. változat (Zoli telefonon kipróbálta, működik). A 3. változat (élő váltás, szoba, méretek, szabad fal, bypass, kép mentése, AR, fotóminőség sugárkövetéssel) helyben kipróbálva, nincs élesítve |
| Technológia (dupla sín) a főoldalon | **kikerült** 2026-11-25-én (Zoli): sem a szakasz, sem a „Technológia” menüpont nincs a főoldalon. A `technologia.html`, a `technologia.css`/`.js` és a `public/video/` a repóban maradt, de semmi nem hivatkozik rájuk. A dupla sín továbbra is szerepel a hero-sorban és az első kártyán. |
| „Így készül az ajtód” a főoldalon | 2026-11-25 óta idővonal ikonokkal (nem kártyalista): 1180 px felett 7 oszlop összekötő vonallal, 700–1179 px között 4 + 3, telefonon függőleges. HTML: `index.html` `#rendeles-menete`, stílus: `landing.css` (`.steps`, `.step-ik`). |
| Világos, otthonosabb főoldal – **PRÓBAVÁLTOZAT** | csak a `/?tema=vilagos` címmel jelenik meg, az alap (sötét) oldal változatlan. Krém/homok háttér, sötétebb karamell kiemelőszín (`#9c6842`, világos alapon is olvasható), lakásfotós hero (`ref-01`, tükrözve), lekerekített kártyák és gombok, lágy árnyékok, meleg sötétbarna lábléc, világos alapra színezett logó (`img/logo-vilagos.webp`). Fájl: `public/landing-vilagos.css`, kapcsoló: egy sor az `index.html` fejében. A többi oldal (tervező, blog) nem kapja meg. **Ricsi döntésére vár**; ha jóváhagyja, a változókat a `landing.css`-be kell átvezetni, és a kapcsolót törölni. |
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

### 3D előnézet a tervezőben (2026-11-25, 3. változat)

- A 6. lépésben a „Nézd meg 3D-ben” doboz a választásokból épít egy körbeforgatható, valósághű jelenetet (fények, tükröződés, lakkozott fa, fém, üveg, berendezett szoba, a nyíláson át a szomszéd szoba).
- **Élő váltás:** a jelenet alatti gombokkal váltható az ajtólap, a szín, a vasalat típusa és színe (matt fekete, inox, antik bronz, fehér), az elrendezés (egyszárnyú, kétszárnyú, egymás előtt) és a nyitás iránya. Ezek **visszaíródnak a tervező mezőibe** (a `tervezo.js` `beallit3d` függvénye), így az összegzésbe és az ajánlatkérésbe is bekerülnek. A vasalat nem fekete színe „Egyéb: Inox” stb. formában kerül a `vasalatEgyeb` mezőbe.
- **Szoba (csak a nézethez, nem kerül az ajánlatkérésbe):** fal (fehér, bézs, szürke, sötét, látszó tégla), padló (világos vagy sötét parketta, járólap). A választás a böngészőben megmarad (`localStorage`: `rnd_3d_szoba`).
- **Méretek:** méretvonal a nyílás szélességén és magasságán, ki-be kapcsolható.
- **Szabad fal:** új, nem kötelező mező a tervező 2. lépésében (`szabadFal`, cm; az ajánlatkérésben `szabad_fal_cm`, és az összegzés sorai között is). Ha meg van adva, a 3D-ben sarokfal áll ennyire a nyílástól a nyitás oldalán (kétszárnyúnál mindkét oldalon), zöld vagy piros méretvonallal és szöveges jelzéssel. A szükséges hely becslése: a lap szélessége + 3 cm (falban futónál + 5 cm). **TODO Ricsi:** erősítse meg, mennyi szabad fal kell valójában (ráhagyás, ütköző, fogantyú).
- **Egymás előtt futó (bypass):** két lap két sínen, nyitáskor az elülső a hátsó elé csúszik; pajtánál két külső sín.
- **Fotóminőség (sugárkövetés, 2026-11-25):** ha a nézet áll, a `three-gpu-pathtracer` (WebGLPathTracer) képkockáról képkockára fotórealisztikus képet számol (valódi visszaverődés, lágy árnyék, üvegen át jövő fény); mozgatás vagy nyitás közben a gyors, valós idejű kép látszik. Az első ~150 mintánál zajszűrő simít. A gomb melletti számláló mutatja a mintaszámot, 1500 mintánál megáll. Kikapcsolható („Fotóminőség: ki”). Ha a grafikus kártya leállítja a számítást (elveszett WebGL-kontextus), szöveges jelzés jön.
  - **Buktatók (ha a jelenetet bővíted):** a sugárkövető (1) nem ismeri a `bumpMap`-et, ezért normal térképet rajzolunk a textúrából (`normalTerkep`), ehhez tangens kell (`computeTangents`); (2) **nem kezeli a többanyagú tárgyakat** (anyagtömb, csoportok): elcsúsznak az anyagok, hibás szín és árnyék lesz. Minden tárgy egyetlen anyagú legyen (az ajtólap ezért doboz + két felület), az egyanyagú dobozok csoportjait töröljük; (3) a mennyezet valódi tárgyként elvenné a fényt, ezért nincs; (4) a kockatérképes környezetet a saját átalakítója a three.js 0.187-tel nem tudja feldolgozni, ezért equirect adattextúrát készítünk (`equirectKockabol`); (5) az extrudált (lekerekített élű) geometria hibás árnyékot vetett, ezért nem használjuk.
  - Sebesség: a fejlesztői gépen (Intel UHD) kb. 1–6 minta/s; 50–100 mintától kellemes a kép.
- **Kép mentése:** JPG-letöltés a jelenetről (fotóminőségben, ha az már elkészült).
- **AR (kísérleti, csak érintőképernyőn látszik a gomb):** 1. érintésre az ajtó modellje (lapok + vasalat, zárt helyzetben) GLB-be exportálódik, és betöltődik a model-viewer; 2. érintésre indul az AR falra helyezéssel. Androidon WebXR, iPhone-on Quick Look (a USDZ-t a model-viewer készíti). A Scene Viewer nincs bekapcsolva, mert a böngészőben készült (`blob:`) modellt nem tudja megnyitni. Ha a készülék nem támogatja, szöveges jelzés jön. **Valódi telefonon még nincs kipróbálva.**
- Kód: `public/elonezet3d.js`; three.js 0.187.0 + RoomEnvironment + OrbitControls + GLTFExporter + RectAreaLightUniformsLib + three-gpu-pathtracer 0.0.28 + three-mesh-bvh 0.10.0 egy fájlban (`public/vendor/three/three.bundle.min.js`, kb. 372 KB tömörítve); `@google/model-viewer` 4.4.0 (Apache-2.0, `public/vendor/model-viewer/`, kb. 290 KB tömörítve, csak az AR-gombra töltődik be). Részletek a két `README.txt`-ben.
- Ha a böngésző nem tud WebGL-t, a doboz ezt kiírja, az ajánlatkérés működik tovább.

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
