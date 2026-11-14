// Az EGYETLEN hely, ahol a levelszolgaltatoval (Resend) beszelunk.
import type { Env } from "./env";
import { oneLine } from "./util";

export interface MailAttachment {
  filename: string;
  /** base64 */
  content: string;
  contentType?: string;
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo: string;
  fromName: string;
  /** Felado cim; alapbol megegyezik a replyTo-val (rendeles-specifikus cim). */
  fromAddress?: string;
  attachments?: MailAttachment[];
}

export interface MailResult {
  ok: boolean;
  error?: string;
}

function displayName(name: string): string {
  return oneLine(name, 80).replace(/["<>\\]/g, "") || "Roll’n’Door";
}

export async function sendMail(env: Env, m: MailInput): Promise<MailResult> {
  if (!env.RESEND_API_KEY) {
    // Csak dry-runban (helyi fejlesztes) logoljuk a targyat es a cimzett szerepet; a valodi kuldesi uton nem.
    console.log(`[mail] dry-run -> ${m.to === env.RICSI_EMAIL ? "ricsi" : "ugyfel"}: ${oneLine(m.subject, 300)}`);
    return { ok: true };
  }
  // MAIL_TEST_FROM: csak próbaüzemben (a Resend megerősítetlen domainről nem enged küldeni); élesben üres.
  const from = `"${displayName(m.fromName)}" <${env.MAIL_TEST_FROM || (m.fromAddress ?? m.replyTo)}>`;
  const body: Record<string, unknown> = {
    from,
    to: [m.to],
    subject: oneLine(m.subject, 300),
    text: m.text,
    reply_to: m.replyTo,
  };
  if (m.html) body.html = m.html;
  if (m.attachments?.length) {
    body.attachments = m.attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      ...(a.contentType ? { content_type: a.contentType } : {}),
    }));
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // A Resend hibaüzenete (pl. "domain not verified") nem tartalmaz titkot; ez kell a hibakereséshez.
      const detail = oneLine(await res.text().catch(() => ""), 300);
      console.log(`[mail] resend hiba: HTTP ${res.status} ${detail}`);
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch {
    console.log("[mail] resend halozati hiba");
    return { ok: false, error: "halozati hiba" };
  }
}

// --- Beerkezett (inbound) levelek lekerese: szinten a szolgaltato API-ja, ezert itt el. ---

export interface ReceivedEmail {
  text: string;
  html: string;
  headers: Record<string, string>;
  authentication: { spf?: string; dkim?: string; dmarc?: string } | null;
}

export interface ReceivedAttachment {
  filename: string;
  contentType: string;
  size: number;
  bytes: Uint8Array;
}

function normHeaders(h: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(h)) {
    for (const e of h) {
      if (e && typeof e === "object" && "name" in e && "value" in e) {
        out[String((e as any).name).toLowerCase()] = String((e as any).value);
      }
    }
  } else if (h && typeof h === "object") {
    for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = String(v);
  }
  return out;
}

export async function fetchReceivedEmail(env: Env, emailId: string): Promise<ReceivedEmail | null> {
  if (!env.RESEND_API_KEY) return null;
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
  });
  if (!res.ok) {
    console.log(`[mail] bejovo lekeres hiba: HTTP ${res.status}`);
    return null;
  }
  const d = (await res.json()) as any;
  return {
    text: typeof d.text === "string" ? d.text : "",
    html: typeof d.html === "string" ? d.html : "",
    headers: normHeaders(d.headers),
    authentication: d.authentication && typeof d.authentication === "object" ? d.authentication : null,
  };
}

export async function fetchReceivedAttachments(env: Env, emailId: string): Promise<ReceivedAttachment[]> {
  if (!env.RESEND_API_KEY) return [];
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}/attachments?limit=20`,
    { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` } },
  );
  if (!res.ok) {
    console.log(`[mail] csatolmany-lista hiba: HTTP ${res.status}`);
    return [];
  }
  const list = ((await res.json()) as any).data;
  const out: ReceivedAttachment[] = [];
  for (const a of Array.isArray(list) ? list : []) {
    if (typeof a?.download_url !== "string") continue;
    // A download_url alairt, titkos URL: nem logoljuk.
    const f = await fetch(a.download_url);
    if (!f.ok) continue;
    const bytes = new Uint8Array(await f.arrayBuffer());
    out.push({
      filename: String(a.filename || "csatolmany"),
      contentType: String(a.content_type || "application/octet-stream"),
      size: bytes.length,
      bytes,
    });
  }
  return out;
}
