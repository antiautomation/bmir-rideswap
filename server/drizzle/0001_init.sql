CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE listing_type AS ENUM ('driver','rider');
CREATE TYPE direction AS ENUM ('to_brc','from_brc');
CREATE TYPE belongings AS ENUM ('minimal','standard','substantial','extensive');
CREATE TYPE digest_freq AS ENUM ('instant','hourly','daily','off');

CREATE TABLE users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_code    text NOT NULL UNIQUE,
  name             text,
  email            citext,
  phone            text,
  digest_frequency digest_freq NOT NULL DEFAULT 'hourly',
  last_digest_at   timestamptz,
  is_admin         boolean NOT NULL DEFAULT false,
  banned_at        timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz
);

CREATE TABLE magic_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE TABLE listings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  type            listing_type NOT NULL,
  direction       direction NOT NULL,
  name            text NOT NULL,
  location_raw    text NOT NULL,
  location_norm   text NOT NULL,
  travel_date     date NOT NULL,
  time_slot       text NOT NULL DEFAULT 'flexible',
  details         text,
  camp_info       text,
  passenger_space smallint CHECK (passenger_space BETWEEN 1 AND 5),
  cargo_space     belongings,
  route_details   text,
  rider_stuff     belongings,
  expires_at      timestamptz NOT NULL,
  cancelled_at    timestamptz,
  deleted_at      timestamptz,
  hidden_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (time_slot = 'flexible' OR time_slot ~ '^\d{2}:00 - \d{2}:00$'),
  CHECK (type <> 'driver' OR (passenger_space IS NOT NULL AND cargo_space IS NOT NULL)),
  CHECK (type <> 'rider' OR rider_stuff IS NOT NULL)
);
CREATE INDEX listings_browse_idx ON listings (direction, travel_date)
  WHERE cancelled_at IS NULL AND deleted_at IS NULL AND hidden_at IS NULL;
CREATE INDEX listings_user_idx ON listings (user_id);
CREATE INDEX listings_locnorm_trgm ON listings USING gin (location_norm gin_trgm_ops);

CREATE TABLE conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        uuid NOT NULL REFERENCES listings(id),
  initiator_user_id uuid NOT NULL REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, initiator_user_id)
);

CREATE TABLE messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  sender_user_id  uuid NOT NULL REFERENCES users(id),
  body            text NOT NULL CHECK (char_length(body) <= 2000),
  shared_email    citext,
  shared_phone    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz,
  emailed_at      timestamptz
);
CREATE INDEX messages_conv_idx ON messages (conversation_id, created_at);
CREATE INDEX messages_unemailed_idx ON messages (emailed_at) WHERE emailed_at IS NULL;

CREATE TABLE matches (
  driver_listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  rider_listing_id   uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  score              integer NOT NULL,
  reasons            jsonb NOT NULL,
  computed_at        timestamptz NOT NULL DEFAULT now(),
  notified_driver_at timestamptz,
  notified_rider_at  timestamptz,
  PRIMARY KEY (driver_listing_id, rider_listing_id)
);

CREATE TABLE flags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  flagger_id uuid NOT NULL REFERENCES users(id),
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, flagger_id)
);

CREATE TABLE email_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES users(id),
  to_email       citext NOT NULL,
  kind           text NOT NULL,
  subject        text NOT NULL,
  ses_message_id text,
  sent_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_suppressions (
  email      citext PRIMARY KEY,
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
