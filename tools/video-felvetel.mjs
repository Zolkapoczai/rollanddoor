// A /technologia animációjából MP4-videó (1:1 és 9:16) a közösségi oldalakra.
// Nem része az oldalnak, és nem kell hozzá npm-csomag: a gépen lévő Chrome-ot vezérli a DevTools-protokollon,
// képkockánként lépteti a CSS-animációkat (determinisztikus, nem valós idejű felvétel), és ffmpeg-gel kódol.
//
// Előfeltétel: fut a helyi szerver (rollndoor-dev, port 8787), telepítve a Chrome és az ffmpeg.
// Futtatás:  node tools/video-felvetel.mjs [--url http://localhost:8787] [--fps 30] [--kepek 2,6.8,19.9]
// Kimenet:   public/video/dupla-sin-1x1.mp4 és -9x16.mp4 + poszterkép (.jpg); ezeket a főoldal mutatja (#technologia).
//            A --kepek állóképei a tools/kimenet/ alá kerülnek (a git nem követi).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const BASE = arg("--url", "http://localhost:8787").replace(/\/+$/, "");
const FPS = Number(arg("--fps", "30"));
const KEPEK = arg("--kepek", "") ? arg("--kepek").split(",").map(Number) : null;
const HOSSZ = 20; // mp, a technologia.css idővonalával egyezik
const PORT = 9333;
const ITT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ITT, "kimenet");
const VIDEO = join(ITT, "..", "public", "video");
const POSZTER_MP = 13; // a teljes metszet látszik

const FORMATUMOK = [
  { nev: "dupla-sin-1x1", w: 1080, h: 1080, cap: 40, svgMax: "calc(100vh - 190px)" },
  { nev: "dupla-sin-9x16", w: 1080, h: 1920, cap: 52, svgMax: "calc(100vh - 420px)" },
];

const CHROME = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].find((p) => p && existsSync(p));
if (!CHROME) throw new Error("Nem találom a Chrome-ot. Add meg: CHROME_PATH=...");

// A felvételhez csak az animáció látszik, középre igazítva, nagy felirattal.
const felveteliCss = (f) => `
  html, body { background: #121212 !important; overflow: hidden !important; }
  nav, .tech-head, .tech-walls, footer, .tech-replay { display: none !important; }
  .tech { padding: 0 !important; max-width: none !important; height: 100vh; display: flex; align-items: center; justify-content: center; }
  .tech-anim { margin: 0 !important; border: 0 !important; background: transparent !important; padding: 24px !important; width: 100%; }
  /* A rajz arányát (600×520) tartva a szélességhez és a felirat melletti magassághoz is igazodik. */
  .tech-svg { max-width: none !important; width: min(100%, calc((${f.svgMax.slice(5, -1)}) * 600 / 520)) !important; height: auto !important; margin: 0 auto; }
  .tech-anim.ready .tech-caps { max-width: 92% !important; min-height: 3.2em; margin-top: 24px !important; }
  .cap { font-size: ${f.cap}px !important; }
`;

async function vartCdp() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("A Chrome nem indult el.");
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const vart = new Map();
  const esemenyek = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && vart.has(d.id)) {
      const { ok, hiba } = vart.get(d.id);
      vart.delete(d.id);
      d.error ? hiba(new Error(d.error.message)) : ok(d.result);
    } else if (d.method && esemenyek.has(d.method)) {
      esemenyek.get(d.method)(d.params);
      esemenyek.delete(d.method);
    }
  };
  return {
    nyitva: new Promise((r) => (ws.onopen = r)),
    kuld: (method, params = {}) =>
      new Promise((ok, hiba) => {
        vart.set(++id, { ok, hiba });
        ws.send(JSON.stringify({ id, method, params }));
      }),
    egyszer: (method) => new Promise((r) => esemenyek.set(method, r)),
    zar: () => ws.close(),
  };
}

async function eval_(c, expr) {
  const r = await c.kuld("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error("Oldalhiba: " + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
  return r.result.value;
}

async function felvesz(c, f) {
  await c.kuld("Emulation.setDeviceMetricsOverride", { width: f.w, height: f.h, deviceScaleFactor: 1, mobile: false });
  const betoltve = c.egyszer("Page.loadEventFired");
  await c.kuld("Page.navigate", { url: `${BASE}/technologia.html?felvetel=1` });
  await betoltve;
  await eval_(c, "document.fonts.ready.then(() => true)");
  await eval_(c, `(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(felveteliCss(f))}; document.head.appendChild(s); return true; })()`);
  const db = await eval_(c, "document.getElementById('anim').classList.contains('play') ? document.getAnimations().length : -1");
  if (db <= 0) throw new Error("Az animáció nem indult el (?felvetel=1). Fut a helyi szerver a friss fájlokkal?");

  mkdirSync(OUT, { recursive: true });
  const ugras = (t) => eval_(c, `(() => { document.getAnimations().forEach(a => { a.pause(); a.currentTime = ${t * 1000}; }); return true; })()`);

  // --kepek 2,6.8,19.9 : videó helyett csak ezekről az időpontokról ment PNG-t (gyors ellenőrzéshez).
  if (KEPEK) {
    for (const t of KEPEK) {
      await ugras(t);
      const { data } = await c.kuld("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(OUT, `${f.nev}-${t}s.png`), Buffer.from(data, "base64"));
    }
    console.log(`${f.nev}: ${KEPEK.length} kép -> ${OUT}`);
    return;
  }

  mkdirSync(VIDEO, { recursive: true });
  const kimenet = join(VIDEO, `${f.nev}.mp4`);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow", "-movflags", "+faststart", kimenet], { stdio: ["pipe", "inherit", "inherit"] });
  const kesz = new Promise((ok, hiba) => ff.on("close", (k) => (k === 0 ? ok() : hiba(new Error(`ffmpeg kilépési kód: ${k}`)))));

  const kockak = HOSSZ * FPS;
  for (let i = 0; i <= kockak; i++) {
    await eval_(c, `(() => { const t = ${(i / FPS) * 1000}; document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }); return true; })()`);
    const { data } = await c.kuld("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    if (!ff.stdin.write(Buffer.from(data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % FPS === 0) process.stdout.write(`\r${f.nev}: ${i / FPS}/${HOSSZ} mp`);
  }
  ff.stdin.end();
  await kesz;
  // Poszterkép: ez látszik, amíg a videó betölt.
  await new Promise((ok, hiba) =>
    spawn("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(POSZTER_MP), "-i", kimenet, "-frames:v", "1", "-q:v", "4", join(VIDEO, `${f.nev}.jpg`)], { stdio: "inherit" })
      .on("close", (k) => (k === 0 ? ok() : hiba(new Error(`ffmpeg poszter: ${k}`)))),
  );
  process.stdout.write(`\r${f.nev}: kész -> ${kimenet} (+ .jpg)\n`);
}

const profil = mkdtempSync(join(tmpdir(), "rnd-felvetel-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profil}`, "--hide-scrollbars", "--mute-audio", "--no-first-run", "about:blank"], { stdio: "ignore" });
try {
  const c = cdp(await vartCdp());
  await c.nyitva;
  await c.kuld("Page.enable");
  for (const f of FORMATUMOK) await felvesz(c, f);
  c.zar();
} finally {
  chrome.kill();
  await new Promise((r) => setTimeout(r, 500));
  try { rmSync(profil, { recursive: true, force: true }); } catch {}
}
