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
| Ajtólap- és vasalattípus-kártyák, részletes felugró ablakkal | kész; a vasalatoknál diavetítés (lent). Címek: „Ajtólap típusok”, „Vasalat típusok” (2026-11-25). Az ajtólapkártyák 2026-11-25 óta álló, 4:5-ös képet kapnak (telefonon négyzetes), saját kivágással: `img/ajtolap-kartya-{tomorfa,nyomatos,fem,antik}.webp` (800×1000, EXIF nélkül; forrás: `ref-72`, `ref-82`, `ajtolap-fem` (Ricsi fotója), `galeria-06`). A kártya `<button>`, ezért flex oszloppal kényszerítjük a képet felülre és a „Részletek →”-t alulra (korábban a rövidebb szövegű kártyákon lecsúszott a kép). |
| Ajtótervező (6 lépés, fotófeltöltés) → `POST /api/igeny` | kész; a 6. lépés címe 2026-11-25 óta „Ezt adtad meg” (a „Hova küldjük az ajánlatot?” cím kikerült, Zoli kérésére) |
| Fotóillesztés a tervező 6. lépésében (az ajtó az ügyfél saját fotóján) | **prototípus**, élesben (workers.dev), valódi telefonon még nem kipróbálva |
| 3D előnézet a tervező 6. lépésében (Three.js) | **prototípus**, élesben a 3. változat (élő váltás, szoba, méretek, szabad fal, bypass, kép mentése, AR; a fotóminőség/sugárkövetés 2026-11-25-én kikerült). Asztali gépen kipróbálva; az AR valódi telefonon még nem |
| Technológia (dupla sín) | **törölve** 2026-11-25-én (Zoli): a főoldalon nincs, és a `technologia.html/.css/.js`, a `public/video/` és a `tools/video-felvetel.mjs` is kikerült a repóból. Visszaállítható a `7b19bc8` commitból (`git checkout 7b19bc8 -- public/technologia.html …`). A dupla sín a hero-sorban és az első kártyán szerepel. |
| „Így készül az ajtód” a főoldalon | 2026-11-25 óta idővonal ikonokkal (nem kártyalista): 1180 px felett 7 oszlop összekötő vonallal, 700–1179 px között 4 + 3, telefonon függőleges. HTML: `index.html` `#rendeles-menete`, stílus: `landing.css` (`.steps`, `.step-ik`). |
| Világos, otthonosabb főoldal – **PRÓBAVÁLTOZAT** | csak a `/?tema=vilagos` címmel jelenik meg, az alap (sötét) oldal változatlan. Krém/homok háttér, sötétebb karamell kiemelőszín (`#9c6842`, világos alapon is olvasható), lakásfotós hero (`ref-01`, tükrözve), lekerekített kártyák és gombok, lágy árnyékok, meleg sötétbarna lábléc, világos alapra színezett logó (`img/logo-vilagos.webp`). Fájl: `public/landing-vilagos.css`, kapcsoló: egy sor az `index.html` fejében. A többi oldal (tervező, blog) nem kapja meg. **Ricsi döntésére vár**; ha jóváhagyja, a változókat a `landing.css`-be kell átvezetni, és a kapcsolót törölni. |
| Megrendelés 7 állomása, automatikus levelek, cron | backend kész, élesben végigpróbálva |
| Ricsi dashboardja (`/dashboard`) | kész, **átmenetileg belépés nélkül nyitott** |
| Ricsi 1. módosítási köre (`Módosítások_V1.docx`, 2026-11-26) | **kész**: a hero-ból kikerült a „Minden ajtót dupla sínnel szerelünk.” sor és a „Fedezd fel…” bekezdés (a dokumentum „Ezek nem kellenek” felirata képen volt, ez a értelmezésünk, Ricsi megerősítésére vár); a dupla sínes kártyáról lekerült az „Ez a legfontosabb” jelvény, új szöveg; „Személyre szabott dizájn” és „Profi beszerelés” (korábban „Könnyű beszerelés”, a GLS-es mondat kikerült) Ricsi szövegével; menü: Kezdőlap, Miért a Roll’n’Door, Ajtólapok, Vasalatok, Ajtótervező, GY.I.K., Kapcsolat, Ajánlatkérés (Galéria, Blog és Dashboard kikerült; a `/dashboard` címen továbbra is elérhető); a blog ki van kapcsolva: a `/blog` és `/blog.html` a `_redirects`-ben a főoldalra irányít (`blog.html` megmaradt, visszakapcsoláskor a `_redirects` négy sorát kell törölni). A menü `white-space: nowrap` lett, hogy 1024 px-en is egy sorban maradjon. |
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

- A 6. lépésben az összegzés alatt egy lenyíló doboz van: „Nézd meg az ajtót a saját fotódon”. (A két lenyíló doboz – 3D és fotó – címe 2026-11-25 óta nagyobb, 1,35rem, és középre igazított: `tervezo.css` `.fi-sum`.) Az ügyfél a 2. lépésben feltöltött első fotón a 4 kerek pöttyöt a nyílás 4 sarkára húzza, és a választott ajtó perspektívahelyesen rákerül: ajtólap, szín, vasalat (pajtánál sín és görgők, lebegőnél árnyék, falban futónál félig nyitva), elrendezés (egy- vagy kétszárnyú), tolási irány és fogantyú.
- **Választópontok a fotón (2026-11-25, élesben):** ugyanazok a pontok és felugró ablak, mint a 3D-ben (közös kód: `public/valaszto.js`). Itt is **csak anyag és szín**: „+” a lapon → anyag és szín; „+” a pajtasín nyílás melletti, kinyúló részén → a vasalat színe (csak pajtánál). Elrendezés, irány, vasalattípus és méret itt sem választható. A lapra vagy a pajtasínre koppintva is nyílik. A pontok a sarokpöttyök alatt vannak, és a sarkoktól távol, így a húzás mindig elsőbbséget kap. „Csak a fotó” módban nincsenek pontok. A fotón választott érték a tervező mezőjébe íródik, és a nyitott 3D is frissül (`tervezo.js` `beallitFoto`). Új a fotón: a pajtasín a vasalat választott színében látszik (fekete, inox, antik bronz, fehér), és az egymás előtt futó elrendezés két, középen átfedő lappal rajzolódik.
- Kód: `public/fotoillesztes.js`, külső könyvtár nélkül (canvas, homográfia, háromszögrács). Textúrák: `public/img/illesztes/` (a `tools/ajtolap-montazs.py` gyártja). Stílus: `public/tervezo.css` (`.fi-*`).
- A fotó és a sarkok nem hagyják el a böngészőt, a szerverre csak a megszokott ajánlatkérés megy. „Kép mentése”: JPG-letöltés az ügyfél gépére.
- Felirat: „Szemléltető kép. A pontos látványtervet megrendelés után kapod.” **Ricsinek tudnia kell róla**, hogy az ügyfél ezt ne vegye ígéretnek.
- Korlátok: a nyomatos lapon mintakép van (a szegedi dóm), nem az ügyfél grafikája. Az üveg és a fém keretes üveg rajzolt, nem fotós. Fekvő fotón keskeny nyílásnál a pöttyök közel kerülnek egymáshoz. Valódi telefonon még nincs kipróbálva.

### 3D előnézet a tervezőben (2026-11-25, 3. változat)

- A 6. lépésben a „Nézd meg 3D-ben” doboz a választásokból épít egy körbeforgatható, valósághű jelenetet (fények, tükröződés, lakkozott fa, fém, üveg, berendezett szoba, a nyíláson át a szomszéd szoba).
- **Élő váltás a tárgyakon (2026-11-25, élesben):** a jelenet alatti gombsorok helyett pontok ülnek a tárgyakon (valódi HTML-gombok egy réteg­ben a vászon fölött, a 3D-s horgonyokat követik, takarásban vagy a képen kívül eltűnnek). **A 3D-ben csak anyag és szín választható (Zoli döntése, 2026-11-25):** ajtólap „+” → anyag és szín; vasalat „+” a sínen → a vasalat színe (csak pajtánál, mert csak ott látszik a vasalat). A geometria (elrendezés, nyitási irány, vasalattípus) és a méret az előnézetekben (3D és fotó) nem változtatható, csak a tervező lépéseiben; ezért nincs „⇄” és méretpont. A választható értékek listája: `valaszto.js` `VALASZTOK`. Magára az ajtólapra vagy a vasalatra koppintva ugyanez nyílik (raycast; 6 px-nél nagyobb mozdulat forgatásnak számít). Asztali gépen kis ablak a pont mellett, 700 px alatt alulról felcsúszó panel (a ragadós gombsáv fölött, `z-index: 60`). Esc, ×, mellé kattintás zárja; választás után nyitva marad. Az első választásig a pontok pulzálnak (csökkentett mozgásnál nem). Ha egy csoportnak nincs látható sora (pl. falban futó + kétszárnyú), a pontja nem látszik. A választások ugyanúgy **visszaíródnak a tervező mezőibe** (`beallit3d`), így az összegzésbe és az ajánlatkérésbe is bekerülnek. A vasalat nem fekete színe „Egyéb: Inox” stb. formában kerül a `vasalatEgyeb` mezőbe.
- **Közös kód:** a választók listája, a felugró ablak, a pontok és a koppintásfelismerés (6 px, 600 ms) a `public/valaszto.js`-ben van (`window.Valaszto`, hagyományos szkript; a `tervezo.html` tölti be a `fotoillesztes.js` előtt). Ha telefonon a koppintás és a húzás/forgatás összekeveredik, ott kell hangolni (`KOPP_PX`, `KOPP_MS`). A CSS-osztályok (`.d3-pont`, `.d3-pop`) mindkét nézetben ugyanazok.
- **Buktató:** a vászon magassága legalább 200 px (`meretez`), mert 0 magasságnál (rejtett vagy épp átméretezett ablak) a kamera képaránya végtelen lett, és üres kép, NaN-os pontok jöttek.
- **Gombsor:** Nyisd ki, Alapnézet, Kép mentése, AR, „Továbbiak” (Méretek, fal és padló). A pontok nem kerülnek rá a mentett képre.
- **Teljes képernyő (2026-11-25):** ⛶ gomb a jelenet jobb felső sarkában (`teljesBe`/`teljesKi`). Ahol a böngésző engedi, a saját teljes képernyős módja indul (Fullscreen API); ahol nem (iPhone Safari elemet nem enged teljes képernyőre; a fejlesztői böngészőpanel sem), ugyanaz a `.d3-teljes-mod` osztály a böngészőablakot kitöltő rétegként jeleníti meg. Kilépés: ✕, Esc (a felugró választó nyitva: az első Esc azt zárja). Belépéskor és kilépéskor a vászon a teljes ablakmagasságot kapja vagy visszaáll, és a kamera újrakeretez (`alapNezet`); a lap alatta nem görög. A gombsor (Nyisd ki stb.) teljes képernyőn nem látszik. Kipróbálva a böngésző telefonos nézetében a helyettesítő réteggel; valódi telefonon is működik (Zoli visszajelzése, 2026-11-25; a telefon típusa nincs feljegyezve).
- **Kipróbálva** a helyi szerveren 1280 és 375 px szélességben (pontok, választás és visszaírás, Esc, mellé kattintás, koppintás az ajtóra, Továbbiak; a szűkítés után lebegő és pajta vasalattal is). Valódi telefonon nem.
- **Szoba (csak a nézethez, nem kerül az ajánlatkérésbe):** fal (fehér, bézs, szürke, sötét, látszó tégla), padló (világos vagy sötét parketta, járólap). A választás a böngészőben megmarad (`localStorage`: `rnd_3d_szoba`).
- **Méretek:** méretvonal a nyílás szélességén és magasságán (és a szabad falon), ki-be kapcsolható. A felirat a vonal közepén ül, a vonal színével, és a képernyőn mindig ugyanakkora (legfeljebb 26 px magas, `FELIRAT_PX`; keskeny, telefonos nézetben a szélesség 4,5%-a, de legalább 17 px, hogy a szomszédos feliratok ne érjenek össze), akármilyen messziről nézzük (`sizeAttenuation: false`, `feliratokMeretez`). Korábban a térben volt rögzített méretű, és távolról olvashatatlanul kicsi lett (2026-11-25).
- **Szabad fal:** új, nem kötelező mező a tervező 2. lépésében (`szabadFal`, cm; az ajánlatkérésben `szabad_fal_cm`, és az összegzés sorai között is). Ha meg van adva, a 3D-ben sarokfal áll ennyire a nyílástól a nyitás oldalán (kétszárnyúnál mindkét oldalon), zöld vagy piros méretvonallal és szöveges jelzéssel. A szükséges hely becslése: a lap szélessége + 3 cm (falban futónál + 5 cm). **TODO Ricsi:** erősítse meg, mennyi szabad fal kell valójában (ráhagyás, ütköző, fogantyú).
- **Egymás előtt futó (bypass):** két lap két sínen, nyitáskor az elülső a hátsó elé csúszik; pajtánál két külső sín.
- **Fotóminőség (sugárkövetés): kikerült (2026-11-25, Zoli döntése).** Gyenge gépen percekig szemcsés képet adott, folyamatosan terhelte a grafikus kártyát (telefonon az akkut is), és a legtörékenyebb rész volt. Most csak valós idejű kép van: a jelenet csak változáskor (forgatás, nyitás, választás) rajzolódik újra, álló nézetben nem terhel. A környezeti fény `PMREMGenerator` + `RoomEnvironment`. A three.js-fájlból a `three-gpu-pathtracer` és a `three-mesh-bvh` is kikerült (1,28 MB → 1,06 MB, tömörítve 372 → 312 KB). A régi változat a `5ca36f7` commitban van.
  - A sugárkövető miatt bevezetett megoldások maradtak, mert működnek és kivenni csak kockázat: egyanyagú tárgyak (az ajtólap doboz + két felület), normal térkép a textúrából `bumpMap` helyett, nincs mennyezet, nincs extrudált (lekerekített élű) geometria.
- **Kép mentése:** JPG-letöltés a jelenetről (a valós idejű kép).
- **AR (kísérleti, csak érintőképernyőn látszik a gomb):** 1. érintésre az ajtó modellje (lapok + vasalat, zárt helyzetben) GLB-be exportálódik, és betöltődik a model-viewer; 2. érintésre indul az AR falra helyezéssel. Androidon WebXR, iPhone-on Quick Look (a USDZ-t a model-viewer készíti). A Scene Viewer nincs bekapcsolva, mert a böngészőben készült (`blob:`) modellt nem tudja megnyitni. Ha a készülék nem támogatja, szöveges jelzés jön. **Valódi telefonon még nincs kipróbálva.**
- Kód: `public/elonezet3d.js`; three.js 0.187.0 + RoomEnvironment + OrbitControls + GLTFExporter + RectAreaLightUniformsLib egy fájlban (`public/vendor/three/three.bundle.min.js`, kb. 312 KB tömörítve; újragyártás: a `README.txt` mellette); `@google/model-viewer` 4.4.0 (Apache-2.0, `public/vendor/model-viewer/`, kb. 290 KB tömörítve, csak az AR-gombra töltődik be). Részletek a két `README.txt`-ben.
- Ha a böngésző nem tud WebGL-t, a doboz ezt kiírja, az ajánlatkérés működik tovább.

## Folytatás új sessionben – nyitott teendők (2026-11-25)

Minden munka a `main` ágban van és élesben fut a workers.dev próbacímen (utolsó deploy: 2026-11-25, a 3D és a fotós választópontokkal, PR #12); nincs félbehagyott ág vagy commitolatlan módosítás.

1. **Ricsi döntései:** a világos téma (`/?tema=vilagos`) legyen-e az alap (ha igen: a változókat a `landing.css`-be átvezetni, a kapcsolót törölni, a tervezőt és a blogot is átszínezni); mennyi szabad fal kell a nyitott ajtónak (most lapszélesség + 3–5 cm); a rejtett és a lebegő vasalat rajza helyes-e; a `TODO`-k a típusablakokban, a GYIK-ban és a galérianevekben.
2. **Telefonos próba:** az AR („Nézd meg a szobádban”) és a 3D pontjai (alsó panel, koppintás vs. forgatás) valódi telefonon.
   A fotón is ki kell próbálni: a pontok és a sarokpöttyök egymás mellett telefonon, keskeny nyílásnál.
3. **GitHub-deploy:** a `CLOUDFLARE_API_TOKEN` és a `CLOUDFLARE_ACCOUNT_ID` secret beállítása (addig kézi deploy, lásd lent).
4. **Domainváltás** a lenti „Élesítés előtt kötelező” lista szerint.
5. ~~A `public/script.js` régi galérialistája~~: 2026-11-25-én kitakarítva; a fájlban (csak az adatkezelési és az impresszum oldal tölti be) már csak a menükód van, a régi űrlap- és galériakód kikerült.

## Telepítés

- A `main` ágra pusholt commitokat a GitHub Actions élesítené, de **a repóból hiányzik a `CLOUDFLARE_API_TOKEN` és a `CLOUDFLARE_ACCOUNT_ID` secret**, ezért ezek a futások elbuknak. Amíg ez nincs beállítva, kézzel kell telepíteni a `main` ágról: `node node_modules/wrangler/bin/wrangler.js deploy`. A secret beállítása: `worker/README.md`, 10. pont.
- Az adatbázis-változáshoz külön migráció kell (`worker/migrations/`). A deploy ezt nem futtatja.

## Élesítés (domainváltás) előtt kötelező

1. A `/dashboard` belépés mögé: töröld a `DASHBOARD_NYILT` sort a `wrangler.jsonc`-ból, (a „Dashboard” menüpont 2026-11-26 óta már nincs a főoldalon). A próbamegrendeléseket töröld az éles D1-ből.
2. ~~A Technológia faltípusos része~~: 2026-11-25-én kikerült a főoldalról, nincs teendő.
3. A DNSSEC kikapcsolása az Integrityn, utána a névszerver-váltás, végül a `SITE_URL` visszaállítása a `wrangler.jsonc`-ban. A pontos sorrend a `TERV.md` 6. pontjában van.
4. Resend: domain és a `valasz` aldomain, webhook, DMARC-rekord.
5. Ricsi tartalmi teendői: GYIK-válaszok, cégadatok, adatkezelési szöveg, 4 galérianév, a `TODO`-k a típusablakokban.

## Buktatók

- **Windows, `&` a mappanévben:** az `npm run` és az `npx` nem működik, közvetlenül hívd a `node node_modules/...` formát.
- **Titkok:** `.dev.vars` és az API-kulcs-exportok (`*api-keys*.csv`) gitignore-ban vannak. Soha ne commitold őket.
- **Fotók:** a forrásfájlnevekben ügyfélnevek vannak. Feldolgozáskor töröld az EXIF/GPS adatokat, és adj névmentes fájlnevet.
- A `forras-kepek/` (nyers fotók, logók, a mintaoldal és a régi oldal) **teljesen gitignore-ban van**: a fájlnevekben ügyfélnevek vannak, a repó nyilvános. Csak Zoli gépén van meg; a feldolgozott, névtelenített képek a `public/img/` alatt vannak.
