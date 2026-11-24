three.js 0.187.0 (MIT, lásd LICENSE) – https://www.npmjs.com/package/three
A tervező 3D előnézete használja (public/elonezet3d.js), csak a „Nézd meg 3D-ben” doboz kinyitásakor töltődik be.
A three.bundle.min.js egyetlen fájl: a three.js mag + két kiegészítő (RoomEnvironment: környezeti fény és tükröződés,
OrbitControls: forgatás és nagyítás). Előállítás (egyszeri, nem a felület build lépése), a csomag mellé tett belépőfájlból:
  belepo.js:
    export * from './package/build/three.module.js';
    export { RoomEnvironment } from './package/examples/jsm/environments/RoomEnvironment.js';
    export { OrbitControls } from './package/examples/jsm/controls/OrbitControls.js';
  esbuild belepo.js --bundle --format=esm --minify --legal-comments=inline --alias:three=./package/build/three.module.js --outfile=public/vendor/three/three.bundle.min.js
