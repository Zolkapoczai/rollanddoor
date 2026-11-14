-- Roll'n'Door megrendeles-rendszer. Futtatas: npm run db:local | db:remote
CREATE TABLE IF NOT EXISTS megrendeles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ugyfel_token TEXT NOT NULL UNIQUE,
  ricsi_token TEXT NOT NULL UNIQUE,
  valasz_kulcs TEXT NOT NULL UNIQUE,
  nev TEXT NOT NULL,
  email TEXT NOT NULL,
  telefon TEXT,
  forras TEXT NOT NULL CHECK (forras IN ('urlap','tervezo')),
  uzenet TEXT,
  igeny_json TEXT,
  allomas INTEGER NOT NULL DEFAULT 1 CHECK (allomas BETWEEN 1 AND 7),
  ajanlat_osszeg INTEGER,
  varhato_beszereles TEXT,
  latvanyterv_jovahagyva TEXT,
  leiratkozott INTEGER NOT NULL DEFAULT 0,
  -- 2. kor: aktiv | lezarva | nem_erdeklodik (meglevo DB-hez: worker/migrations/0002_kor2.sql)
  statusz TEXT NOT NULL DEFAULT 'aktiv' CHECK (statusz IN ('aktiv','lezarva','nem_erdeklodik')),
  letrehozva TEXT NOT NULL,
  allomas_valtas_ideje TEXT
);

CREATE TABLE IF NOT EXISTS uzenet (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  megrendeles_id INTEGER NOT NULL REFERENCES megrendeles(id),
  irany TEXT NOT NULL CHECK (irany IN ('be','ki','megjegyzes','rendszer')),
  targy TEXT,
  szoveg TEXT,
  ido TEXT NOT NULL,
  -- Kiegeszites a specifikaciohoz: a bejovo webhook idempotenciajahoz (Resend email_id).
  kulso_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uzenet_kulso_id ON uzenet(kulso_id) WHERE kulso_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS uzenet_megrendeles ON uzenet(megrendeles_id);

CREATE TABLE IF NOT EXISTS fajl (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  megrendeles_id INTEGER NOT NULL REFERENCES megrendeles(id),
  uzenet_id INTEGER REFERENCES uzenet(id),
  tipus TEXT NOT NULL CHECK (tipus IN ('nyilas','latvanyterv','kesz','csatolmany')),
  r2_kulcs TEXT NOT NULL,
  fajlnev TEXT NOT NULL,
  mime TEXT,
  meret INTEGER,
  ido TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fajl_megrendeles ON fajl(megrendeles_id);

CREATE TABLE IF NOT EXISTS allomas_naplo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  megrendeles_id INTEGER NOT NULL REFERENCES megrendeles(id),
  allomas INTEGER NOT NULL,
  ido TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS allomas_naplo_megrendeles ON allomas_naplo(megrendeles_id);

-- 2. kor: idempotencia az automatikus (cron) leveleknek: egy tipus megrendelesenkent legfeljebb egyszer.
CREATE TABLE IF NOT EXISTS levelnaplo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  megrendeles_id INTEGER NOT NULL REFERENCES megrendeles(id),
  tipus TEXT NOT NULL,
  ido TEXT NOT NULL,
  UNIQUE (megrendeles_id, tipus)
);

-- Ricsi összesítő oldala (/dashboard): e-mailes belépőlink és munkamenet, a tokenek csak hash-ként (worker/src/dashboard.ts).
CREATE TABLE IF NOT EXISTS pult_belepo (
  hash TEXT PRIMARY KEY,
  letrehozva TEXT NOT NULL,
  lejar TEXT NOT NULL,
  felhasznalva TEXT
);

CREATE TABLE IF NOT EXISTS pult_munkamenet (
  hash TEXT PRIMARY KEY,
  letrehozva TEXT NOT NULL,
  lejar TEXT NOT NULL
);
