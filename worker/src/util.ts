import type { Env } from "./env";

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

const ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789";
export function randomKey(len = 10): string {
  const out: string[] = [];
  // 256 % 36 != 0, ezert 252 alatti bajtokat fogadunk el (nincs modulo-torzitas).
  while (out.length < len) {
    for (const b of crypto.getRandomValues(new Uint8Array(len * 2))) {
      if (b < 252 && out.length < len) out.push(ALNUM[b % 36]);
    }
  }
  return out.join("");
}

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function replyAddress(env: Env, id: number, key: string): string {
  return `rendeles-${id}-${key}@${env.REPLY_DOMAIN}`;
}

/** "Nev <a@b.hu>" vagy "a@b.hu" -> "a@b.hu" kisbetuvel. */
export function bareAddress(s: string): string {
  const m = /<([^<>]+)>/.exec(s);
  return (m ? m[1] : s).trim().toLowerCase();
}

export function oneLine(s: string, max = 200): string {
  return s.replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(s);
}

export function timingSafeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

const SEC_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000",
};

export function withSecurity(res: Response): Response {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(SEC_HEADERS)) r.headers.set(k, v);
  return r;
}

export function json(body: unknown, status = 200): Response {
  return withSecurity(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }),
  );
}

export function hiba(msg: string, status = 400): Response {
  return json({ ok: false, hiba: msg }, status);
}

// --- 2. kor: kozos segedek ---

export const MAX_FORM_BODY = 25 * 1024 * 1024;
const MAX_JSON_BODY = 64 * 1024;

export type Parsed<T> = { ok: true; value: T } | { ok: false; res: Response };

/** JSON torzs, max 64 KB; ismeretlen mezoket a hivo egyszeruen nem olvassa. */
export async function readJson(request: Request): Promise<Parsed<Record<string, unknown>>> {
  const ct = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.startsWith("application/json")) return { ok: false, res: hiba("Érvénytelen kérés.", 415) };
  const len = Number(request.headers.get("content-length"));
  if (Number.isFinite(len) && len > MAX_JSON_BODY) return { ok: false, res: hiba("A kérés túl nagy.", 413) };
  try {
    const text = await request.text();
    if (text.length > MAX_JSON_BODY) return { ok: false, res: hiba("A kérés túl nagy.", 413) };
    const v = JSON.parse(text);
    if (!v || typeof v !== "object" || Array.isArray(v)) return { ok: false, res: hiba("Érvénytelen kérés.") };
    return { ok: true, value: v as Record<string, unknown> };
  } catch {
    return { ok: false, res: hiba("Érvénytelen kérés.") };
  }
}

/** multipart torzs; Content-Length kotelezo es <= ~25 MB. */
export async function readForm(request: Request): Promise<Parsed<FormData>> {
  const ct = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.startsWith("multipart/form-data")) return { ok: false, res: hiba("Érvénytelen kérés.", 415) };
  const len = Number(request.headers.get("content-length"));
  if (!Number.isFinite(len) || len <= 0) return { ok: false, res: hiba("Hiányzik a kérés mérete.", 411) };
  if (len > MAX_FORM_BODY) return { ok: false, res: hiba("A feltöltött anyag túl nagy (legfeljebb ~25 MB).", 413) };
  try {
    return { ok: true, value: await request.formData() };
  } catch {
    return { ok: false, res: hiba("Érvénytelen kérés.") };
  }
}

export function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > max ? null : t;
}

/** 480000 -> "480 000 Ft" */
export function formatFt(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " Ft";
}

const HONAPOK = ["január", "február", "március", "április", "május", "június", "július", "augusztus", "szeptember", "október", "november", "december"];

/** "2026-12-05" -> "2026. december 5." */
export function formatDatum(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[1]}. ${HONAPOK[Number(m[2]) - 1]} ${Number(m[3])}.`;
}

/** A megadott pillanat naptari napja Europe/Budapest szerint, "YYYY-MM-DD". */
export function budapestNap(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "YYYY-MM-DD" + n nap. */
export function napHozzaad(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Valodi naptari datum-e ("2026-02-31" nem). */
export function ervenyesNap(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return napHozzaad(iso, 0) === iso;
}

export function napokTelt(tolIso: string | null, now: Date): number {
  if (!tolIso) return 0;
  const t = Date.parse(tolIso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86400000));
}
