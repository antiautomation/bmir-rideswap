-- Admin console: server-side usage metrics (privacy-preserving) + runtime settings.

CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day date NOT NULL,
  ip_hash text NOT NULL,
  path text NOT NULL DEFAULT '/',
  referrer_host text,
  had_session boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visits_day_idx ON visits (day);
CREATE INDEX IF NOT EXISTS visits_day_ip_idx ON visits (day, ip_hash);

-- Geo cache keyed by the same salted hash — raw IPs are never stored.
CREATE TABLE IF NOT EXISTS ip_geo (
  ip_hash text PRIMARY KEY,
  region text,
  country text,
  looked_up_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
