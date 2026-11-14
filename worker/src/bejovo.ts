// POST /api/bejovo-level - Resend inbound webhook ("email.received").
// Forras: resend.com/docs/dashboard/receiving/create-receiving-webhook, .../api-reference/emails/retrieve-received-email
//
// BIZTONSAG / KORLAT: a feladó cím (From) hamisítható. Ricsi leveleként csak akkor kezeljük az üzenetet,
// ha a fogadó szerver által kiállított `authentication.dmarc` értéke "pass" (a Resend ezt a lekért levélben adja,
// és a dokumentáció szerint a feladó nem hamisíthatja). Ha az `authentication` hiányzik (null/régi levél) vagy
// nem "pass", az üzenetet eldobjuk (200, nincs művelet) - SOSEM kezeljük Ricsiként. A webhook payload maga
// nem tartalmaz auth-eredményt, ezért a teljes levelet le kell kérni (RESEND_API_KEY szükséges).
import type { Env } from "./env";
import {
  fetchReceivedAttachments,
  fetchReceivedEmail,
  sendMail,
  type ReceivedEmail,
} from "./mail";
import { verifyWebhook } from "./svix";
import { bareAddress, esc, hiba, json, nowIso, oneLine, toBase64 } from "./util";

const ok = () => json({ ok: true });

function stripHtml(h: string): string {
  return h
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/p>|<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function isAutomatic(h: Record<string, string>): boolean {
  const auto = h["auto-submitted"];
  if (auto && auto.trim().toLowerCase() !== "no") return true;
  if (h["x-autoreply"] || h["x-autorespond"] || h["x-auto-response-suppress"]) return true;
  const prec = (h["precedence"] ?? "").toLowerCase();
  return ["bulk", "auto_reply", "junk", "list"].includes(prec);
}

function parseTarget(env: Env, recipients: string[]): { id: number; key: string } | null {
  const domain = env.REPLY_DOMAIN.toLowerCase();
  for (const r of recipients) {
    const m = /^rendeles-(\d+)-([a-z0-9]{10})@(.+)$/.exec(bareAddress(r));
    if (m && m[3] === domain) return { id: Number(m[1]), key: m[2] };
  }
  return null;
}

export async function handleBejovo(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== "POST") return hiba("Nem engedélyezett módszer.", 405);
  const raw = await request.text();
  if (!(await verifyWebhook(raw, request.headers, env.RESEND_WEBHOOK_SECRET))) {
    return hiba("Érvénytelen aláírás.", 401);
  }

  let evt: any;
  try {
    evt = JSON.parse(raw);
  } catch {
    return hiba("Érvénytelen kérés.");
  }
  if (evt?.type !== "email.received" || !evt.data?.email_id) return ok();

  const d = evt.data;
  const recipients: string[] = [...(d.to ?? []), ...(d.cc ?? []), ...(d.received_for ?? [])].map(String);
  const target = parseTarget(env, recipients);
  if (!target) return ok(); // ismeretlen cimzett: nincs bounce

  const order = await env.DB.prepare(
    `SELECT id, nev, email, valasz_kulcs FROM megrendeles WHERE id = ? AND valasz_kulcs = ?`,
  )
    .bind(target.id, target.key)
    .first<{ id: number; nev: string; email: string; valasz_kulcs: string }>();
  if (!order) return ok();

  const addr = `rendeles-${order.id}-${order.valasz_kulcs}@${env.REPLY_DOMAIN}`.toLowerCase();
  const sender = bareAddress(String(d.from ?? ""));
  if (!sender || sender === addr || sender.endsWith(`@${env.REPLY_DOMAIN.toLowerCase()}`)) return ok(); // hurokvedelem

  // A feldolgozas (levelletoltes, csatolmany-masolas) a valasz utan fut: a webhook gyors 200-at kap.
  ctx.waitUntil(
    processInbound(env, d, order, addr, sender).catch(() => console.log("[bejovo] feldolgozasi hiba")),
  );
  return ok();
}

async function processInbound(
  env: Env,
  d: any,
  order: { id: number; nev: string; email: string },
  addr: string,
  sender: string,
): Promise<void> {
  const mail: ReceivedEmail | null = await fetchReceivedEmail(env, String(d.email_id));
  if (!mail) {
    await note(env, order.id, "bejövő levél lekérése nem sikerült");
    return;
  }
  if (isAutomatic(mail.headers)) return;

  const fromRicsi = sender === env.RICSI_EMAIL.trim().toLowerCase();
  if (fromRicsi && mail.authentication?.dmarc !== "pass") {
    console.log("[bejovo] Ricsi cimu felado, de DMARC nem pass: eldobva");
    await note(env, order.id, "Ricsi címéről érkezett levél hitelesítés (DMARC) nélkül - eldobva");
    // Ne vesszen el csendben: Ricsi tudja meg, hogy a válasza NEM ment ki az ügyfélnek.
    await sendMail(env, {
      to: env.RICSI_EMAIL,
      subject: `NEM MENT KI: válasz a(z) #${order.id} megrendelésre`,
      text:
        `A(z) #${order.id} megrendelésre (${order.nev}) küldött válaszod NEM jutott el az ügyfélhez, ` +
        `mert a levél hitelesítése (DMARC) nem volt rendben.\n\n` +
        `Addig is írj közvetlenül az ügyfélnek: ${order.email}\n\n` +
        `Teendő (fejlesztőnek): a rollndoor.hu domainen legyen DMARC bejegyzés, lásd worker/README.md.`,
      replyTo: addr,
      fromName: "Roll’n’Door rendszer",
    });
    return;
  }

  const subject = oneLine(String(d.subject ?? "(nincs tárgy)"), 300);
  const body = mail.text || stripHtml(mail.html);
  const now = nowIso();

  // Idempotencia: ugyanaz az email_id nem dolgozodik fel ketszer (webhook ujraprobalas).
  const um = await env.DB.prepare(
    `INSERT OR IGNORE INTO uzenet (megrendeles_id, irany, targy, szoveg, ido, kulso_id) VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(order.id, fromRicsi ? "ki" : "be", subject, body.slice(0, 50000), now, String(d.email_id))
    .run();
  if (!um.meta.changes) return;
  const uzenetId = Number(um.meta.last_row_id);

  const atts = await fetchReceivedAttachments(env, String(d.email_id));
  for (const [i, a] of atts.entries()) {
    const safe = a.filename.replace(/[^\w.\-]+/g, "_").slice(0, 100) || `csatolmany-${i + 1}`;
    const r2 = `megrendeles/${order.id}/${crypto.randomUUID()}-${safe}`;
    await env.FILES.put(r2, a.bytes, { httpMetadata: { contentType: a.contentType } });
    await env.DB.prepare(
      `INSERT INTO fajl (megrendeles_id, uzenet_id, tipus, r2_kulcs, fajlnev, mime, meret, ido) VALUES (?, ?, 'csatolmany', ?, ?, ?, ?, ?)`,
    )
      .bind(order.id, uzenetId, r2, a.filename, a.contentType, a.size, now)
      .run();
  }

  const res = await sendMail(env, {
    to: fromRicsi ? order.email : env.RICSI_EMAIL,
    subject,
    text: body,
    html: `<div style="white-space:pre-wrap">${esc(body)}</div>`,
    replyTo: addr,
    fromName: fromRicsi ? "Roll’n’Door" : order.nev,
    attachments: atts.map((a) => ({ filename: a.filename, contentType: a.contentType, content: toBase64(a.bytes) })),
  });
  if (!res.ok) {
    await note(env, order.id, `levél továbbítása nem sikerült (${res.error})`);
    // Ricsi válasza nem ment ki: szóljunk neki (az ügyfél levelénél nincs kinek szólni, ha a küldés áll).
    if (fromRicsi) {
      await sendMail(env, {
        to: env.RICSI_EMAIL,
        subject: `NEM MENT KI: válasz a(z) #${order.id} megrendelésre`,
        text: `A válaszod továbbítása nem sikerült. Írj közvetlenül az ügyfélnek: ${order.email}`,
        replyTo: addr,
        fromName: "Roll’n’Door rendszer",
      });
    }
  }
}

async function note(env: Env, id: number, text: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO uzenet (megrendeles_id, irany, targy, szoveg, ido) VALUES (?, 'rendszer', 'Hiba', ?, ?)`,
  )
    .bind(id, text, nowIso())
    .run();
}
