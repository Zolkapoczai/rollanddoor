// Cron-logika teszt a HELYI D1 ellen, kamu `now`-val. Futtatás: npm run test:cron
// (Windows, & az útvonalban: node node_modules/esbuild/bin/esbuild worker/test/cron.test.ts --bundle --platform=node --format=esm --external:wrangler --outfile=.wrangler/cron.test.mjs && node .wrangler/cron.test.mjs)
// A teszt saját sorokat hoz létre ("CRON-TEST ..." névvel); a dev szerver és ez a folyamat ugyanazt a .wrangler állapotot használja.
import { getPlatformProxy } from "wrangler";
import { futtatCron } from "../src/cron";
import type { Env } from "../src/env";

const { env, dispose } = await getPlatformProxy<Env>({ configPath: "wrangler.jsonc" });
if (env.RESEND_API_KEY) {
  console.log("MEGSZAKÍTVA: RESEND_API_KEY be van állítva, a teszt valódi levelet küldene.");
  await dispose();
  process.exit(2);
}

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = ""): void {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

const DAY = 86400000;
const T0 = new Date();
const iso = (d: Date) => d.toISOString();
const at = (days: number) => new Date(T0.getTime() + days * DAY);
const rnd = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
const tag = rnd(5);

interface Opts {
  nev: string;
  allomas: number;
  valtas: string;
  leiratkozott?: number;
  statusz?: string;
  varhato?: string | null;
}
async function mkOrder(o: Opts): Promise<number> {
  const r = await env.DB.prepare(
    `INSERT INTO megrendeles (ugyfel_token, ricsi_token, valasz_kulcs, nev, email, forras, uzenet, allomas, ajanlat_osszeg, varhato_beszereles, leiratkozott, statusz, letrehozva, allomas_valtas_ideje)
     VALUES (?, ?, ?, ?, ?, 'urlap', 'teszt', ?, 250000, ?, ?, ?, ?, ?)`,
  )
    .bind(rnd(43), rnd(43), rnd(10), `CRON-TEST ${o.nev} ${tag}`, `cron-${rnd(6)}@example.com`, o.allomas, o.varhato ?? null, o.leiratkozott ?? 0, o.statusz ?? "aktiv", o.valtas, o.valtas)
    .run();
  return Number(r.meta.last_row_id);
}
async function msg(id: number, irany: string, ido: string): Promise<void> {
  await env.DB.prepare(`INSERT INTO uzenet (megrendeles_id, irany, szoveg, ido) VALUES (?, ?, 'teszt', ?)`).bind(id, irany, ido).run();
}
async function naplo(id: number): Promise<string[]> {
  const r = await env.DB.prepare(`SELECT tipus FROM levelnaplo WHERE megrendeles_id = ? ORDER BY id`).bind(id).all<{ tipus: string }>();
  return r.results.map((x) => x.tipus);
}
const eq = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);

// ---- a) ajánlat-emlékeztetők ----
const base = iso(T0);
const c = await mkOrder({ nev: "normal", allomas: 3, valtas: base });
const answered = await mkOrder({ nev: "valaszolt", allomas: 3, valtas: base });
await msg(answered, "be", iso(at(1)));
const oldMsg = await mkOrder({ nev: "regi-uzenet-az-erkezes-elott", allomas: 3, valtas: base });
await msg(oldMsg, "be", iso(at(-1)));
const unsub = await mkOrder({ nev: "leiratkozott", allomas: 3, valtas: base, leiratkozott: 1 });
const notInt = await mkOrder({ nev: "nem-erdeklodik", allomas: 3, valtas: base, statusz: "nem_erdeklodik" });
const stage4 = await mkOrder({ nev: "4-es-allomas", allomas: 4, valtas: base });
const fresh8 = await mkOrder({ nev: "friss-8-napos-kihagyott-cron", allomas: 3, valtas: iso(at(-8)) });
const old30 = await mkOrder({ nev: "30-napos", allomas: 3, valtas: iso(at(-30)) });

console.log("--- now = nap 2 ---");
await futtatCron(env, at(2));
ok("nap 2: nincs emlékeztető", eq(await naplo(c), []));
console.log("--- now = nap 3 ---");
await futtatCron(env, at(3));
ok("nap 3: emlekezo3 egyszer", eq(await naplo(c), ["emlekezo3"]));
await futtatCron(env, at(3.5));
ok("nap 3,5: nincs ismétlés (idempotens)", eq(await naplo(c), ["emlekezo3"]));
console.log("--- now = nap 6 ---");
await futtatCron(env, at(6));
ok("nap 6: még mindig csak emlekezo3", eq(await naplo(c), ["emlekezo3"]));
console.log("--- now = nap 7 ---");
await futtatCron(env, at(7));
ok("nap 7: emlekezo7 egyszer", eq(await naplo(c), ["emlekezo3", "emlekezo7"]));
console.log("--- now = nap 8 ---");
await futtatCron(env, at(8));
ok("nap 8: nincs több", eq(await naplo(c), ["emlekezo3", "emlekezo7"]));
await futtatCron(env, at(20));
ok("nap 20: nincs több", eq(await naplo(c), ["emlekezo3", "emlekezo7"]));
ok("megválaszolt (be üzenet az érkezés után): nincs emlékeztető", eq(await naplo(answered), []));
ok("az érkezés ELŐTTI üzenet nem számít válasznak: kapott emlékeztetőt", (await naplo(oldMsg)).length >= 1);
ok("leiratkozott: nincs emlékeztető", eq(await naplo(unsub), []));
ok("nem_erdeklodik: nincs emlékeztető", eq(await naplo(notInt), []));
ok("4. állomás: nincs ajánlat-emlékeztető", eq(await naplo(stage4), []));
// fresh8: a nap 2 futásnál 10 napos volt (>=7, <14) -> emlekezo7 egyszer; később sem több
ok("8+ napos, soha nem emlékeztetett: legfeljebb emlekezo7 (nincs emlekezo3 utólag)", !(await naplo(fresh8)).includes("emlekezo3") && (await naplo(fresh8)).filter((t) => t === "emlekezo7").length <= 1);
ok("30 napos (14 nap fölött): semmi", eq(await naplo(old30), []));

// 3. állomásra visszalépés után újra indul (allomasValtas törli a naplót) - itt csak a naplótörlés logikáját nem ismételjük.

// ---- b) szerelés előtti nap ----
const nap = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(at(40));
const plus = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
};
const nowEve = new Date(`${nap}T10:00:00Z`);
const eve = await mkOrder({ nev: "szereles-holnap", allomas: 6, valtas: base, varhato: plus(nap, 1) });
const eveLater = await mkOrder({ nev: "szereles-holnaputan", allomas: 6, valtas: base, varhato: plus(nap, 2) });
const eveUnsub = await mkOrder({ nev: "szereles-holnap-leiratkozott", allomas: 6, valtas: base, varhato: plus(nap, 1), leiratkozott: 1 });
const eveWrongStage = await mkOrder({ nev: "szereles-holnap-5-allomas", allomas: 5, valtas: base, varhato: plus(nap, 1) });
const eveClosed = await mkOrder({ nev: "szereles-holnap-nem-erdeklodik", allomas: 6, valtas: base, varhato: plus(nap, 1), statusz: "nem_erdeklodik" });

console.log(`--- now = ${nap} 10:00Z (holnap = ${plus(nap, 1)}) ---`);
await futtatCron(env, nowEve);
ok("szerelés holnap: 1 emlékeztető", eq(await naplo(eve), [`szerelesi_emlekezo:${plus(nap, 1)}`]));
await futtatCron(env, nowEve);
ok("ugyanaznap újrafuttatva: nincs duplikáció", (await naplo(eve)).length === 1);
ok("szerelés holnapután: nincs", eq(await naplo(eveLater), []));
ok("szerelés holnap, leiratkozott: nincs", eq(await naplo(eveUnsub), []));
ok("szerelés holnap, de 5. állomás: nincs", eq(await naplo(eveWrongStage), []));
ok("szerelés holnap, nem_erdeklodik: nincs", eq(await naplo(eveClosed), []));

// dátumváltozás: Ricsi áthelyezi holnapra-holnaputánra -> új kulcs, új levél
await env.DB.prepare(`UPDATE megrendeles SET varhato_beszereles = ? WHERE id = ?`).bind(plus(nap, 2), eve).run();
await futtatCron(env, new Date(`${plus(nap, 1)}T10:00:00Z`));
ok("áthelyezett dátum: új kulccsal újra emlékeztet", eq(await naplo(eve), [`szerelesi_emlekezo:${plus(nap, 1)}`, `szerelesi_emlekezo:${plus(nap, 2)}`]));
ok("a holnaputáni szerelés a következő napon kapja meg", eq(await naplo(eveLater), [`szerelesi_emlekezo:${plus(nap, 2)}`]));

// Europe/Budapest határ: UTC 23:30 már másnap 00:30 (téli idő, UTC+1)
const tel = "2027-01-14"; // fix téli dátum
const lateUtc = new Date(`${tel}T23:30:00Z`); // Budapest: 2027-01-15 00:30 -> holnap = 2027-01-16
const tzA = await mkOrder({ nev: "tz-holnap-01-16", allomas: 6, valtas: base, varhato: "2027-01-16" });
const tzB = await mkOrder({ nev: "tz-01-15-NEM", allomas: 6, valtas: base, varhato: "2027-01-15" });
await futtatCron(env, lateUtc);
ok("Budapest-határ: 23:30Z -> a holnap 01-16 (nem 01-15)", eq(await naplo(tzA), ["szerelesi_emlekezo:2027-01-16"]) && eq(await naplo(tzB), []));

console.log(`\nCRON RESULT: ${pass} pass, ${fail} fail (tag ${tag})`);
await dispose();
process.exit(fail ? 1 : 0);
