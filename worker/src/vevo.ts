// Ügyfél-API: /api/r/{token}/... és /api/le/{token}. A token az ugyfel_token.
import type { Env } from "./env";
import { allomasokUgyfelnek } from "./allomasok";
import { ertesitRicsit } from "./levelek";
import { addUzenet, ervenytelenLink, orderByToken, rendelesSorok, TELEFON_RICSI, type Order } from "./megrendeles";
import { isFile, mentFajl, safeName, sniffBlob, streamFajl } from "./fajlok";
import { hiba, json, readForm, readJson } from "./util";

const MAX_UZENET = 4000;
const MAX_FOTO = 8 * 1024 * 1024;

const nemEngedett = () => hiba("Nem engedélyezett módszer.", 405);
const nemTalalhato = () => hiba("Nem található.", 404);

/** Ricsinek menő értesítő a válasz után (waitUntil), hogy az ügyfél ne várjon rá. */
function ertesit(env: Env, ctx: ExecutionContext, o: Order, tema: string, szoveg: string): void {
  ctx.waitUntil(
    ertesitRicsit(env, o, tema, szoveg)
      .then(async (r) => {
        if (!r.ok) await addUzenet(env, o.id, "rendszer", "Hiba", `Az értesítő levél Ricsinek nem ment ki (${r.error})`);
      })
      .catch(() => console.log("[vevo] ertesito hiba")),
  );
}

export async function handleVevo(request: Request, env: Env, ctx: ExecutionContext, parts: string[]): Promise<Response> {
  // parts: ["r", token, ...rest]
  const token = parts[1] ?? "";
  const o = await orderByToken(env, "ugyfel_token", token);
  if (!o) return ervenytelenLink();
  const rest = parts.slice(2);
  const m = request.method;

  if (rest.length === 0) return m === "GET" ? allapot(env, o) : nemEngedett();
  if (rest.length === 1) {
    const [akcio] = rest;
    if (akcio === "uzenet") return m === "POST" ? uzenet(request, env, ctx, o) : nemEngedett();
    if (akcio === "elfogad") return m === "POST" ? elfogad(env, ctx, o) : nemEngedett();
    if (akcio === "jovahagyas") return m === "POST" ? jovahagyas(request, env, ctx, o) : nemEngedett();
    if (akcio === "velemeny") return m === "POST" ? velemeny(request, env, ctx, o) : nemEngedett();
  }
  if (rest.length === 2 && rest[0] === "fajl") return m === "GET" ? fajl(env, o, rest[1]) : nemEngedett();
  return nemTalalhato();
}

async function allapot(env: Env, o: Order): Promise<Response> {
  const latvOk = o.allomas >= 5; // a latvanyterv-vazlat az 5. allomasig nem latszik az ugyfelnek
  const [fajlok, uzenetek] = await Promise.all([
    latvOk
      ? env.DB.prepare(`SELECT id, fajlnev, mime FROM fajl WHERE megrendeles_id = ? AND tipus = 'latvanyterv' ORDER BY id`)
          .bind(o.id)
          .all<{ id: number; fajlnev: string; mime: string | null }>()
      : Promise.resolve({ results: [] as { id: number; fajlnev: string; mime: string | null }[] }),
    // Az igeny-beerkezes osszefoglaloja (targy: "Uj igeny #…") a `rendeles` mezoben mar benne van, ezert itt nem ismetlodik.
    env.DB.prepare(
      `SELECT irany, szoveg, ido FROM uzenet WHERE megrendeles_id = ? AND irany IN ('be','ki') AND NOT (irany = 'be' AND targy LIKE 'Új igény #%') ORDER BY id`,
    )
      .bind(o.id)
      .all<{ irany: string; szoveg: string | null; ido: string }>(),
  ]);
  return json({
    ok: true,
    nev: o.nev,
    allomas: o.allomas,
    statusz: o.statusz,
    leiratkozott: o.leiratkozott === 1,
    ajanlat_osszeg: o.ajanlat_osszeg,
    varhato_beszereles: o.varhato_beszereles,
    latvanyterv_jovahagyva: o.latvanyterv_jovahagyva !== null,
    latvanyterv: fajlok.results.map((f) => ({ id: f.id, url: `/api/r/${o.ugyfel_token}/fajl/${f.id}`, fajlnev: f.fajlnev, mime: f.mime })),
    rendeles: rendelesSorok(o),
    uzenetek: uzenetek.results.map((u) => ({ irany: u.irany, szoveg: u.szoveg ?? "", ido: u.ido })),
    allomasok: allomasokUgyfelnek(),
    telefon_ricsi: TELEFON_RICSI,
    email_ricsi: env.RICSI_EMAIL,
  });
}

async function uzenet(request: Request, env: Env, ctx: ExecutionContext, o: Order): Promise<Response> {
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const szoveg = typeof body.value.szoveg === "string" ? body.value.szoveg.trim() : "";
  if (!szoveg) return hiba("Írj pár szót az üzenetbe.");
  if (szoveg.length > MAX_UZENET) return hiba("Az üzenet legfeljebb 4000 karakter lehet.");
  // Az ugyfel mindig irhat (aktiv, lezart, es "nem erdeklodik" jelzesu megrendelesre is): ez eltér a szó szerinti specifikaciotol, lasd jelentes.
  await addUzenet(env, o.id, "be", null, szoveg);
  ertesit(env, ctx, o, "új üzenet", `Új üzenet érkezett az ügyféltől:\n\n${szoveg}`);
  return json({ ok: true });
}

async function elfogad(env: Env, ctx: ExecutionContext, o: Order): Promise<Response> {
  if (o.allomas !== 3) return hiba("Az ajánlatot most nem lehet elfogadni.", 409);
  const SZ = "Az ügyfél elfogadta az ajánlatot.";
  // Idempotens: ha az aktuális állomásra érkezés óta már elfogadta, nincs duplikált üzenet/levél.
  const mar = await env.DB.prepare(`SELECT 1 AS x FROM uzenet WHERE megrendeles_id = ? AND irany = 'be' AND szoveg = ? AND ido >= ? LIMIT 1`)
    .bind(o.id, SZ, o.allomas_valtas_ideje ?? "")
    .first();
  if (mar) return json({ ok: true });
  await addUzenet(env, o.id, "be", null, SZ);
  ertesit(env, ctx, o, "elfogadta az ajánlatot", "Az ügyfél elfogadta az ajánlatot. Az előleg érkezése után lépj tovább.");
  return json({ ok: true });
}

async function jovahagyas(request: Request, env: Env, ctx: ExecutionContext, o: Order): Promise<Response> {
  if (o.allomas !== 5) return hiba("A látványtervet most nem lehet jóváhagyni.", 409);
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const dontes = body.value.dontes;
  if (dontes === "jovahagyom") {
    if (o.latvanyterv_jovahagyva) return json({ ok: true });
    const r = await env.DB.prepare(`UPDATE megrendeles SET latvanyterv_jovahagyva = ? WHERE id = ? AND latvanyterv_jovahagyva IS NULL`)
      .bind(new Date().toISOString(), o.id)
      .run();
    if (r.meta.changes) {
      await addUzenet(env, o.id, "be", null, "Az ügyfél jóváhagyta a látványtervet.");
      ertesit(env, ctx, o, "jóváhagyta a látványtervet", "Az ügyfél jóváhagyta a látványtervet. Indulhat a gyártás.");
    }
    return json({ ok: true });
  }
  if (dontes === "modositas") {
    const megj = typeof body.value.megjegyzes === "string" ? body.value.megjegyzes.trim() : "";
    if (!megj) return hiba("Írd meg, mit módosítsunk.");
    if (megj.length > MAX_UZENET) return hiba("A megjegyzés legfeljebb 4000 karakter lehet.");
    await addUzenet(env, o.id, "be", null, `Módosítást kér: ${megj}`);
    ertesit(env, ctx, o, "módosítást kér a látványterven", `Az ügyfél módosítást kér a látványterven:\n\n${megj}`);
    return json({ ok: true });
  }
  return hiba("Érvénytelen döntés.");
}

async function velemeny(request: Request, env: Env, ctx: ExecutionContext, o: Order): Promise<Response> {
  if (o.allomas !== 7) return hiba("Véleményt a beszerelés után lehet küldeni.", 409);
  const form = await readForm(request);
  if (!form.ok) return form.res;
  const f = form.value;
  const rawSz = f.get("szoveg");
  const szoveg = typeof rawSz === "string" ? rawSz.trim() : "";
  if (szoveg.length > MAX_UZENET) return hiba("A vélemény legfeljebb 4000 karakter lehet.");
  const fotok = f.getAll("fotok").filter((x): x is File => isFile(x) && x.size > 0);
  if (fotok.length > 2) return hiba("Legfeljebb 2 fotót tölthetsz fel.");
  if (!szoveg && !fotok.length) return hiba("Írj pár szót, vagy csatolj egy fotót.");
  const kinds: { mime: string; ext: string }[] = [];
  for (const x of fotok) {
    if (x.size > MAX_FOTO) return hiba("Egy fotó legfeljebb 8 MB lehet.");
    const k = await sniffBlob(x);
    if (!k || !k.mime.startsWith("image/")) return hiba("Csak képfájl (JPG, PNG, WebP, GIF, HEIC) tölthető fel.");
    kinds.push(k);
  }
  const uzId = await addUzenet(env, o.id, "be", null, `Vélemény: ${szoveg || "(szöveg nélkül)"}`);
  let mentve = 0;
  for (const [i, x] of fotok.entries()) {
    try {
      await mentFajl(env, o.id, "kesz", safeName(`kesz-foto-${i + 1}.${kinds[i].ext}`, `foto-${i + 1}`), kinds[i].mime, x, uzId);
      mentve++;
    } catch {
      console.log("[vevo] velemeny foto mentese nem sikerult");
    }
  }
  ertesit(
    env,
    ctx,
    o,
    "vélemény érkezett",
    `Vélemény érkezett az ügyféltől (${mentve} fotó).\n\n${szoveg || "(szöveg nélkül)"}`,
  );
  if (mentve < fotok.length) return hiba("A vélemény megvan, de a fotót nem sikerült elmenteni. Próbáld újra, vagy küldd e-mailben.", 500);
  return json({ ok: true });
}

async function fajl(env: Env, o: Order, idStr: string): Promise<Response> {
  const id = /^\d{1,12}$/.test(idStr) ? Number(idStr) : NaN;
  if (!Number.isSafeInteger(id)) return nemTalalhato();
  const f = await env.DB.prepare(
    `SELECT r2_kulcs, fajlnev, mime, tipus FROM fajl WHERE id = ? AND megrendeles_id = ? AND tipus IN ('latvanyterv','kesz')`,
  )
    .bind(id, o.id)
    .first<{ r2_kulcs: string; fajlnev: string; mime: string | null; tipus: string }>();
  if (!f || (f.tipus === "latvanyterv" && o.allomas < 5)) return hiba("A fájl nem található.", 404);
  return (await streamFajl(env, f)) ?? hiba("A fájl nem található.", 404);
}

// ---------- Leiratkozás: /api/le/{token} (az ügyfél tokenje) ----------

export async function handleLeiratkozas(request: Request, env: Env, ctx: ExecutionContext, parts: string[]): Promise<Response> {
  // parts: ["le", token]
  if (parts.length !== 2) return nemTalalhato();
  const o = await orderByToken(env, "ugyfel_token", parts[1]);
  if (!o) return ervenytelenLink();
  if (request.method === "GET") return json({ ok: true, nev: o.nev, leiratkozott: o.leiratkozott === 1 });
  if (request.method !== "POST") return nemEngedett();
  // Idempotens: csak az első leiratkozás ír naplót és szól Ricsinek.
  const r = await env.DB.prepare(`UPDATE megrendeles SET leiratkozott = 1 WHERE id = ? AND leiratkozott = 0`).bind(o.id).run();
  if (r.meta.changes) {
    await addUzenet(env, o.id, "rendszer", null, "Az ügyfél nem kér több automatikus levelet.");
    ertesit(env, ctx, o, "leiratkozott az automatikus levelekről", "Az ügyfél nem kér több automatikus levelet. A kézi válaszaid továbbra is kimennek neki.");
  }
  return json({ ok: true });
}
