import type { Env } from "./env";
import { kuldUgyfelnek, lablec } from "./levelek";
import { sendMail, type MailAttachment } from "./mail";
import { verifyTurnstile } from "./turnstile";
import { esc, hiba, json, nowIso, oneLine, randomKey, randomToken, replyAddress, toBase64 } from "./util";

const MAX_BODY = 20 * 1024 * 1024;
const MAX_PHOTO = 8 * 1024 * 1024;
const MAX_JSON = 20 * 1024;
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

/** Magic byte alapu kepfelismeres. */
function sniffImage(b: Uint8Array): { mime: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { mime: "image/gif", ext: "gif" };
  const s = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (s(4, 4) === "ftyp" && /^(heic|heix|mif1|msf1|hevc)/.test(s(8, 4))) return { mime: "image/heic", ext: "heic" };
  return null;
}

function flatten(v: unknown, prefix: string, out: string[], depth = 0): void {
  if (v === null || v === undefined || v === "") return;
  if (depth > 6) {
    out.push(`${prefix}: ${JSON.stringify(v)}`);
    return;
  }
  if (Array.isArray(v)) {
    v.forEach((x, i) => flatten(x, `${prefix}[${i + 1}]`, out, depth + 1));
  } else if (typeof v === "object") {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      flatten(x, prefix ? `${prefix} / ${k}` : k, out, depth + 1);
    }
  } else {
    out.push(`${prefix}: ${String(v)}`);
  }
}

const MAX_SUM_ROWS = 40;
const MAX_SUM_LABEL = 60;
const MAX_SUM_VALUE = 600;

/** A tervezo "osszegzes" tombjebol {cimke, ertek} parok; minden mast ("nem {cimke, ertek} string-par") eldob. */
export function summaryPairs(v: unknown): { cimke: string; ertek: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { cimke: string; ertek: string }[] = [];
  for (const r of v) {
    if (out.length >= MAX_SUM_ROWS) break;
    if (!r || typeof r !== "object") continue;
    const { cimke, ertek } = r as Record<string, unknown>;
    if (typeof cimke !== "string" || typeof ertek !== "string") continue;
    const c = oneLine(cimke, MAX_SUM_LABEL);
    const e = oneLine(ertek, MAX_SUM_VALUE);
    if (!c || !e) continue;
    out.push({ cimke: c, ertek: e });
  }
  return out;
}

function summaryLines(v: unknown): string[] {
  return summaryPairs(v).map((r) => `${r.cimke}: ${r.ertek}`);
}

/** Olvashato lapitas cimke-ertek parokba (ha nincs "osszegzes"). */
export function flattenPairs(v: unknown): { cimke: string; ertek: string }[] {
  const lines: string[] = [];
  flatten(v, "", lines);
  return lines.slice(0, MAX_SUM_ROWS).map((l) => {
    const i = l.indexOf(": ");
    return i < 0 ? { cimke: "Adat", ertek: oneLine(l, MAX_SUM_VALUE) } : { cimke: oneLine(l.slice(0, i), MAX_SUM_LABEL) || "Adat", ertek: oneLine(l.slice(i + 2), MAX_SUM_VALUE) };
  });
}

interface Parsed {
  forras: "urlap" | "tervezo";
  nev: string;
  email: string;
  telefon: string;
  uzenet: string;
  igenyJson: string | null;
  igenyLines: string[];
  fotok: File[];
  token: string;
}

async function parse(form: FormData): Promise<Parsed | string> {
  const get = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v.trim() : "";
  };
  const forras = get("forras");
  if (forras !== "urlap" && forras !== "tervezo") return "Érvénytelen kérés.";
  const nev = get("nev");
  if (!nev || nev.length > 120) return "Kérjük, adja meg a nevét.";
  const email = get("email");
  if (!EMAIL_RE.test(email) || email.length > 200) return "Kérjük, adjon meg érvényes e-mail-címet.";
  const telefon = get("telefon");
  if (telefon.length > 40) return "A telefonszám túl hosszú.";
  const uzenet = get("uzenet");
  if (uzenet.length > 5000) return "Az üzenet túl hosszú.";
  if (forras === "urlap" && !uzenet) return "Kérjük, írja le röviden, miben segíthetünk.";

  let igenyJson: string | null = null;
  const igenyLines: string[] = [];
  const raw = get("igeny_json");
  if (raw) {
    if (new TextEncoder().encode(raw).length > MAX_JSON) return "A megadott adatok túl nagyok.";
    try {
      const parsed = JSON.parse(raw);
      igenyJson = JSON.stringify(parsed);
      const rows = forras === "tervezo" && parsed && typeof parsed === "object" ? summaryLines((parsed as any).osszegzes) : [];
      if (rows.length) igenyLines.push(...rows);
      else flatten(parsed, "", igenyLines);
    } catch {
      return "A tervező adatai érvénytelenek.";
    }
  } else if (forras === "tervezo") {
    return "A tervező adatai hiányoznak.";
  }

  const fotok = form.getAll("fotok").filter((f): f is File => typeof f !== "string" && f.size > 0);
  if (fotok.length > 2) return "Legfeljebb 2 fotót tölthet fel.";
  for (const f of fotok) if (f.size > MAX_PHOTO) return "Egy fotó legfeljebb 8 MB lehet.";

  return { forras, nev, email, telefon, uzenet, igenyJson, igenyLines, fotok, token: get("cf-turnstile-response") };
}

// Sebességkorlát (D1-ből számolva, IP-t nem tárolunk). Valós forgalom: havi ~8 igény, ezért bőven laza.
// - Összesen: a Resend ingyenes levélkeretét és a D1-et védi a tömeges beküldéstől.
// - Egy e-mail címre: megakadályozza, hogy valaki mások címére záporoztassa a visszaigazolást.
const MAX_IGENY_ORANKENT = 15;
const MAX_IGENY_CIMENKENT_NAPONTA = 3;

async function szamol(env: Env, sql: string, ...binds: unknown[]): Promise<number> {
  const r = await env.DB.prepare(sql).bind(...binds).first<{ n: number }>();
  return r?.n ?? 0;
}

const tulSok = () => hiba("Most túl sok igény érkezett. Kérjük, próbáld újra később, vagy hívj minket telefonon.", 429);

export async function handleIgeny(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method !== "POST") return hiba("Nem engedélyezett módszer.", 405);
  const oraja = new Date(Date.now() - 3600_000).toISOString();
  if ((await szamol(env, "SELECT COUNT(*) AS n FROM megrendeles WHERE letrehozva > ?", oraja)) >= MAX_IGENY_ORANKENT) {
    return tulSok();
  }
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().startsWith("multipart/form-data")) return hiba("Érvénytelen kérés.", 415);
  const len = Number(request.headers.get("content-length"));
  if (!Number.isFinite(len) || len <= 0) return hiba("Hiányzik a kérés mérete.", 411);
  if (len > MAX_BODY) return hiba("A feltöltött anyag túl nagy (legfeljebb ~20 MB).", 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return hiba("Érvénytelen kérés.");
  }
  const p = await parse(form);
  if (typeof p === "string") return hiba(p);

  if (!(await verifyTurnstile(env, p.token, request.headers.get("CF-Connecting-IP")))) {
    return hiba("A robotvédelmi ellenőrzés nem sikerült, kérjük, próbálja újra.", 403);
  }

  const napja = new Date(Date.now() - 24 * 3600_000).toISOString();
  if (
    (await szamol(env, "SELECT COUNT(*) AS n FROM megrendeles WHERE lower(email) = ? AND letrehozva > ?", p.email.toLowerCase(), napja)) >=
    MAX_IGENY_CIMENKENT_NAPONTA
  ) {
    return tulSok();
  }

  // Fotok ellenorzese (magic byte), mielott barmit irnank.
  const photos: { file: File; mime: string; ext: string }[] = [];
  for (const f of p.fotok) {
    const head = new Uint8Array(await f.slice(0, 16).arrayBuffer());
    const kind = sniffImage(head);
    if (!kind) return hiba("Csak képfájl (JPG, PNG, WebP, GIF, HEIC) tölthető fel.");
    photos.push({ file: f, ...kind });
  }

  const now = nowIso();
  const key = randomKey(10);
  const ugyfelToken = randomToken();
  const ricsiToken = randomToken();
  const ins = await env.DB.prepare(
    `INSERT INTO megrendeles (ugyfel_token, ricsi_token, valasz_kulcs, nev, email, telefon, forras, uzenet, igeny_json, allomas, letrehozva, allomas_valtas_ideje)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  )
    .bind(ugyfelToken, ricsiToken, key, p.nev, p.email, p.telefon || null, p.forras, p.uzenet || null, p.igenyJson, now, now)
    .run();
  const id = Number(ins.meta.last_row_id);

  const subject = `Új igény #${id} – ${p.nev}`;
  const summary = buildSummary(p);
  const um = await env.DB.prepare(
    `INSERT INTO uzenet (megrendeles_id, irany, targy, szoveg, ido) VALUES (?, 'be', ?, ?, ?)`,
  )
    .bind(id, subject, summary, now)
    .run();
  const uzenetId = Number(um.meta.last_row_id);
  await env.DB.prepare(`INSERT INTO allomas_naplo (megrendeles_id, allomas, ido) VALUES (?, 1, ?)`).bind(id, now).run();

  // Fotok: R2-be (Blob = ismert hosszusagu stream), + csatolmanykent a levelhez.
  const attachments: MailAttachment[] = [];
  let storeFailed = false;
  for (const [i, ph] of photos.entries()) {
    const fajlnev = `foto-${i + 1}.${ph.ext}`;
    const r2 = `megrendeles/${id}/${crypto.randomUUID()}-${fajlnev}`;
    try {
      await env.FILES.put(r2, ph.file, { httpMetadata: { contentType: ph.mime } });
      await env.DB.prepare(
        `INSERT INTO fajl (megrendeles_id, uzenet_id, tipus, r2_kulcs, fajlnev, mime, meret, ido) VALUES (?, ?, 'csatolmany', ?, ?, ?, ?, ?)`,
      )
        .bind(id, uzenetId, r2, fajlnev, ph.mime, ph.file.size, now)
        .run();
    } catch {
      storeFailed = true;
    }
    attachments.push({
      filename: fajlnev,
      contentType: ph.mime,
      content: toBase64(new Uint8Array(await ph.file.arrayBuffer())),
    });
  }

  // Levelek a valasz utan, hogy a latogato ne varjon rajuk.
  ctx.waitUntil(sendNotifications(env, id, key, ugyfelToken, ricsiToken, p, subject, summary, attachments, storeFailed));
  return json({ ok: true });
}

function buildSummary(p: Parsed): string {
  const lines = [
    `Forrás: ${p.forras === "tervezo" ? "Tervező" : "Ajánlatkérő űrlap"}`,
    `Név: ${p.nev}`,
    `E-mail: ${p.email}`,
    `Telefon: ${p.telefon || "(nincs megadva)"}`,
    `Fotók száma: ${p.fotok.length}`,
  ];
  if (p.uzenet) lines.push("", "Üzenet:", p.uzenet);
  if (p.igenyLines.length) lines.push("", "Tervező adatai:", ...p.igenyLines.map((l) => `  ${l}`));
  return lines.join("\n");
}

function buildHtml(p: Parsed, id: number, kezelesLink: string): string {
  const row = (k: string, v: string) => `<tr><td style="padding:2px 12px 2px 0;color:#666">${esc(k)}</td><td>${esc(v)}</td></tr>`;
  const igeny = p.igenyLines.length
    ? `<h3>Tervező adatai</h3><ul>${p.igenyLines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`
    : "";
  return `<h2>Új igény #${id}</h2><table>${row("Forrás", p.forras === "tervezo" ? "Tervező" : "Ajánlatkérő űrlap")}${row("Név", p.nev)}${row("E-mail", p.email)}${row("Telefon", p.telefon || "(nincs megadva)")}${row("Fotók száma", String(p.fotok.length))}</table>${p.uzenet ? `<h3>Üzenet</h3><p style="white-space:pre-wrap">${esc(p.uzenet)}</p>` : ""}${igeny}<p><a href="${esc(kezelesLink)}" style="display:inline-block;padding:12px 20px;background:#d4a373;color:#1c1c1c;text-decoration:none;border-radius:8px;font-weight:bold">Megrendelés kezelése</a></p><p style="color:#666">A „Válasz” gomb az ügyfélnek megy, a rendszeren keresztül.</p>`;
}

async function sendNotifications(
  env: Env,
  id: number,
  key: string,
  ugyfelToken: string,
  ricsiToken: string,
  p: Parsed,
  subject: string,
  summary: string,
  attachments: MailAttachment[],
  storeFailed: boolean,
): Promise<void> {
  const addr = replyAddress(env, id, key);
  const problems: string[] = [];
  if (storeFailed) problems.push("fotó mentése R2-be nem sikerült");

  const kezelesLink = `${env.SITE_URL.replace(/\/+$/, "")}/m/${ricsiToken}`;
  const toRicsi = await sendMail(env, {
    to: env.RICSI_EMAIL,
    subject,
    text: `${summary}\n\nMegrendelés kezelése: ${kezelesLink}`,
    html: buildHtml(p, id, kezelesLink),
    replyTo: addr,
    fromName: p.nev,
    attachments,
  });
  if (!toRicsi.ok) problems.push(`értesítő levél Ricsinek nem ment ki (${toRicsi.error})`);

  const lab = lablec(env, { ugyfel_token: ugyfelToken });
  const confirm = [
    "Szia!",
    "",
    "Megkaptuk az igényed, köszönjük! Egy munkanapon belül keresünk.",
    "",
    "Amit küldtél:",
    p.uzenet ? `Üzenet: ${p.uzenet}` : "A tervezőben összeállított ajtó adatai.",
    ...(p.igenyLines.length ? p.igenyLines.map((l) => `  ${l}`) : []),
    `Fotók száma: ${p.fotok.length}`,
    "",
    "Ha kiegészítenéd valamivel, egyszerűen válaszolj erre a levélre.",
    "",
    "Üdv,",
    "Roll’n’Door",
    "",
    lab.text,
  ].join("\n");
  const confirmHtml = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.5;color:#222;max-width:560px"><p>Szia!</p><p>Megkaptuk az igényed, köszönjük! <strong>Egy munkanapon belül keresünk.</strong></p><p>Amit küldtél:</p><ul>${p.uzenet ? `<li>Üzenet: ${esc(p.uzenet)}</li>` : "<li>A tervezőben összeállított ajtó adatai</li>"}${p.igenyLines.map((l) => `<li>${esc(l)}</li>`).join("")}<li>Fotók száma: ${p.fotok.length}</li></ul><p>Ha kiegészítenéd valamivel, egyszerűen válaszolj erre a levélre.</p><p>Üdv,<br>Roll’n’Door</p>${lab.html}</div>`;
  const toCustomer = await kuldUgyfelnek(
    env,
    { id, email: p.email, valasz_kulcs: key, ricsi_token: ricsiToken },
    { subject: "Roll’n’Door – Megkaptuk az igényed", text: confirm, html: confirmHtml },
  );
  if (!toCustomer.ok) problems.push(`visszaigazoló levél az ügyfélnek nem ment ki (${toCustomer.error})`);

  if (problems.length) {
    try {
      await env.DB.prepare(
        `INSERT INTO uzenet (megrendeles_id, irany, targy, szoveg, ido) VALUES (?, 'rendszer', 'Hiba', ?, ?)`,
      )
        .bind(id, oneLine(problems.join("; "), 500), nowIso())
        .run();
    } catch {
      console.log("[igeny] rendszer-uzenet mentese sem sikerult");
    }
  }
}
