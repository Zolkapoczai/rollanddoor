-- 2. kor: meglevo (1. kori) adatbazisokhoz. Egyszer futtathato (az ALTER TABLE nem ismetelheto).
-- Helyben: npm run db:migrate:local   |   Elesben: npm run db:migrate:remote
-- Friss telepitesnel nem kell: a worker/schema.sql mar tartalmazza.
ALTER TABLE megrendeles ADD COLUMN statusz TEXT NOT NULL DEFAULT 'aktiv' CHECK (statusz IN ('aktiv','lezarva','nem_erdeklodik'));

-- Idempotencia az automatikus (cron) leveleknek: egy tipus megrendelesenkent legfeljebb egyszer.
CREATE TABLE IF NOT EXISTS levelnaplo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  megrendeles_id INTEGER NOT NULL REFERENCES megrendeles(id),
  tipus TEXT NOT NULL,
  ido TEXT NOT NULL,
  UNIQUE (megrendeles_id, tipus)
);
