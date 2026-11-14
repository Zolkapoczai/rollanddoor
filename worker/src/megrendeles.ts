// Kozos adatreteg a megrendelesekhez (ugyfel- es Ricsi-API).
import type { Env } from "./env";
import { ALLOMASOK } from "./allomasok";
import { flattenPairs, summaryPairs } from "./igeny";
import { hiba, nowIso } from "./util";

export interface Order {
  id: number;
  ugyfel_token: string;
  ricsi_token: string;
  valasz_kulcs: string;
  nev: string;
  email: string;
  telefon: string | null;
  forras: "urlap" | "tervezo";
  uzenet: string | null;
  igeny_json: string | null;
  allomas: number;
  ajanlat_osszeg: number | null;
  varhato_beszereles: string | null;
  latvanyterv_jovahagyva: string | null;
  leiratkozott: number;
  statusz: "aktiv" | "lezarva" | "nem_erdeklodik";
  letrehozva: string;
  allomas_valtas_ideje: string | null;
}

export const TELEFON_RICSI = "06 20 565 0661";

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** Egyetlen, mindenre azonos valasz: ismeretlen/hibas/idegen token. */
export function ervenytelenLink(): Response {
  return hiba("A link nem érvényes.", 404);
}

export async function orderByToken(env: Env, col: "ugyfel_token" | "ricsi_token", token: string): Promise<Order | null> {
  if (!TOKEN_RE.test(token)) return null;
  // `col` fix, belso ertek (nem felhasznaloi bemenet); a token parameter.
  const sql = col === "ugyfel_token" ? `SELECT * FROM megrendeles WHERE ugyfel_token = ?` : `SELECT * FROM megrendeles WHERE ricsi_token = ?`;
  return (await env.DB.prepare(sql).bind(token).first<Order>()) ?? null;
}

export async function orderById(env: Env, id: number): Promise<Order | null> {
  return (await env.DB.prepare(`SELECT * FROM megrendeles WHERE id = ?`).bind(id).first<Order>()) ?? null;
}

export async function addUzenet(
  env: Env,
  megrendelesId: number,
  irany: "be" | "ki" | "megjegyzes" | "rendszer",
  targy: string | null,
  szoveg: string,
): Promise<number> {
  const r = await env.DB.prepare(`INSERT INTO uzenet (megrendeles_id, irany, targy, szoveg, ido) VALUES (?, ?, ?, ?, ?)`)
    .bind(megrendelesId, irany, targy, szoveg, nowIso())
    .run();
  return Number(r.meta.last_row_id);
}

/** Allomasvaltas: naplo + allomas_valtas_ideje, egy batch-ben. false, ha kozben mas valtoztatta az allomast. */
export async function allomasValtas(env: Env, o: Order, uj: number, extraSet?: { sql: string; val: unknown[] }): Promise<boolean> {
  const now = nowIso();
  const upd = env.DB.prepare(
    `UPDATE megrendeles SET allomas = ?, allomas_valtas_ideje = ?${extraSet ? ", " + extraSet.sql : ""} WHERE id = ? AND allomas = ?`,
  ).bind(uj, now, ...(extraSet?.val ?? []), o.id, o.allomas);
  const res = await upd.run();
  if (!res.meta.changes) return false;
  const stmts = [env.DB.prepare(`INSERT INTO allomas_naplo (megrendeles_id, allomas, ido) VALUES (?, ?, ?)`).bind(o.id, uj, now)];
  // A 3. allomasra (ujra)lepeskor az emlekezok ujrainduljanak.
  if (uj === 3) stmts.push(env.DB.prepare(`DELETE FROM levelnaplo WHERE megrendeles_id = ? AND tipus IN ('emlekezo3','emlekezo7')`).bind(o.id));
  await env.DB.batch(stmts);
  return true;
}

export interface Sor {
  cimke: string;
  ertek: string;
}

/** Az igeny osszefoglaloja olvashato cimke-ertek sorokban (az ugyfel is ezt latja). */
export function rendelesSorok(o: Order): Sor[] {
  if (o.forras === "urlap") return o.uzenet ? [{ cimke: "Üzeneted", ertek: o.uzenet }] : [];
  if (!o.igeny_json) return o.uzenet ? [{ cimke: "Üzeneted", ertek: o.uzenet }] : [];
  try {
    const parsed = JSON.parse(o.igeny_json);
    const rows = parsed && typeof parsed === "object" ? summaryPairs((parsed as Record<string, unknown>).osszegzes) : [];
    return rows.length ? rows : flattenPairs(parsed);
  } catch {
    return [];
  }
}

export function napokAzAllomasban(o: Order, now = new Date()): number {
  if (!o.allomas_valtas_ideje) return 0;
  const t = Date.parse(o.allomas_valtas_ideje);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now.getTime() - t) / 86400000)) : 0;
}

export function allomasNev(n: number): string {
  return ALLOMASOK[n - 1]?.nev ?? String(n);
}
