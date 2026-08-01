-- Seats become a shared axis: drivers offer them, riders need them, and 0 on
-- either side means "cargo only". Cargo-only is derived from passenger_space
-- rather than a third listing_type value, because the matches table is
-- structurally driver x rider, and sending stuff vs hauling stuff are opposite
-- sides of the market, not a third side. Deriving it also means a cargo shipper
-- matches any driver with spare room, not just other cargo-only listings.

-- Riders never had a seat concept; every existing one was implicitly one person.
UPDATE listings SET passenger_space = 1 WHERE type = 'rider' AND passenger_space IS NULL;

-- Drop the old 1..5 range check AND the driver-only "seats required" clause.
-- Dropped by definition rather than by name: both are Postgres positional
-- auto-names (listings_passenger_space_check / listings_check1) and depending on
-- that numbering is brittle. The rider clause never mentions passenger_space, so
-- it survives untouched.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'listings'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%passenger_space%'
  LOOP
    EXECUTE format('ALTER TABLE listings DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE listings ALTER COLUMN passenger_space SET NOT NULL;
ALTER TABLE listings ADD CONSTRAINT listings_passenger_space_range
  CHECK (passenger_space BETWEEN 0 AND 5);
-- Cargo capacity stays mandatory for drivers; only the seats half moved out.
ALTER TABLE listings ADD CONSTRAINT listings_driver_cargo_required
  CHECK (type <> 'driver' OR cargo_space IS NOT NULL);

-- The matcher filters candidates by type on every recompute and now reads seats
-- alongside it; there was no index on type at all before this.
CREATE INDEX IF NOT EXISTS listings_type_seats_idx ON listings (type, passenger_space);
