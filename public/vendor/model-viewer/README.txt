@google/model-viewer 4.4.0 (Apache-2.0, lásd LICENSE) – https://github.com/google/model-viewer
A tervező 3D előnézetének AR-gombja használja („Nézd meg a szobádban”). Csak a gomb megnyomásakor töltődik be.
Fájl: a csomag dist/model-viewer.min.js-e változatlanul (a saját three.js-ét magában hordozza).
AR-viselkedés a csomag forrása (lib/features/ar.js) alapján: Androidon WebXR; a Scene Viewer böngészőben
készült (blob:) modellt nem tud megnyitni, ezért azt nem használjuk; iPhone-on Quick Look, a USDZ-t
a model-viewer maga készíti, ha nincs ios-src; ar-placement="wall" falra helyez.
