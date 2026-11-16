# Prompt – Roll’n’Door galéria átalakítása (Fable 5.2, új session, ügynökök nélkül)

> Másold be az alábbi részt az új session első üzenetének. A táblázat és a csoportok a végén a javaslat, amit az előző session a 80 kép egyenkénti átnézése után készített.

---

Senior UI/UX designerként és frontend fejlesztőként dolgozz. **Ne indíts ügynököket és subagenteket**, egyedül végezd el. Magyarul, hétköznapi nyelven kommunikálj (Zoli fejleszt, Ricsi a tulajdonos, nem technikai ember).

## Előzmény

Először olvasd el a `CLAUDE.md`-t és a `docs/TERV.md`-t. Windows, a mappa nevében `&` van, ezért az `npm run` és az `npx` nem működik:
- típusellenőrzés: `node node_modules/typescript/bin/tsc --noEmit -p .`
- helyi szerver: `.claude/launch.json` `rollndoor-dev` (port 8787), `preview_start`-tal indítsd.

Nincs keretrendszer, build lépés, külső könyvtár. Sima HTML, CSS, JS. Titkot ne írj ki. **Commitolni és pusholni csak kérésre.**

## Mi a mostani helyzet

- A galéria a `public/index.html` `#galeria` szekciójában van (`.gallery-strip`, `.gallery-nav` gombok), a stílus a `public/landing.css`-ben, a logika és a 80 képes lista a `public/landing.js`-ben (`const galleryImages = [{src, alt}]`, kb. a 142. sortól). Jelenleg egy vízszintes scroll-snap sáv, kézzel kell lapozni, és van lightbox (nagyítás, képaláírás az `alt` szövegből).
- A `public/script.js`-ben is van egy `galleryImages` lista. **Először nézd meg, hogy az `index.html` betölti-e (most a `kozos.js`, `landing.js`, `technologia.js` van benne), és hogy a többi oldal használja-e.** Ha nem használja senki, ne nyúlj hozzá, és jelezd Zolinak.
- A képek: `public/img/referencia/*.webp`. A fájlneveket **ne nevezd át**, csak a megjelenő szöveget (képaláírás, `alt`) cseréld.
- Zoli kiadott egy `docs/galeria-kepek.xlsx`-et is, hogy Ricsi átírhassa a leírásokat. Ha Zoli a következő üzenetben visszaküld kitöltött változatot, abból dolgozz, az felülírja az alábbi neveket.

## Mit kell csinálni

### 1. Sorrend

Használd az alábbi táblázat sorrendjét (az „Új #” oszlop). A logika: **ugyanabból a lakásból/ajtóról készült képek ne kerüljenek egymás mellé, és lehetőleg ne is egymás közelébe**. Az egyes csoportokon belül legalább 12 hely van a képek között, a csoportok listája lent. A részletképek (sínvég, görgő, kültéri sín) és a nyomtatott/speciális ajtók szétszórva, nem csomóban jönnek. A nyitó képek a legerősebb enteriőrök.

Mielőtt beépíted, **nézd meg magad is a képeket** (`public/img/referencia/`), és javítsd a sorrendet vagy a besorolást, ha tévedést találsz. Az előző session kontaktlapról, kis felbontásban nézte át őket, ezért a típusok előzetes javaslatok.

### 2. Elnevezések

A rövid, egyszerű név ebben a formában: **„Típus – szín”**. Nincs hosszú leírás, nincs kitalált jelző. A típusokat a `docs/ajtomintaelnevezések.jpg` ábrájáról vedd, ez a 8 név:

> **Dupla X · Felső X · Átló · Sima · Vízszintes osztó · Felső Z · Dupla Z · Fejlőléces**

Szabályok:
- Ha az ajtó beleillik a 8 típusba, pontosan ezt a nevet használd (nagybetűkkel, ahogy az ábrán áll).
- Ami nem illik bele (üveges, kazettás, antik, fotónyomatos, krétatáblás, lézervágott, tükrös, egy darab fa, fém), azt egyszerűen nevezd meg („Üveges”, „Antik kazettás”, „Fotónyomatos”). Ne találj ki új szakszót.
- Kétszárnyú esetén: „Dupla Z, kétszárnyú – natúr fa”.
- **A szín egyszerű**: fehér, fekete, natúr fa, mézbarna, sötétbarna, szürke, kék, zöld, petrolzöld, menta, sárga. Ne írj „kopott patinás krémfehér” jellegű szöveget.
- Részletképeknél: „Sínvég logóval – fekete”, „Görgő közelről – acél”.
- Üzleti tényt (ár, anyag, méret, garancia) ne írj a nevekbe. Ami nincs a képen, abból ne találj ki semmit.
- A név menjen a lightbox képaláírásába és az `alt` attribútumba is. Az `alt` maradjon értelmes és rövid, mondjuk „Dupla Z, kétszárnyú – natúr fa tolóajtó”.

### 3. Új galéria nézet (Apple-stílusú, középen nagy kép)

- **Középen egy nagyobb aktív kép**, balra és jobbra egy-egy kisebb, kissé halványabb szomszéd (coverflow / Apple TV, Apple-termékoldal hangulat). A szomszédok kisebbek, de egyértelműen látszanak, és a kattintás rájuk őket hozza középre.
- **Magától lapozzon** (slideshow), kb. 4–5 másodpercenként, lágy átmenettel (transform + opacity, nincs layout-animáció). Ne kelljen gombot nyomni.
- Az automatikus lapozás **álljon meg**, ha: az egér fölötte van, fókusz van benne, a lightbox nyitva van, a szekció nincs a képernyőn (`IntersectionObserver`), a lap háttérben van (`visibilitychange`). Érintésnél érintés után vegye vissza egy kis késleltetéssel.
- Kézzel is használható: nyíl gombok, billentyűzet (←/→), **swipe** mobilon, pontjelző vagy számláló (pl. „12 / 80”), play/pause gomb.
- `prefers-reduced-motion: reduce` esetén **nincs automatikus lapozás és nincs mozgásos átmenet**, csak kézi váltás.
- A nézet legyen **végtelen** (a végén visszaér az elejére).
- Különböző oldalarányú képek (álló, fekvő, négyzet) fussanak ugyanabba a középső keretbe `object-fit: contain` vagy `cover` döntéssel, úgy, hogy az álló ajtófotók ne legyenek levágva értelmetlenül. Döntsd el, mi néz ki jobban, és indokold egy mondatban. Háttérként finom elmosott változat (blur) szóba jöhet, ha egyszerűen megoldható CSS-szel.
- **Teljesítmény**: csak az aktív és a két szomszéd kép töltődjön be azonnal, a többi `loading="lazy"` / előtöltés a következő 1–2 kép. Ne tölts be egyszerre 80 képet.
- **Hozzáférhetőség**: `role="region"` + `aria-roledescription="carousel"`, a gombok kapjanak magyar `aria-label`-t, az aktuális kép kapjon `aria-live="polite"` bejelentést csak kézi váltáskor, a fókusz látható legyen, a gombok legalább 44 px-esek.
- A **lightbox maradjon**: középső képre kattintva nagyít, ott is működik a nyíl és az Esc. A képaláírás az új név.
- A meglévő arculathoz igazodj (sötét, `--accent`, `--bg-glass`, a `landing.css` változói). Ne vezess be új színeket vagy betűtípust.
- A régi `.gallery-strip` scroll-snap megoldás és a hozzá tartozó, már nem használt CSS/JS menjen ki, de **csak az, ami tényleg a galériához tartozott**.

## Ellenőrzés (kötelező)

1. `tsc` hiba nélkül fut.
2. `preview_start` → `rollndoor-dev`, `/`-n a `#galeria`: középen nagy kép, két kisebb szomszéd, magától lapoz (nézd meg két váltáson át), nyilak, billentyű, lightbox működik.
3. Mobil nézet (`resize_window` mobile): nem lóg ki, a szomszédok nem törik el az elrendezést, swipe-ra reagál. Világos/sötét témánál nincs gond, ha van ilyen az oldalon.
4. Konzolhiba nincs (`read_console_messages`), a hálózatban nem töltődik be egyszerre 80 kép.
5. Kérj egy képernyőképet a végeredményről, és mutasd meg.

Végén: mi változott, mit ellenőriztél, mit nem sikerült ellenőrizni. Ne commitolj.

---

## Javasolt csoportok („ugyanaz a lakás / ajtó”, egymástól távol tartandó)

Jelölés: a **régi #** a mostani `landing.js` lista sorszáma.

- **A (tégla, pampafű, zöld fotel)**: régi # 1, 2, 3, 4, 6
- **B (szürke szövetfal, hálószoba)**: régi # 5, 68, 73
- **C (sötét járólap)**: régi # 8, 18
- **D (márványpadló)**: régi # 11, 14
- **E (mintás járólap, WC/fürdő)**: régi # 16, 29, 61
- **F (türkiz ajtó)**: régi # 25, 26
- **G (kék ajtó, polcos gardrób)**: régi # 28, 54
- **H (szürkésbarna ajtó, fehér szekrény)**: régi # 30, 34

Megjegyzés: a 9, 17, 25, 33, 41, 49, 57, 65, 73 részletkép (sín/görgő). A 48, 51, 75, 77 nyomtatott vagy lézervágott minta. A 38, 40, 80 krétatáblás. Ezek külön szóródjanak.

## Javasolt sorrend és nevek

Előzetes javaslat. A típusokat (Dupla Z, Felső Z, Átló stb.) a nagy felbontású képek alapján ellenőrizd, a bizonytalanokat jelöld meg Zolinak.

| Új # | Régi # | Fájl | Új név | Hely |
|---|---|---|---|---|
| 1 | 1 | `ref-01-nappali-fa-ajto.webp` | Sima – natúr fa | A |
| 2 | 10 | `ref-05-rusztikus-ajtopar.webp` | Dupla Z, kétszárnyú – natúr fa |  |
| 3 | 5 | `ref-03-fenyo-ajtopar-haloszoba.webp` | Vízszintes osztó, kétszárnyú – natúr fa | B |
| 4 | 26 | `ref-12-turkiz-biciklis-lampa.webp` | Átló – petrolzöld | F |
| 5 | 19 | `ref-09-kandallo-z-ajto.webp` | Átló – mézbarna |  |
| 6 | 30 | `ref-14-szurke-x-ketszarnyu.webp` | Dupla X, kétszárnyú – szürkésbarna | H |
| 7 | 9 | `ref-38-logos-sinveg-gorgo.webp` | Sínvég logóval – fekete |  |
| 8 | 16 | `ref-08-furdo-rusztikus.webp` | Felső Z – sötét fa | E |
| 9 | 79 | `ref-37-konyha-z-ajto.webp` | Átló – natúr fa |  |
| 10 | 37 | `ref-17-fekete-osztasu-uveg.webp` | Üveges kétszárnyú – natúr fa |  |
| 11 | 54 | `ref-67-turkiz-z-gardrob.webp` | Dupla Z – kék | G |
| 12 | 62 | `ref-28-zold-uveges.webp` | Üveges – zöld |  |
| 13 | 72 | `ref-80-z-ajto-kutyak.webp` | Felső Z – natúr fa |  |
| 14 | 66 | `ref-72-fenyo-deszka-gorgos.webp` | Sima – natúr fa |  |
| 15 | 58 | `ref-26-antik-diszes.webp` | Antik ajtó – kopott natúr |  |
| 16 | 44 | `ref-20-fekete-uveges-furdo.webp` | Üveges, fekete keretes – fehér |  |
| 17 | 3 | `ref-02-feher-uveges-ketszarnyu.webp` | Üveges kétszárnyú – fehér | A |
| 18 | 23 | `ref-11-mentazold-furdo.webp` | Átló – menta |  |
| 19 | 31 | `ref-56-rusztikus-z-folyoso.webp` | Átló – sötétbarna |  |
| 20 | 7 | `ref-04-szurkeszold-ketszarnyu.webp` | Dupla Z, kétszárnyú – petrolzöld |  |
| 21 | 56 | `ref-68-szurkesfeher-z.webp` | Átló – szürke |  |
| 22 | 41 | `ref-87-logos-sinveg-feher-fal.webp` | Sínvég logóval – fekete |  |
| 23 | 14 | `ref-07-sotet-fal-fenyo.webp` | Átló – natúr fa | D |
| 24 | 42 | `ref-19-mertani-uveges.webp` | Díszüveges kétszárnyú – fehér |  |
| 25 | 68 | `ref-73-iroasztalos-sarok.webp` | Vízszintes osztó – natúr fa | B |
| 26 | 20 | `ref-51-sarga-fal-natur-fekete.webp` | Átló – mézbarna |  |
| 27 | 29 | `ref-55-halvanyzold-nyilhegy.webp` | Átló – világoszöld | E |
| 28 | 55 | `ref-25-elfas-furdo.webp` | Egy darab fa – natúr |  |
| 29 | 78 | `ref-36-kulteri-fa.webp` | Átló, kétszárnyú – mézbarna |  |
| 30 | 47 | `ref-63-feher-kazettas-kanape.webp` | Kazettás – fehér |  |
| 31 | 18 | `ref-49-sotet-voros-deszkas.webp` | Sima – sötétbarna | C |
| 32 | 51 | `ref-23-templomos-minta.webp` | Fotónyomatos (Szeged) – fekete |  |
| 33 | 12 | `ref-06-konyha-fa-ajto.webp` | Átló – natúr fa |  |
| 34 | 6 | `ref-44-uveges-sarok-fotel.webp` | Üveges – fehér | A |
| 35 | 32 | `ref-15-feher-x-ketszarnyu.webp` | Felső X, kétszárnyú – natúr fa |  |
| 36 | 27 | `ref-54-feher-x-nyilhegy.webp` | Átló – fehér |  |
| 37 | 11 | `ref-46-fenyo-z-sotet-fal.webp` | Átló – natúr fa | D |
| 38 | 65 | `ref-86-gorgo-szurke-fem.webp` | Görgő közelről – acél |  |
| 39 | 50 | `ref-64-feher-deszkas-furdo.webp` | Átló – fehér |  |
| 40 | 35 | `ref-16-uveges-nappali.webp` | Üveges – natúr fa |  |
| 41 | 21 | `ref-10-feher-x-ajto.webp` | Felső X – fehér |  |
| 42 | 28 | `ref-13-kek-gardrob.webp` | Átló – kék | G |
| 43 | 76 | `ref-34-sarga-folyoso.webp` | Vízszintes osztó, kétszárnyú – sárga |  |
| 44 | 71 | `ref-32-sotetbarna-ketszarnyu.webp` | Kazettás kétszárnyú – sötétbarna |  |
| 45 | 8 | `ref-45-fenyo-marvanypadlo.webp` | Vízszintes osztó – natúr fa | C |
| 46 | 40 | `ref-60-feher-fekete-lepcso.webp` | Krétatáblás – fehér-fekete |  |
| 47 | 15 | `ref-48-fenyo-ketszarnyu-fa-mennyezet.webp` | Felső X, kétszárnyú – natúr fa |  |
| 48 | 49 | `ref-84-lyukmintas-vilagito.webp` | Sín lyukmintás ajtón – szürke |  |
| 49 | 34 | `ref-57-szurkesbarna-z-konyha.webp` | Felső X – szürkésbarna | H |
| 50 | 2 | `ref-41-natur-teglafal-fenyfuzer.webp` | Sima – natúr fa | A |
| 51 | 45 | `ref-62-feher-deszkas.webp` | Vízszintes osztó – fehér |  |
| 52 | 60 | `ref-27-kazettas-felujitott.webp` | Antik kazettás – natúr fa |  |
| 53 | 25 | `ref-88-gorgo-akaszto-turkiz.webp` | Görgő közelről – türkiz ajtón | F |
| 54 | 22 | `ref-52-feher-matt-uveg-kopott.webp` | Üveges – fehér |  |
| 55 | 61 | `ref-70-natur-furdo-bejarat.webp` | Átló – natúr fa | E |
| 56 | 80 | `ref-40-kreta-szerelem.webp` | Krétatábla – fekete |  |
| 57 | 33 | `ref-85-rez-ajtolap-logos.webp` | Görgő logóval – acél |  |
| 58 | 59 | `ref-69-feher-kazettas-gorgo.webp` | Sima – fehér |  |
| 59 | 53 | `ref-24-elfas-halo.webp` | Egy darab fa – natúr |  |
| 60 | 70 | `ref-74-regi-kazettas-rombusz.webp` | Antik kazettás – sötétbarna |  |
| 61 | 24 | `ref-53-feher-matt-uveg-parketta.webp` | Üveges – fehér |  |
| 62 | 75 | `ref-82-hid-minta-biciklis.webp` | Fotónyomatos (híd) – kék |  |
| 63 | 52 | `ref-65-tukros-furdo.webp` | Tükrös – fehér |  |
| 64 | 67 | `ref-30-etterem-kek.webp` | Átló – kék |  |
| 65 | 57 | `ref-39-sinrendszer-reszlet.webp` | Kültéri sín – fekete |  |
| 66 | 4 | `ref-42-uveges-par-teglafal.webp` | Üveges kétszárnyú – fehér | A |
| 67 | 46 | `ref-21-fekete-negyosztasu.webp` | Üveges – fekete |  |
| 68 | 69 | `ref-31-leces-zold-fal.webp` | Lécezett – sötét fa |  |
| 69 | 43 | `ref-61-feher-kazettas-folyoso.webp` | Kazettás – fehér |  |
| 70 | 74 | `ref-33-sarga-uveges-ketszarnyu.webp` | Üveges kétszárnyú – sárga |  |
| 71 | 73 | `ref-90-logos-sinveg-szott-fal.webp` | Sínvég logóval – fekete | B |
| 72 | 77 | `ref-35-lezervagott-feher.webp` | Lézervágott minta – fehér |  |
| 73 | 17 | `ref-89-rozsdas-ipari.webp` | Görgő közelről – rozsdás |  |
| 74 | 64 | `ref-29-femburkolatu.webp` | Fém – acél |  |
| 75 | 39 | `ref-18-rombuszos-uveges.webp` | Üveges kétszárnyú – natúr és fekete |  |
| 76 | 48 | `ref-22-fenykepes-nappali.webp` | Fotónyomatos – fehér |  |
| 77 | 13 | `ref-47-feher-z-parketta.webp` | Átló – fehér |  |
| 78 | 63 | `ref-71-natur-deszkas-mosdo.webp` | Sima – natúr fa |  |
| 79 | 38 | `ref-59-feher-fekete-ketszarnyu.webp` | Krétatáblás kétszárnyú – fehér-fekete |  |
| 80 | 36 | `ref-58-eloszoba-etkezo.webp` | Sima – natúr fa |  |
