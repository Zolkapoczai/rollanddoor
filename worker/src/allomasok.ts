// A 7 allomas: az EGYETLEN forras a nevekre es szovegekre. Az API `allomasok` mezoje ezt exportalja a klienseknek.
// Modositani csak Ricsivel egyeztetve (docs/TERV.md 4. pont).

export interface Allomas {
  n: number;
  nev: string;
  /** Amit az ugyfel lat az allomason. */
  ugyfel_szoveg: string;
  /** Ricsi tovabblepes gombjanak felirata. */
  ricsi_gomb: string;
  /** Az allomasra ERKEZESKOR automatikusan kuldott level neve (null: nincs). */
  level: string | null;
}

export const ALLOMASOK: readonly Allomas[] = [
  { n: 1, nev: "Igény beérkezett", ugyfel_szoveg: "Megkaptuk, 1 munkanapon belül keresünk.", ricsi_gomb: "Egyeztetés kész", level: "Megkaptuk az igényed" },
  { n: 2, nev: "Egyeztetés", ugyfel_szoveg: "Egyeztetünk a részletekről.", ricsi_gomb: "Ajánlat elküldve", level: null },
  { n: 3, nev: "Ajánlat elküldve", ugyfel_szoveg: "Elkészült az ajánlatod.", ricsi_gomb: "Előleg megérkezett", level: "Elkészült az ajánlatod" },
  { n: 4, nev: "Előleg megérkezett", ugyfel_szoveg: "Köszönjük, készül a látványterv.", ricsi_gomb: "Látványterv kész", level: "Megérkezett az előleg" },
  { n: 5, nev: "Látványterv", ugyfel_szoveg: "Elkészült a látványterved. Kérjük, nézd meg és hagyd jóvá.", ricsi_gomb: "Gyártás indul", level: "Kész a látványterv" },
  { n: 6, nev: "Gyártás", ugyfel_szoveg: "Készül az ajtód (kb. 4 hét).", ricsi_gomb: "Beszerelve", level: null },
  { n: 7, nev: "Beszerelve", ugyfel_szoveg: "Köszönjük, hogy minket választottál!", ricsi_gomb: "Lezárás", level: "Vélemény- és fotókérés" },
];

export const UTOLSO_ALLOMAS = 7;

/** Ugyfelnek mehet: csak n, nev, ugyfel_szoveg. */
export function allomasokUgyfelnek() {
  return ALLOMASOK.map(({ n, nev, ugyfel_szoveg }) => ({ n, nev, ugyfel_szoveg }));
}

/** Ricsinek: az egesz. */
export function allomasokRicsinek() {
  return ALLOMASOK.map((a) => ({ ...a }));
}
