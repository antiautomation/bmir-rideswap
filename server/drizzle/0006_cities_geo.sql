-- City reference table (GeoNames, US+CA pop>15k) for typeahead + geocoding,
-- and listing origin coordinates for "on the way" corridor matching.

CREATE TABLE IF NOT EXISTS cities (
  id serial PRIMARY KEY,
  name text NOT NULL,
  state text NOT NULL,
  country text NOT NULL,
  name_norm text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  population integer NOT NULL
);

CREATE INDEX IF NOT EXISTS cities_name_norm_idx ON cities (name_norm);
CREATE INDEX IF NOT EXISTS cities_name_trgm_idx ON cities USING gin (name_norm gin_trgm_ops);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS origin_lat double precision;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS origin_lng double precision;
