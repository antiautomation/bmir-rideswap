ALTER TABLE users ADD COLUMN avatar_full bytea;
ALTER TABLE users ADD COLUMN avatar_thumb bytea;
ALTER TABLE users ADD COLUMN avatar_updated_at timestamptz;
