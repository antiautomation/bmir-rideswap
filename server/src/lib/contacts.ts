// Contact + list plumbing shared by every import path (v1 Firestore, pasted
// text, dynamic user audiences) and by the campaign sender.

import { randomBytes } from 'node:crypto';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { contactListMembers, contactLists, contacts, users, type ContactMeta } from '../db/schema.js';
import { excludeReasonFor } from './contactParse.js';

export function newUnsubscribeToken(): string {
  return `un_${randomBytes(24).toString('base64url')}`;
}

export interface ContactInput {
  email: string;
  name?: string | null;
  meta?: ContactMeta;
}

export interface UpsertResult {
  inserted: number;
  updated: number;
  /** Addresses auto-held-back on insert, by reason prefix. */
  excluded: Record<string, number>;
}

const BATCH = 250;

/**
 * Insert or refresh contacts.
 *
 * Non-destructive on conflict: an existing row keeps its unsubscribe token, its
 * unsubscribed_at, and any exclusion already recorded. Only the descriptive
 * fields are refreshed, and a name is never overwritten with null.
 */
export async function upsertContacts(
  rawInputs: ContactInput[],
  source: string,
): Promise<UpsertResult> {
  // Deduplicate before hitting Postgres: ON CONFLICT DO UPDATE raises a
  // cardinality violation if one statement tries to update the same row twice,
  // and callers legitimately hand us repeats — `users.email` is not unique, so
  // two accounts can share an address and land here as two entries.
  const merged = new Map<string, ContactInput>();
  for (const input of rawInputs) {
    const key = input.email.trim().toLowerCase();
    if (key === '') continue;
    const prev = merged.get(key);
    merged.set(key, {
      email: key,
      name: input.name ?? prev?.name ?? null,
      meta: { ...prev?.meta, ...input.meta },
    });
  }
  const inputs = [...merged.values()];
  if (inputs.length === 0) return { inserted: 0, updated: 0, excluded: {} };

  const emails = inputs.map((i) => i.email);
  const existing = new Set(
    (
      await db
        .select({ email: contacts.email })
        .from(contacts)
        .where(inArray(contacts.email, emails))
    ).map((r) => r.email.toLowerCase()),
  );

  // Link addresses that already belong to a v2 account.
  const userByEmail = new Map(
    (
      await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(and(isNotNull(users.email), inArray(users.email, emails)))
    ).map((r) => [(r.email ?? '').toLowerCase(), r.id]),
  );

  const excluded: Record<string, number> = {};
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < inputs.length; i += BATCH) {
    const slice = inputs.slice(i, i + BATCH);
    const rows = slice.map((c) => {
      const reason = excludeReasonFor(c.email);
      if (reason && !existing.has(c.email.toLowerCase())) {
        const key = reason.split(':')[0]!;
        excluded[key] = (excluded[key] ?? 0) + 1;
      }
      return {
        email: c.email,
        name: c.name ?? null,
        userId: userByEmail.get(c.email.toLowerCase()) ?? null,
        source,
        meta: c.meta ?? {},
        unsubscribeToken: newUnsubscribeToken(),
        excludedAt: reason ? new Date() : null,
        excludeReason: reason,
      };
    });

    const result = await db
      .insert(contacts)
      .values(rows)
      .onConflictDoUpdate({
        target: contacts.email,
        set: {
          // Never blank out a name we already have with an anonymous re-import.
          name: sql`COALESCE(excluded.name, ${contacts.name})`,
          userId: sql`COALESCE(excluded.user_id, ${contacts.userId})`,
          source: sql`excluded.source`,
          // Merge so a paste re-import can't wipe the v1 provenance facts.
          meta: sql`${contacts.meta} || excluded.meta`,
          excludedAt: sql`COALESCE(${contacts.excludedAt}, excluded.excluded_at)`,
          excludeReason: sql`COALESCE(${contacts.excludeReason}, excluded.exclude_reason)`,
          updatedAt: new Date(),
        },
      })
      .returning({ email: contacts.email });

    for (const r of result) {
      if (existing.has(r.email.toLowerCase())) updated++;
      else inserted++;
    }
  }

  return { inserted, updated, excluded };
}

/** Add addresses to a list. Rows must already exist in `contacts`. */
export async function addToList(listId: string, rawEmails: string[]): Promise<{ added: number }> {
  const emails = [...new Set(rawEmails.map((e) => e.trim().toLowerCase()).filter((e) => e !== ''))];
  if (emails.length === 0) return { added: 0 };
  let added = 0;
  for (let i = 0; i < emails.length; i += BATCH) {
    const rows = await db
      .insert(contactListMembers)
      .values(emails.slice(i, i + BATCH).map((email) => ({ listId, email })))
      .onConflictDoNothing()
      .returning({ email: contactListMembers.email });
    added += rows.length;
  }
  return { added };
}

/** Replace a list's membership wholesale — used when refreshing a dynamic list. */
export async function replaceListMembers(listId: string, emails: string[]): Promise<{ members: number }> {
  await db.delete(contactListMembers).where(eq(contactListMembers.listId, listId));
  await addToList(listId, emails);
  await db.update(contactLists).set({ refreshedAt: new Date() }).where(eq(contactLists.id, listId));
  return { members: emails.length };
}

/** Sendable = on the list, not unsubscribed, not held back. */
export async function sendableEmailsForList(listId: string): Promise<string[]> {
  const rows = await db
    .select({ email: contacts.email })
    .from(contactListMembers)
    .innerJoin(contacts, eq(contactListMembers.email, contacts.email))
    .where(
      and(
        eq(contactListMembers.listId, listId),
        sql`${contacts.unsubscribedAt} IS NULL`,
        sql`${contacts.excludedAt} IS NULL`,
      ),
    );
  return rows.map((r) => r.email);
}
