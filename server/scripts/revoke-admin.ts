/* Revoke the is_admin flag on a user, by id or recovery code, and kill every
   session and outstanding magic link they hold.

   The admin console can promote (POST /api/admin/claim) but has no demote, and
   the hard-delete endpoint refuses to delete admins — so this is the way to
   clean up an admin account that shouldn't be one (a test/verification session,
   or an operator whose access is being pulled). Sessions go too: de-admining
   someone who still holds a live cookie is only half the job.

   Run: npm run admin:revoke -w server -- <user-id | recovery-code> */
import { eq } from 'drizzle-orm';
import { revokeAllSessions } from '../src/auth/tokens.js';
import { db, pool } from '../src/db/client.js';
import { users } from '../src/db/schema.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) throw new Error('usage: npm run admin:revoke -w server -- <user-id | recovery-code>');

  const where = UUID_RE.test(arg) ? eq(users.id, arg) : eq(users.recoveryCode, arg.toLowerCase());
  const rows = await db
    .update(users)
    .set({ isAdmin: false })
    .where(where)
    .returning({ id: users.id, name: users.name, email: users.email, isAdmin: users.isAdmin });

  if (rows.length === 0) {
    console.log('no user matched');
    return;
  }
  console.log('admin revoked:', rows);

  for (const row of rows) {
    await revokeAllSessions(row.id);
    console.log(`sessions and magic links revoked for ${row.id}`);
  }

  const remaining = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.isAdmin, true));
  console.log(`remaining admins (${remaining.length}):`, remaining);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
