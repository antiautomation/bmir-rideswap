-- Per-user match-email thresholds. NULL min score = fall back to the global
-- minEmailScore setting; same-day-only is an opt-in hard filter on top of it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS match_email_min_score integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS match_email_same_day_only boolean NOT NULL DEFAULT false;
