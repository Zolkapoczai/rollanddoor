three.js 0.187.0 (MIT, lásd LICENSE) – https://www.npmjs.com/package/three
A tervező 3D előnézete használja (public/elonezet3d.js), csak a „Nézd meg 3D-ben” doboz kinyitásakor töltődik be.
A three.bundle.min.js egyetlen fájl: a three.js mag + négy kiegészítő (RoomEnvironment: környezeti fény és tükröződés,
OrbitControls: forgatás és nagyítás, GLTFExporter: az AR-hoz az ajtó modellje GLB-be, RectAreaLightUniformsLib: területi fény).
Kb. 1,06 MB, tömörítve kb. 312 KB.
2026-11-25 óta nincs benne a three-gpu-pathtracer és a three-mesh-bvh (a „Fotóminőség” sugárkövetés kikerült);
korábbi változat a git-előzményben (5ca36f7).

Előállítás (egyszeri, nem a felület build lépése): `npm pack three@0.187.0`, kicsomagolva (package/), mellé ez a belépőfájl:
  belepo.js:
    export * from './package/build/three.module.js';
    export { RoomEnvironment } from './package/examples/jsm/environments/RoomEnvironment.js';
    export { OrbitControls } from './package/examples/jsm/controls/OrbitControls.js';
    export { GLTFExporter } from './package/examples/jsm/exporters/GLTFExporter.js';
    export { RectAreaLightUniformsLib } from './package/examples/jsm/lights/RectAreaLightUniformsLib.js';
  node <repo>/node_modules/esbuild/bin/esbuild belepo.js --bundle --format=esm --minify --legal-comments=inline --alias:three=./package/build/three.module.js --outfile=three.bundle.min.js
(az esbuild a wrangler függőségeként a repó node_modules mappájában van; a kimenetet másold a public/vendor/three/ alá)
