-- Per-account UI preferences (starred listings, hidden matches, hidden
-- listings) so they follow the user across devices.
ALTER TABLE users ADD COLUMN IF NOT EXISTS prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
