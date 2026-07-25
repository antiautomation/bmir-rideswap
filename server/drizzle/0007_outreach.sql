-- Outreach: reusable contact lists + email campaigns.
--
-- A `contact` is any address we might send bulk mail to, whatever its origin —
-- the one-time v1 Firestore import, a pasted CSV, or a v2 user picked up by a
-- dynamic audience. Contacts are deliberately NOT users: nobody gets an account
-- from being on a list.
--
-- Unsubscribe state lives on the contact, not the list, so opting out is global
-- across every campaign in one action.
--
-- The DROPs clean up the short-lived first cut of this schema (invite_contacts /
-- segment-based campaigns) which only ever existed on the dev database.

DROP TABLE IF EXISTS campaign_sends;
DROP TABLE IF EXISTS campaigns;
DROP TABLE IF EXISTS invite_contacts;

CREATE TABLE IF NOT EXISTS contacts (
  email             citext PRIMARY KEY,
  name              text,
  -- Set when this address belongs to a v2 account. Drives the "already a user"
  -- skip, and softens unsubscribe (see routes/unsubscribe.ts).
  user_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  -- 'v1_firestore' | 'paste' | 'users' | 'manual'
  source            text NOT NULL DEFAULT 'manual',
  -- Whatever the source knew. v1 imports carry
  -- {segment, driverListings, riderListings, directions, topLocation, lastTravelDate, hadPhone, allDeleted}.
  meta              jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Single-purpose capability: stops bulk mail to this one address. No session.
  unsubscribe_token text NOT NULL UNIQUE,
  unsubscribed_at   timestamptz,
  -- Held back from every campaign (junk address, staff, manual request).
  excluded_at       timestamptz,
  exclude_reason    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contacts_sendable_idx
  ON contacts (email)
  WHERE unsubscribed_at IS NULL AND excluded_at IS NULL;

CREATE INDEX IF NOT EXISTS contacts_user_idx ON contacts (user_id);

CREATE TABLE IF NOT EXISTS contact_lists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL UNIQUE,
  description  text,
  -- 'static'  — membership is whatever was imported/added
  -- 'dynamic' — membership is recomputed from `query` (a key in lib/audiences.ts)
  kind         text NOT NULL DEFAULT 'static',
  query        text,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  refreshed_at timestamptz
);

CREATE TABLE IF NOT EXISTS contact_list_members (
  list_id  uuid NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  email    citext NOT NULL REFERENCES contacts(email) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, email)
);

CREATE INDEX IF NOT EXISTS contact_list_members_email_idx ON contact_list_members (email);

CREATE TABLE IF NOT EXISTS campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  subject             text NOT NULL,
  -- RESTRICT: a list backing a campaign can't be deleted out from under it.
  list_id             uuid NOT NULL REFERENCES contact_lists(id) ON DELETE RESTRICT,
  -- 'invite' (the v1 launch mail) | 'announcement' (admin-authored body)
  template            text NOT NULL DEFAULT 'announcement',
  headline            text,
  intro               text,
  cta_label           text,
  cta_path            text,
  -- 'draft' | 'sending' | 'paused' | 'done' | 'cancelled'
  status              text NOT NULL DEFAULT 'draft',
  throttle_per_minute integer NOT NULL DEFAULT 20,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz,
  finished_at         timestamptz
);

CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status);

-- One row per (campaign, recipient), materialised when the campaign starts.
-- Existence of the row is the idempotency guard: the sender only ever touches
-- rows still marked 'pending', so a restart mid-send never double-mails anyone.
CREATE TABLE IF NOT EXISTS campaign_sends (
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  email           citext NOT NULL,
  -- 'pending' | 'sent' | 'suppressed' | 'unsubscribed' | 'existing_user' | 'failed'
  status          text NOT NULL DEFAULT 'pending',
  ses_message_id  text,
  error           text,
  attempts        integer NOT NULL DEFAULT 0,
  sent_at         timestamptz,
  PRIMARY KEY (campaign_id, email)
);

CREATE INDEX IF NOT EXISTS campaign_sends_pending_idx
  ON campaign_sends (campaign_id)
  WHERE status = 'pending';
