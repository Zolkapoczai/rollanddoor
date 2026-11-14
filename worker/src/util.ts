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
