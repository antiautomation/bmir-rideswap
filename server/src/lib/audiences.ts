// Dynamic audiences: named queries over the live v2 userbase that a contact list
// can be built from and re-refreshed later, instead of a frozen import.
//
// Every audience returns real accounts with a usable email, excluding banned
// users. Materialising one upserts a `contacts` row per user (linked by user_id)
// so unsubscribe and suppression work identically for imported and in-app
// addresses.

import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { contactLists, users } from '../db/schema.js';
import { replaceListMembers, upsertContacts } from './contacts.js';

export interface AudienceDef {
  key: string;
  label: string;
  description: string;
  /** Extra predicate ANDed onto the base "real, mailable account" filter. */
  where: ReturnType<typeof sql> | null;
}

const HAS_LISTING = sql`EXISTS (SELECT 1 FROM listings l WHERE l.user_id = users.id)`;
const HAS_LIVE_LISTING = sql`EXISTS (
  SELECT 1 FROM listings l
  WHERE l.user_id = users.id
    AND l.deleted_at IS NULL AND l.cancelled_at IS NULL AND l.hidden_at IS NULL
    AND l.expires_at > now()
)`;

export const AUDIENCES: AudienceDef[] = [
  {
    key: 'users_all',
    label: 'All users with an email',
    description: 'Every account that has an email address and is not banned.',
    where: null,
  },
  {
    key: 'users_posted',
    label: 'Users who have ever posted',
    description: 'Accounts with at least one listing, live or not.',
    where: HAS_LISTING,
  },
  {
    key: 'users_active_listing',
    label: 'Users with a live listing',
    description: 'Accounts with a listing that is currently on the board.',
    where: HAS_LIVE_LISTING,
  },
  {
    key: 'users_never_posted',
    label: 'Users who never posted',
    description: 'Signed up, gave an email, never put a ride up. Good for a nudge.',
    where: sql`NOT ${HAS_LISTING}`,
  },
  {
    key: 'users_drivers',
    label: 'Drivers',
    description: 'Accounts whose listings include at least one ride offer.',
    where: sql`EXISTS (SELECT 1 FROM listings l WHERE l.user_id = users.id AND l.type = 'driver')`,
  },
  {
    key: 'users_riders',
    label: 'Riders',
    description: 'Accounts whose listings include at least one ride request.',
    where: sql`EXISTS (SELECT 1 FROM listings l WHERE l.user_id = users.id AND l.type = 'rider')`,
  },
];

export function findAudience(key: string): AudienceDef | undefined {
  return AUDIENCES.find((a) => a.key === key);
}

/** Resolve an audience to accounts, without writing anything. */
export async function resolveAudience(key: string): Promise<{ email: string; name: string | null; id: string }[]> {
  const audience = findAudience(key);
  if (!audience) throw new Error(`unknown_audience:${key}`);

  const base = sql`${users.email} IS NOT NULL AND ${users.bannedAt} IS NULL`;
  const where = audience.where ? sql`${base} AND ${audience.where}` : base;

  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(where);

  return rows
    .filter((r): r is { id: string; email: string; name: string | null } => r.email !== null)
    .map((r) => ({ id: r.id, email: r.email.toLowerCase(), name: r.name }));
}

/** Count only — used to preview an audience before creating a list from it. */
export async function countAudience(key: string): Promise<number> {
  return (await resolveAudience(key)).length;
}

/**
 * Recompute a dynamic list's membership from its audience query. Idempotent, and
 * safe to call right before a send so the list is never stale.
 */
export async function refreshDynamicList(listId: string): Promise<{ members: number }> {
  const [list] = await db.select().from(contactLists).where(eq(contactLists.id, listId)).limit(1);
  if (!list) throw new Error('list_not_found');
  if (list.kind !== 'dynamic' || !list.query) throw new Error('list_not_dynamic');

  const people = await resolveAudience(list.query);
  await upsertContacts(
    people.map((p) => ({ email: p.email, name: p.name })),
    'users',
  );
  return replaceListMembers(
    listId,
    people.map((p) => p.email),
  );
}
