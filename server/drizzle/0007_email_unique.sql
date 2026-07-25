-- One account per email address. Existing duplicates: the email stays on the
-- account that uses it most (most listings, then most recently seen, then
-- oldest); the others get their email cleared. They keep working — recovery
-- codes and sessions are untouched — and can set a different email, or their
-- owner can use the new email sign-in link to reach the surviving account.

UPDATE users u SET email = NULL
WHERE u.email IS NOT NULL
  AND u.id NOT IN (
    SELECT DISTINCT ON (lower(email)) id FROM users
    WHERE email IS NOT NULL
    ORDER BY lower(email),
      (SELECT count(*) FROM listings l WHERE l.user_id = users.id) DESC,
      last_seen_at DESC,
      created_at ASC
  );

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (lower(email)) WHERE email IS NOT NULL;
