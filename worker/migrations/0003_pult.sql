-- Ricsi összesítő oldala (/pult): e-mailes belépőlink és munkamenet. Többször is futtatható (IF NOT EXISTS).
-- Helyben:  node node_modules/wrangler/bin/wrangler.js d1 execute rollndoor --local  --file=worker/migrations/0003_pult.sql
-- Élesben:  node node_modules/wrangler/bin/wrangler.js d1 execute rollndoor --remote --file=worker/migrations/0003_pult.sql
-- Friss telepítésnél nem kell: a worker/schema.sql már tartalmazza.
-- A tokeneket csak SHA-256 hash-ként tároljuk: az adatbázisból nem lehet belépni.

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
