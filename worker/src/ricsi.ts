// Ricsi-API: /api/m/{token}/... A token a ricsi_token. Ügyfélnek menő válaszba SOHA nem kerül ide tartozó adat.
import type { Env } from "./env";
import { allomasokRicsinek, UTOLSO_ALLOMAS } from "./allomasok";
import { erkezesiLevel, kuldAutomata, kuldUgyfelnek, type AutoEredmeny } from "./levelek";
import { allomasValtas, addUzenet, ervenytelenLink, napokAzAllomasban, orderByToken, rendelesSorok, type Order } from "./megrendeles";
import { isFile, mentFajl, safeName, sniffBlob, streamFajl, sniffFile } from "./fajlok";
import { budapestNap, ervenyesNap, esc, formatDatum, hiba, json, napHozzaad, readForm, readJson, replyAddress, toBase64 } from "./util";

const MAX_JEGYZET = 4000;
const MAX_VALASZ = 20000;
const MAX_CSATOLMANY = 8 * 1024 * 1024;
const MAX_LATVANYTERV = 10 * 1024 * 1024;
const MAX_OSSZEG = 100_000_000;

const nemEngedett = () => hiba("Nem engedélyezett módszer.", 405);
const nemTalalhato = () => hiba("Nem található.", 404);

export async function handleRicsi(request: Request, env: Env, ctx: ExecutionContext, parts: string[]): Promise<Response> {
  // parts: ["m", token, ...rest]
  const o = await orderByToken(env, "ricsi_token", parts[1] ?? "");
  if (!o) return ervenytelenLink();
  const rest = parts.slice(2);
  const m = request.method;

  if (rest.length === 0) return m === "GET" ? allapot(env, o) : nemEngedett();
  if (rest.length === 1) {
    const post = (f: () => Promise<Response>) => (m === "POST" ? f() : nemEngedett());
    switch (rest[0]) {
      case "tovabb":
        return post(() => tovabb(request, env, o));
      case "idopont":
        return post(() => idopont(request, env, o));
      case "vissza":
        return post(() => vissza(env, o));
      case "nem-erdeklodik":
        return post(() => statuszBeallit(env, o, "nem_erdeklodik"));
      case "ujranyit":
        return post(() => statuszBeallit(env, o, "aktiv"));
      case "megjegyzes":
        return post(() => megjegyzes(request, env, o));
      case "valasz":
        return post(() => valasz(request, env, o));
      case "feltoltes":
        return post(() => feltoltes(request, env, o));
    }
  }
  if (rest.length === 2 && rest[0] === "fajl") {
    if (m === "GET") return fajl(env, o, rest[1]);
    if (m === "DELETE") return fajlTorol(env, o, rest[1]);
    return nemEngedett();
  }
  return nemTalalhato();
}

interface FajlRow {
  id: number;
  tipus: string;
  fajlnev: string;
  mime: string | null;
}

async function allapot(env: Env, o: Order): Promise<Response> {
  const [fajlok, uzenetek] = await Promise.all([
    env.DB.prepare(`SELECT id, tipus, fajlnev, mime FROM fajl WHERE megrendeles_id = ? ORDER BY id`).bind(o.id).all<FajlRow>(),
    env.DB.prepare(`SELECT id, irany, targy, szoveg, ido FROM uzenet WHERE megrendeles_id = ? ORDER BY id DESC`)
      .bind(o.id)
      .all<{ id: number; irany: string; targy: string | null; szoveg: string | null; ido: string }>(),
  ]);
  return json({
    ok: true,
    id: o.id,
    nev: o.nev,
    email: o.email,
    telefon: o.telefon,
    forras: o.forras,
    allomas: o.allomas,
    statusz: o.statusz,
    leiratkozott: o.leiratkozott === 1,
    napja_ebben_az_allomasban: napokAzAllomasban(o),
    ajanlat_osszeg: o.ajanlat_osszeg,
    varhato_beszereles: o.varhato_beszereles,
    latvanyterv_jovahagyva: o.latvanyterv_jovahagyva,
    rendeles: rendelesSorok(o),
    fotok: fajlok.results.map((f) => ({
      id: f.id,
      url: `/api/m/${o.ricsi_token}/fajl/${f.id}`,
      fajlnev: f.fajlnev,
      tipus: f.tipus,
      mime: f.mime,
    })),
    uzenetek: uzenetek.results.map((u) => ({ id: u.id, irany: u.irany, targy: u.targy, szoveg: u.szoveg ?? "", ido: u.ido })),
    allomasok: allomasokRicsinek(),
    valasz_cim: replyAddress(env, o.id, o.valasz_kulcs),
  });
}

/** Az üres/hiányzó törzset is elfogadjuk ({}), a hibásat nem. */
async function lazaJson(request: Request): Promise<Record<string, unknown> | Response> {
  const text = await request.text();
  if (text.length > 64 * 1024) return hiba("A kérés túl nagy.", 413);
  if (!text.trim()) return {};
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return hiba("Érvénytelen kérés.");
  }
}

function levelJelzes(r: AutoEredmeny | null): string | null {
  if (!r) return null;
  if (r.kuldve) return "elkuldve";
  if (r.kihagyva) return r.kihagyva === "leiratkozott" ? "kihagyva_leiratkozott" : "kihagyva_statusz";
  return "hiba";
}

async function tovabb(request: Request, env: Env, o: Order): Promise<Response> {
  const body = await lazaJson(request);
  if (body instanceof Response) return body;
  if (o.statusz !== "aktiv") {
    return hiba(
      o.statusz === "lezarva" ? "A megrendelés le van zárva. Nyisd újra, ha folytatnád." : "A megrendelés „nem érdeklődik” jelzésű. Nyisd újra, ha folytatnád.",
      409,
    );
  }

  if (o.allomas === UTOLSO_ALLOMAS) {
    const r = await env.DB.prepare(`UPDATE megrendeles SET statusz = 'lezarva' WHERE id = ? AND statusz = 'aktiv'`).bind(o.id).run();
    if (!r.meta.changes) return hiba("A megrendelés állapota közben megváltozott. Frissítsd az oldalt.", 409);
    await addUzenet(env, o.id, "rendszer", null, "A megrendelés le lett zárva.");
    return json({ ok: true, allomas: o.allomas, statusz: "lezarva", level: null });
  }

  let extra: { sql: string; val: unknown[] } | undefined;
  let osszeg = o.ajanlat_osszeg;
  if (o.allomas === 2) {
    const v = body.osszeg;
    const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,12}$/.test(v.trim()) ? Number(v.trim()) : NaN;
    if (v === undefined || v === null || v === "") return hiba("Add meg az ajánlat összegét.", 409);
    if (!Number.isInteger(n) || n < 1 || n > MAX_OSSZEG) return hiba("Az összeg 1 és 100 000 000 Ft közötti egész szám lehet.", 409);
    osszeg = n;
    extra = { sql: "ajanlat_osszeg = ?", val: [n] };
  } else if (o.allomas === 4) {
    const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM fajl WHERE megrendeles_id = ? AND tipus = 'latvanyterv'`).bind(o.id).first<{ n: number }>();
    if (!c || c.n < 1) return hiba("Előbb tölts fel legalább egy látványtervet.", 409);
  } else if (o.allomas === 5) {
    if (!o.latvanyterv_jovahagyva) return hiba("Az ügyfél még nem hagyta jóvá a látványtervet.", 409);
  }

  const uj = o.allomas + 1;
  if (!(await allomasValtas(env, o, uj, extra))) return hiba("Az állomás közben megváltozott. Frissítsd az oldalt.", 409);

  let eredmeny: AutoEredmeny | null = null;
  const tipus = erkezesiLevel(uj);
  if (tipus) {
    eredmeny = await kuldAutomata(env, { ...o, allomas: uj, ajanlat_osszeg: osszeg }, tipus);
    if (eredmeny.hiba) await addUzenet(env, o.id, "rendszer", "Hiba", `Az automatikus levél (${tipus}) nem ment ki (${eredmeny.hiba})`);
  }
  return json({ ok: true, allomas: uj, statusz: o.statusz, level: levelJelzes(eredmeny) });
}

async function idopont(request: Request, env: Env, o: Order): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return body.res;
  if (o.allomas !== 6) return hiba("Időpontot csak a gyártás állomáson lehet megadni.", 409);
  if (o.statusz !== "aktiv") return hiba("A megrendelés nem aktív. Nyisd újra, ha folytatnád.", 409);
  const datum = body.value.datum;
  if (typeof datum !== "string" || !ervenyesNap(datum)) return hiba("Adj meg egy érvényes dátumot (ÉÉÉÉ-HH-NN).");
  const ma = budapestNap(new Date());
  if (datum < ma) return hiba("A dátum nem lehet a múltban.");
  if (datum > napHozzaad(ma, 365)) return hiba("A dátum legfeljebb 1 évre lehet.");

  await env.DB.prepare(`UPDATE megrendeles SET varhato_beszereles = ? WHERE id = ?`).bind(datum, o.id).run();
  await addUzenet(env, o.id, "rendszer", null, `Várható beszerelés beállítva: ${formatDatum(datum)}`);
  const r = await kuldAutomata(env, { ...o, varhato_beszereles: datum }, "idopont");
  if (r.hiba) await addUzenet(env, o.id, "rendszer", "Hiba", `Az időpont-levél nem ment ki (${r.hiba})`);
  return json({ ok: true, level: levelJelzes(r) });
}

async function vissza(env: Env, o: Order): Promise<Response> {
  if (o.statusz !== "aktiv") return hiba("A megrendelés nem aktív. Előbb nyisd újra.", 409);
  if (o.allomas <= 1) return hiba("Ez már az első állomás.", 409);
  const uj = o.allomas - 1;
  const extra = o.allomas === 5 ? { sql: "latvanyterv_jovahagyva = NULL", val: [] as unknown[] } : undefined;
  if (!(await allomasValtas(env, o, uj, extra))) return hiba("Az állomás közben megváltozott. Frissítsd az oldalt.", 409);
  await addUzenet(env, o.id, "rendszer", null, `Visszalépés: ${uj}. állomás.`);
  return json({ ok: true, allomas: uj, statusz: o.statusz });
}

async function statuszBeallit(env: Env, o: Order, uj: "aktiv" | "nem_erdeklodik"): Promise<Response> {
  if (o.statusz !== uj) {
    await env.DB.prepare(`UPDATE megrendeles SET statusz = ? WHERE id = ?`).bind(uj, o.id).run();
    await addUzenet(env, o.id, "rendszer", null, uj === "aktiv" ? "A megrendelés újra aktív." : "Ricsi „nem érdeklődik” jelzést adott. Az ügyfél nem kapott levelet.");
  }
  return json({ ok: true, statusz: uj });
}

async function megjegyzes(request: Request, env: Env, o: Order): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const sz = typeof body.value.szoveg === "string" ? body.value.szoveg.trim() : "";
  if (!sz) return hiba("Írj valamit a jegyzetbe.");
  if (sz.length > MAX_JEGYZET) return hiba("A jegyzet legfeljebb 4000 karakter lehet.");
  const id = await addUzenet(env, o.id, "megjegyzes", null, sz); // soha nem megy levélben, az ügyfél nem látja
  return json({ ok: true, id });
}

async function valasz(request: Request, env: Env, o: Order): Promise<Response> {
  const form = await readForm(request);
  if (!form.ok) return form.res;
  const f = form.value;
  const szoveg = typeof f.get("szoveg") === "string" ? (f.get("szoveg") as string).trim() : "";
  if (!szoveg) return hiba("Írj pár szót a válaszba.");
  if (szoveg.length > MAX_VALASZ) return hiba("A válasz túl hosszú.");
  const rawTargy = f.get("targy");
  const targy = (typeof rawTargy === "string" ? rawTargy.replace(/[\r\n\t]+/g, " ").trim() : "").slice(0, 200) || "Üzenet a Roll’n’Door-tól";
  const files = f.getAll("csatolmanyok").filter((x): x is File => isFile(x) && x.size > 0);
  if (files.length > 3) return hiba("Legfeljebb 3 csatolmányt küldhetsz.");
  for (const x of files) if (x.size > MAX_CSATOLMANY) return hiba("Egy csatolmány legfeljebb 8 MB lehet.");

  const atts: { name: string; mime: string; blob: File; b64: string }[] = [];
  for (const [i, x] of files.entries()) {
    const bytes = new Uint8Array(await x.arrayBuffer());
    const k = sniffFile(bytes);
    atts.push({ name: safeName(x.name, `csatolmany-${i + 1}${k ? "." + k.ext : ""}`), mime: k?.mime ?? "application/octet-stream", blob: x, b64: toBase64(bytes) });
  }

  const res = await kuldUgyfelnek(env, o, {
    subject: targy,
    text: szoveg,
    html: `<div style="white-space:pre-wrap">${esc(szoveg)}</div>`,
    attachments: atts.map((a) => ({ filename: a.name, contentType: a.mime, content: a.b64 })),
  });
  if (!res.ok) {
    return hiba(
      res.error === "tiltott tartalom"
        ? "A szöveg a saját kezelőlinkedet tartalmazza, azt nem küldhetjük el az ügyfélnek."
        : `A levél nem ment ki (${res.error}). Írj közvetlenül az ügyfélnek: ${o.email}`,
      res.error === "tiltott tartalom" ? 400 : 502,
    );
  }
  const uzId = await addUzenet(env, o.id, "ki", targy, szoveg);
  let mentveHiba = false;
  for (const a of atts) {
    try {
      await mentFajl(env, o.id, "csatolmany", a.name, a.mime, a.blob, uzId);
    } catch {
      mentveHiba = true;
    }
  }
  if (mentveHiba) await addUzenet(env, o.id, "rendszer", "Hiba", "A levél kiment, de egy csatolmány mentése nem sikerült.");
  return json({ ok: true, id: uzId });
}

async function feltoltes(request: Request, env: Env, o: Order): Promise<Response> {
  const form = await readForm(request);
  if (!form.ok) return form.res;
  const tipus = form.value.get("tipus");
  const file = form.value.get("fajl");
  if (tipus !== "latvanyterv" && tipus !== "csatolmany") return hiba("Érvénytelen típus.");
  if (!isFile(file) || file.size === 0) return hiba("Válassz ki egy fájlt.");
  const kind = await sniffBlob(file);
  let mime: string;
  if (tipus === "latvanyterv") {
    if (file.size > MAX_LATVANYTERV) return hiba("A látványterv legfeljebb 10 MB lehet.");
    if (!kind || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(kind.mime)) {
      return hiba("A látványterv JPG, PNG, WebP vagy PDF lehet.");
    }
    mime = kind.mime;
  } else {
    if (file.size > MAX_CSATOLMANY) return hiba("A csatolmány legfeljebb 8 MB lehet.");
    mime = kind?.mime ?? "application/octet-stream";
  }
  const nev = safeName(file.name, `${tipus}${kind ? "." + kind.ext : ""}`);
  const id = await mentFajl(env, o.id, tipus, nev, mime, file, null);
  return json({ ok: true, id, url: `/api/m/${o.ricsi_token}/fajl/${id}` });
}

function fajlId(s: string): number | null {
  return /^\d{1,12}$/.test(s) ? Number(s) : null;
}

async function fajl(env: Env, o: Order, idStr: string): Promise<Response> {
  const id = fajlId(idStr);
  if (id === null) return nemTalalhato();
  const f = await env.DB.prepare(`SELECT r2_kulcs, fajlnev, mime FROM fajl WHERE id = ? AND megrendeles_id = ?`)
    .bind(id, o.id)
    .first<{ r2_kulcs: string; fajlnev: string; mime: string | null }>();
  if (!f) return hiba("A fájl nem található.", 404);
  return (await streamFajl(env, f)) ?? hiba("A fájl nem található.", 404);
}

async function fajlTorol(env: Env, o: Order, idStr: string): Promise<Response> {
  const id = fajlId(idStr);
  if (id === null) return nemTalalhato();
  const f = await env.DB.prepare(`SELECT r2_kulcs, tipus FROM fajl WHERE id = ? AND megrendeles_id = ?`)
    .bind(id, o.id)
    .first<{ r2_kulcs: string; tipus: string }>();
  if (!f) return hiba("A fájl nem található.", 404);
  if (f.tipus !== "latvanyterv") return hiba("Csak látványtervet lehet törölni.", 409);
  if (o.allomas > 5) return hiba("A gyártás megkezdése után a látványterv már nem törölhető.", 409);
  await env.FILES.delete(f.r2_kulcs);
  await env.DB.prepare(`DELETE FROM fajl WHERE id = ? AND megrendeles_id = ?`).bind(id, o.id).run();
  return json({ ok: true });
}

