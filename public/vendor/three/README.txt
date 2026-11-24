three.js 0.187.0 (MIT, lásd LICENSE) – https://www.npmjs.com/package/three
A tervező 3D előnézete használja (public/elonezet3d.js), csak a „Nézd meg 3D-ben” doboz kinyitásakor töltődik be.
A three.bundle.min.js egyetlen fájl: a three.js mag + három kiegészítő (RoomEnvironment: környezeti fény és tükröződés,
OrbitControls: forgatás és nagyítás, GLTFExporter: az AR-hoz az ajtó modellje GLB-be, RectAreaLightUniformsLib: területi fény),
valamint a three-gpu-pathtracer 0.0.28 (MIT, LICENSE-three-gpu-pathtracer; WebGLPathTracer, DenoiseMaterial, GradientEquirectTexture)
és a three-mesh-bvh 0.10.0 (MIT, LICENSE-three-mesh-bvh): ezek adják a fotórealisztikus (sugárkövetéses) képet. Előállítás (egyszeri, nem a felület build lépése), a csomag mellé tett belépőfájlból:
  belepo.js:
    export * from './package/build/three.module.js';
    export { RoomEnvironment } from './package/examples/jsm/environments/RoomEnvironment.js';
    export { OrbitControls } from './package/examples/jsm/controls/OrbitControls.js';
    export { GLTFExporter } from './package/examples/jsm/exporters/GLTFExporter.js';
    export { RectAreaLightUniformsLib } from './package/examples/jsm/lights/RectAreaLightUniformsLib.js';
    export { WebGLPathTracer, DenoiseMaterial, GradientEquirectTexture } from '../pt-pkg/pt/package/build/index.module.js';
  esbuild belepo.js --bundle --format=esm --minify --legal-comments=inline --alias:three=./package/build/three.module.js --alias:three-mesh-bvh=<three-mesh-bvh>/build/index.module.js --alias:three/examples/jsm/postprocessing/Pass.js=./package/examples/jsm/postprocessing/Pass.js --outfile=public/vendor/three/three.bundle.min.js
