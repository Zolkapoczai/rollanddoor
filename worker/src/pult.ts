// Ricsi összesítő oldala: /pult (felület) és /api/pult/* (API).
// Belépés: Ricsi a RICSI_EMAIL címére kér egy 15 percig élő, egyszer használható belépőlinket.
// A link nem léptet be magától (a levelezők linkellenőrzője megnyithatja): az oldal egy gombbal POST-olja.
// Belépés után HttpOnly süti tartja a munkamenetet. A tokeneket csak SHA-256 hash-ként tároljuk.
import type { Env } from "./env";
import { ALLOMASOK } from "./allomasok";
import { sendMail } from "./mail";
import { esc, formatDatum, hiba, json, nowIso, randomToken, readJson } from "./util";

const SUTI = "__Host-pult";
const BELEPO_PERC = 15;
const MUNKAMENET_NAP = 60;
const MAX_BELEPO_ORANKENT = 5;
const LEZART_LIMIT = 30;
const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;

const nemEngedett = () => hiba("Nem engedélyezett módszer.", 405);

async function sha256(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

function sutiErtek(request: Request): string | null {
  const c = request.headers.get("Cookie") ?? "";
  for (const part of c.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === SUTI) return part.slice(i + 1).trim();
  }
  return null;
}

function sutiFejlec(ertek: string, maxAge: number): string {
  return `${SUTI}=${ertek}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}

async function munkamenetOk(request: Request, env: Env): Promise<boolean> {
  const t = sutiErtek(request);
  if (!t || !TOKEN_RE.test(t)) return false;
  const r = await env.DB.prepare(`SELECT 1 AS x FROM pult_munkamenet WHERE hash = ? AND lejar > ?`).bind(await sha256(t), nowIso()).first();
  return !!r;
}

export async function handlePult(request: Request, env: Env, _ctx: ExecutionContext, parts: string[]): Promise<Response> {
  // parts: ["pult", ...rest]
  const rest = parts.slice(1);
  const m = request.method;
  if (rest.length === 0) return m === "GET" ? lista(request, env) : nemEngedett();
  if (rest.length === 1) {
    if (m !== "POST") return nemEngedett();
    switch (rest[0]) {
      case "link":
        return linkKeres(env);
      case "be":
        return belep(request, env);
      case "ki":
        return kilep(request, env);
    }
  }
  return hiba("Nem található.", 404);
}

/** Belépőlink küldése. A válasz mindig ugyanaz, a cím fix (RICSI_EMAIL), kívülről nem adható meg. */
async function linkKeres(env: Env): Promise<Response> {
  const most = new Date();
  const oraja = new Date(most.getTime() - 3600_000).toISOString();
  const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM pult_belepo WHERE letrehozva > ?`).bind(oraja).first<{ n: number }>();
  if ((c?.n ?? 0) >= MAX_BELEPO_ORANKENT) {
    return hiba("Most túl sok belépőlinket kértél. Várj egy órát, vagy használd a legutóbbi levelet.", 429);
  }
  // Takarítás: lejárt belépők és munkamenetek.
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM pult_belepo WHERE lejar < ?`).bind(oraja),
    env.DB.prepare(`DELETE FROM pult_munkamenet WHERE lejar < ?`).bind(most.toISOString()),
  ]);

  const token = randomToken();
  const lejar = new Date(most.getTime() + BELEPO_PERC * 60_000).toISOString();
  await env.DB.prepare(`INSERT INTO pult_belepo (hash, letrehozva, lejar) VALUES (?, ?, ?)`).bind(await sha256(token), most.toISOString(), lejar).run();

  const link = `${env.SITE_URL.replace(/\/+$/, "")}/pult/be/${token}`;
  const szoveg = `Belépés a megrendelések összesítőjéhez:\n${link}\n\nA link ${BELEPO_PERC} percig érvényes, és csak egyszer használható. Ha nem te kérted, ne nyisd meg, és ne küldd tovább.`;
  const r = await sendMail(env, {
    to: env.RICSI_EMAIL,
    subject: "Roll’n’Door – belépőlink a megrendelésekhez",
    text: szoveg,
    html:
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.5;color:#222;max-width:560px">` +
      `<p>Belépés a megrendelések összesítőjéhez:</p>` +
      `<p style="margin:24px 0"><a href="${esc(link)}" style="display:inline-block;padding:14px 24px;background:#d4a373;color:#1c1c1c;text-decoration:none;border-radius:8px;font-weight:bold">Belépés</a></p>` +
      `<p style="color:#666">A link ${BELEPO_PERC} percig érvényes, és csak egyszer használható. Ha nem te kérted, ne nyisd meg, és ne küldd tovább.</p></div>`,
    replyTo: `belepes@${env.REPLY_DOMAIN}`,
    fromName: "Roll’n’Door",
  });
  if (!r.ok) return hiba("A levelet most nem sikerült elküldeni. Próbáld újra pár perc múlva.", 502);
  return json({ ok: true });
}

async function belep(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const t = body.value.token;
  const rossz = () => hiba("Ez a belépőlink lejárt vagy már felhasználták. Kérj újat.", 401);
  if (typeof t !== "string" || !TOKEN_RE.test(t)) return rossz();

  const most = nowIso();
  // Egyszer használható: csak az a kérés lép be, amelyik ténylegesen átállítja a felhasznalva mezőt.
  const r = await env.DB.prepare(`UPDATE pult_belepo SET felhasznalva = ? WHERE hash = ? AND felhasznalva IS NULL AND lejar > ?`)
    .bind(most, await sha256(t), most)
    .run();
  if (!r.meta.changes) return rossz();

  const munkamenet = randomToken();
  const lejar = new Date(Date.now() + MUNKAMENET_NAP * 86400_000).toISOString();
  await env.DB.prepare(`INSERT INTO pult_munkamenet (hash, letrehozva, lejar) VALUES (?, ?, ?)`).bind(await sha256(munkamenet), most, lejar).run();
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", sutiFejlec(munkamenet, MUNKAMENET_NAP * 86400));
  return res;
}

async function kilep(request: Request, env: Env): Promise<Response> {
  const t = sutiErtek(request);
  if (t && TOKEN_RE.test(t)) await env.DB.prepare(`DELETE FROM pult_munkamenet WHERE hash = ?`).bind(await sha256(t)).run();
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", sutiFejlec("", 0));
  return res;
}

// --- Összesítő lista ---

interface Sor {
  id: number;
  nev: string;
  telefon: string | null;
  allomas: number;
  statusz: "aktiv" | "lezarva" | "nem_erdeklodik";
  leiratkozott: number;
  latvanyterv_jovahagyva: string | null;
  varhato_beszereles: string | null;
  allomas_valtas_ideje: string | null;
  letrehozva: string;
  ricsi_token: string;
  utolso_be: string | null;
  utolso_be_szoveg: string | null;
  utolso_reakcio: string | null;
}

type Csoport = "ram_var" | "keszul" | "ugyfelre_var";

const SOR_SQL = `
SELECT m.id, m.nev, m.telefon, m.allomas, m.statusz, m.leiratkozott, m.latvanyterv_jovahagyva, m.varhato_beszereles,
       m.allomas_valtas_ideje, m.letrehozva, m.ricsi_token,
       (SELECT MAX(ido) FROM uzenet WHERE megrendeles_id = m.id AND irany = 'be') AS utolso_be,
       (SELECT szoveg FROM uzenet WHERE megrendeles_id = m.id AND irany = 'be' ORDER BY id DESC LIMIT 1) AS utolso_be_szoveg,
       (SELECT MAX(ido) FROM uzenet WHERE megrendeles_id = m.id AND irany IN ('ki', 'megjegyzes')) AS utolso_reakcio
FROM megrendeles m`;

/** Van-e olyan ügyfél-üzenet, amire Ricsi azóta nem reagált (válasz, megjegyzés vagy állomásváltás). */
function valaszraVar(s: Sor): boolean {
  if (!s.utolso_be) return false;
  const reakcio = [s.utolso_reakcio, s.allomas_valtas_ideje].filter((x): x is string => !!x).sort().pop();
  return !reakcio || s.utolso_be > reakcio;
}

function besorol(s: Sor): { csoport: Csoport; teendo: string } {
  // Az 1. állomáson az igény szövege maga is ügyfél-üzenet: ott mindig a hívás a teendő.
  if (s.allomas === 1) return { csoport: "ram_var", teendo: "Új igény: hívd fel" };
  if (valaszraVar(s)) {
    const sz = (s.utolso_be_szoveg ?? "").replace(/\s+/g, " ").trim();
    return { csoport: "ram_var", teendo: sz ? `Ügyfél: „${sz.length > 90 ? sz.slice(0, 89) + "…" : sz}”` : "Új üzenet az ügyféltől" };
  }
  switch (s.allomas) {
    case 2:
      return { csoport: "ram_var", teendo: "Ajánlatot kell küldeni" };
    case 3:
      return { csoport: "ugyfelre_var", teendo: "Az ajánlatra vár" };
    case 4:
      return { csoport: "ram_var", teendo: "Látványtervet kell feltölteni" };
    case 5:
      return s.latvanyterv_jovahagyva
        ? { csoport: "ram_var", teendo: "Jóváhagyta: indulhat a gyártás" }
        : { csoport: "ugyfelre_var", teendo: "A látványterv jóváhagyására vár" };
    case 6:
      return s.varhato_beszereles
        ? { csoport: "keszul", teendo: `Beszerelés: ${formatDatum(s.varhato_beszereles)}` }
        : { csoport: "keszul", teendo: "Még nincs beszerelési időpont" };
    default:
      return { csoport: "ugyfelre_var", teendo: "Beszerelve: véleményre vár, lezárható" };
  }
}

function napja(iso: string | null, most: number): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((most - t) / 86400_000)) : 0;
}

async function lista(request: Request, env: Env): Promise<Response> {
  if (!(await munkamenetOk(request, env))) return json({ ok: false, belepes: true, hiba: "Lépj be." }, 401);

  const [aktiv, lezart] = await Promise.all([
    env.DB.prepare(`${SOR_SQL} WHERE m.statusz = 'aktiv'`).all<Sor>(),
    env.DB.prepare(`${SOR_SQL} WHERE m.statusz <> 'aktiv' ORDER BY m.id DESC LIMIT ?`).bind(LEZART_LIMIT).all<Sor>(),
  ]);
  const most = Date.now();
  const nevek = new Map(ALLOMASOK.map((a) => [a.n, a.nev]));
  const elem = (s: Sor, teendo: string) => ({
    id: s.id,
    nev: s.nev,
    telefon: s.telefon,
    allomas: s.allomas,
    allomas_nev: nevek.get(s.allomas) ?? String(s.allomas),
    napja: napja(s.allomas_valtas_ideje ?? s.letrehozva, most),
    teendo,
    statusz: s.statusz,
    leiratkozott: s.leiratkozott === 1,
    link: `/m/${s.ricsi_token}`,
  });

  const csoportok: Record<Csoport, ReturnType<typeof elem>[]> = { ram_var: [], keszul: [], ugyfelre_var: [] };
  for (const s of aktiv.results) {
    const b = besorol(s);
    csoportok[b.csoport].push(elem(s, b.teendo));
  }
  // A legrégebb óta álló legyen elöl.
  for (const k of Object.keys(csoportok) as Csoport[]) csoportok[k].sort((a, b) => b.napja - a.napja || a.id - b.id);

  return json({
    ok: true,
    csoportok: [
      { kulcs: "ram_var", cim: "Rám vár", elemek: csoportok.ram_var },
      { kulcs: "keszul", cim: "Készül", elemek: csoportok.keszul },
      { kulcs: "ugyfelre_var", cim: "Ügyfélre vár", elemek: csoportok.ugyfelre_var },
    ],
    lezartak: lezart.results.map((s) => elem(s, s.statusz === "lezarva" ? "Lezárva" : "Nem érdeklődik")),
  });
}
