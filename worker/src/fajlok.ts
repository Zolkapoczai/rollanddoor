// Fajlkezeles: felismeres (magic byte), R2 mentes, biztonsagos kiszolgalas.
import type { Env } from "./env";
import { nowIso, withSecurity } from "./util";

export interface Kind {
  mime: string;
  ext: string;
}

/** Magic byte alapu felismeres: JPG, PNG, WebP, GIF, HEIC, PDF. */
export function sniffFile(b: Uint8Array): Kind | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { mime: "image/gif", ext: "gif" };
  const s = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (s(4, 4) === "ftyp" && /^(heic|heix|mif1|msf1|hevc)/.test(s(8, 4))) return { mime: "image/heic", ext: "heic" };
  if (s(0, 4) === "%PDF") return { mime: "application/pdf", ext: "pdf" };
  return null;
}

export async function sniffBlob(f: Blob): Promise<Kind | null> {
  return sniffFile(new Uint8Array(await f.slice(0, 16).arrayBuffer()));
}

/** Utvonal es vezerlokarakterek nelkuli, rovid fajlnev. */
export function safeName(name: string, fallback: string): string {
  const last = name.split(/[\\/]/).pop() ?? "";
  const clean = last.replace(/[\u0000-\u001f\u007f"<>:*?|]+/g, "_").trim().slice(0, 100);
  return clean && clean !== "." && clean !== ".." ? clean : fallback;
}

export function isFile(v: unknown): v is File {
  return typeof v !== "string" && v !== null && typeof v === "object" && "size" in v && "slice" in v;
}

/** R2-be ment + fajl sor. Visszaadja a fajl id-t. */
export async function mentFajl(
  env: Env,
  megrendelesId: number,
  tipus: "nyilas" | "latvanyterv" | "kesz" | "csatolmany",
  fajlnev: string,
  mime: string,
  body: Blob,
  uzenetId: number | null,
): Promise<number> {
  const r2 = `megrendeles/${megrendelesId}/${crypto.randomUUID()}-${fajlnev.replace(/[^\w.\-]+/g, "_").slice(0, 80)}`;
  await env.FILES.put(r2, body, { httpMetadata: { contentType: mime } });
  try {
    const r = await env.DB.prepare(
      `INSERT INTO fajl (megrendeles_id, uzenet_id, tipus, r2_kulcs, fajlnev, mime, meret, ido) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(megrendelesId, uzenetId, tipus, r2, fajlnev, mime, body.size, nowIso())
      .run();
    return Number(r.meta.last_row_id);
  } catch (e) {
    await env.FILES.delete(r2).catch(() => {});
    throw e;
  }
}

// Csak ezeket szolgaljuk ki "inline"-kent a megadott tipussal: minden mas (pl. bejovo level csatolmanya:
// text/html, svg) letoltesre kenyszeritett octet-stream, hogy ne futhasson kod a mi eredetunkben.
const INLINE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

export interface FajlSor {
  r2_kulcs: string;
  fajlnev: string;
  mime: string | null;
}

export async function streamFajl(env: Env, f: FajlSor): Promise<Response | null> {
  const obj = await env.FILES.get(f.r2_kulcs);
  if (!obj) return null;
  const mime = (f.mime ?? "").toLowerCase();
  const inline = INLINE_MIME.has(mime);
  const ascii = f.fajlnev.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const dispo = `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.fajlnev)}`;
  const res = withSecurity(new Response(obj.body, { headers: { "Content-Type": inline ? mime : "application/octet-stream" } }));
  res.headers.set("Content-Disposition", dispo);
  res.headers.set("Content-Length", String(obj.size));
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("X-Content-Type-Options", "nosniff");
  if (mime === "application/pdf" && inline) res.headers.delete("Content-Security-Policy"); // a bongeszo PDF-nezoje igy mukodik
  return res;
}
