-- Photos attached to messages. They live in Postgres as bytea for the same
-- reason avatars do (0004_user_avatars.sql): there is no object store in this
-- deployment, and a single replica has nothing to share a filesystem with.
--
-- A photo is uploaded before its message exists — the composer can be starting a
-- brand-new conversation, which has no id yet — so the photo is its own row and
-- messages point at it. A one-way FK, no circularity.
CREATE TABLE IF NOT EXISTS message_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who uploaded it. Checked when the photo is attached so nobody can attach a
  -- stranger's upload by guessing an id, and the only owner of an unattached
  -- photo before that point.
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- "photo_" prefixed to match users.avatar_full/avatar_thumb, and because a
  -- bare "full" is a reserved word that would need quoting everywhere.
  photo_full    bytea NOT NULL,
  photo_thumb   bytea NOT NULL,
  -- Stored so the client can reserve the right box before the bytes arrive; the
  -- thread auto-scrolls on new messages and a late-loading image would otherwise
  -- shove the conversation out from under the reader.
  width         smallint NOT NULL,
  height        smallint NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS photo_id uuid REFERENCES message_photos(id);

-- body stays NOT NULL: a photo-only message stores ''. Nullable would push
-- `string | null` through the DTO, the digest template, the inbox preview and
-- the admin views to express something an empty string already says. The
-- existing length check has no lower bound, so it needs no change.

-- Drives the nightly sweep of photos that were uploaded and then abandoned.
CREATE INDEX IF NOT EXISTS message_photos_sweep_idx ON message_photos (created_at);
