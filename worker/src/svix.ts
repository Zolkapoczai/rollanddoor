// Resend webhook alairas-ellenorzes (Svix semleges formatum).
// Forras: resend.com/docs/webhooks/verify-webhooks-requests, docs.svix.com/receiving/verifying-payloads/how-manual
import { timingSafeEqual } from "./util";

const TOLERANCE_S = 5 * 60;

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** rawBody: a nyers, nem ujraszerializalt torzs. */
export async function verifyWebhook(rawBody: string, headers: Headers, secret: string | undefined): Promise<boolean> {
  if (!secret) return false;
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > TOLERANCE_S) return false;

  let keyBytes: Uint8Array;
  try {
    keyBytes = fromB64(secret.startsWith("whsec_") ? secret.slice(6) : secret);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${rawBody}`));
  let s = "";
  for (const b of new Uint8Array(mac)) s += String.fromCharCode(b);
  const expected = btoa(s);

  // "v1,<sig> v1,<sig2> ..." - barmelyik egyezes elfogadhato
  for (const part of sigHeader.split(" ")) {
    const [ver, sig] = part.split(",");
    if (ver === "v1" && sig && timingSafeEqual(sig, expected)) return true;
  }
  return false;
}
