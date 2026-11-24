three.js 0.187.0 (MIT, lásd LICENSE) – https://www.npmjs.com/package/three
A tervező 3D előnézete használja (public/elonezet3d.js), csak a „Nézd meg 3D-ben” doboz kinyitásakor töltődik be.
Előállítás (egyszeri, nem a felület build lépése): a csomag build/three.module.js fájlja (a three.core.js-sel együtt)
esbuild-del egy fájlba csomagolva és tömörítve:
  esbuild package/build/three.module.js --bundle --format=esm --minify --legal-comments=inline --outfile=public/vendor/three/three.module.min.js
