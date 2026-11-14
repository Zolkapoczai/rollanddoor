// Napi cron (wrangler.jsonc: "0 7 * * *" UTC). A logika tiszta függvény: `now`-t kap, ezért tesztelhető.
//  a) 3. állomás, aktív, nem leiratkozott, az érkezés óta nincs ügyfél-üzenet:
//     emlékeztető >= 3 nap után ('emlekezo3') és >= 7 nap után ('emlekezo7'), egyenként egyszer.
//     A 7. napi levél legfeljebb a 14. napig küldhető ki (kiesett cron-futás pótlása), utána semmi.
//  b) 6. állomás, aktív, nem leiratkozott, a várható beszerelés holnap (Europe/Budapest szerint):
//     'szerelesi_emlekezo:<datum>' egyszer.
import type { Env } from "./env";
import { kuldAutomata, type LevelTipus } from "./levelek";
import { addUzenet, type Order } from "./megrendeles";
import { budapestNap, napHozzaad, nowIso } from "./util";

export interface CronEredmeny {
  emlekezo3: number;
  emlekezo7: number;
  szerelesi_emlekezo: number;
}

const NAP = 86400000;
const EMLEKEZO7_LEGKESOBB_NAP = 14;

/** Egyszer küld: előbb beszúr a levelnaplóba, csak a sikeres beszúrás után küld; sikertelen küldésnél visszavonja. */
async function egyszer(env: Env, o: Order, naploTipus: string, level: LevelTipus): Promise<boolean> {
  const ins = await env.DB.prepare(`INSERT OR IGNORE INTO levelnaplo (megrendeles_id, tipus, ido) VALUES (?, ?, ?)`)
    .bind(o.id, naploTipus, nowIso())
    .run();
  if (!ins.meta.changes) return false; // már kiment (vagy épp most megy egy másik futásban)
  const r = await kuldAutomata(env, o, level);
  if (r.kuldve) return true;
  // Nem ment ki: a következő napi futás újra próbálhatja.
  await env.DB.prepare(`DELETE FROM levelnaplo WHERE megrendeles_id = ? AND tipus = ?`).bind(o.id, naploTipus).run();
  if (r.hiba) await addUzenet(env, o.id, "rendszer", "Hiba", `Az automatikus levél (${level}) nem ment ki (${r.hiba})`).catch(() => {});
  return false;
}

export async function futtatCron(env: Env, now: Date): Promise<CronEredmeny> {
  const out: CronEredmeny = { emlekezo3: 0, emlekezo7: 0, szerelesi_emlekezo: 0 };

  // a) ajánlat-emlékeztetők
  const varakozok = await env.DB.prepare(
    `SELECT * FROM megrendeles m
     WHERE m.allomas = 3 AND m.statusz = 'aktiv' AND m.leiratkozott = 0 AND m.allomas_valtas_ideje IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM uzenet u WHERE u.megrendeles_id = m.id AND u.irany = 'be' AND u.ido >= m.allomas_valtas_ideje)`,
  ).all<Order>();
  for (const o of varakozok.results) {
    const t = Date.parse(o.allomas_valtas_ideje as string);
    if (!Number.isFinite(t)) continue;
    const nap = (now.getTime() - t) / NAP;
    if (nap >= 7 && nap < EMLEKEZO7_LEGKESOBB_NAP) {
      if (await egyszer(env, o, "emlekezo7", "emlekezo7")) out.emlekezo7++;
    } else if (nap >= 3 && nap < 7) {
      if (await egyszer(env, o, "emlekezo3", "emlekezo3")) out.emlekezo3++;
    }
  }

  // b) szerelés előtti nap
  const holnap = napHozzaad(budapestNap(now), 1);
  const szerelesek = await env.DB.prepare(
    `SELECT * FROM megrendeles WHERE allomas = 6 AND statusz = 'aktiv' AND leiratkozott = 0 AND varhato_beszereles = ?`,
  )
    .bind(holnap)
    .all<Order>();
  for (const o of szerelesek.results) {
    if (await egyszer(env, o, `szerelesi_emlekezo:${holnap}`, "holnap")) out.szerelesi_emlekezo++;
  }

  console.log(`[cron] emlekezo3=${out.emlekezo3} emlekezo7=${out.emlekezo7} szerelesi=${out.szerelesi_emlekezo}`);
  return out;
}
