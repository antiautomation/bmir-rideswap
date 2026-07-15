import { aliasedTable, and, asc, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { conversations, listings, messages, users } from '../db/schema.js';
import { mintMagicToken } from '../auth/magic.js';
import { sendEmail } from '../email/ses.js';
import { renderDigest, type DigestConversation } from '../email/templates.js';

const DIGEST_LOCK_KEY = 727002;
const HOUR_MS = 3600 * 1000;

type UserRow = typeof users.$inferSelect;

function isDue(user: UserRow, now: number): boolean {
  if (user.digestFrequency === 'off' || !user.email) return false;
  if (user.bannedAt) return false;
  if (user.digestFrequency === 'instant') return true;
  const last = user.lastDigestAt?.getTime() ?? 0;
  if (user.digestFrequency === 'hourly') return now - last >= HOUR_MS;
  return now - last >= 24 * HOUR_MS;
}

async function digestForUser(user: UserRow, appOrigin: string): Promise<void> {
  const sender = aliasedTable(users, 'sender');
  const unsent = await db
    .select({
      messageId: messages.id,
      conversationId: messages.conversationId,
      body: messages.body,
      sharedEmail: messages.sharedEmail,
      sharedPhone: messages.sharedPhone,
      createdAt: messages.createdAt,
      senderName: sender.name,
      listingName: listings.name,
      listingType: listings.type,
      listingId: listings.id,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(listings, eq(conversations.listingId, listings.id))
    .innerJoin(sender, eq(messages.senderUserId, sender.id))
    .where(
      and(
        isNull(messages.emailedAt),
        ne(messages.senderUserId, user.id),
        or(eq(conversations.initiatorUserId, user.id), eq(listings.userId, user.id)),
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(100);

  if (unsent.length === 0) return;

  const byConversation = new Map<string, DigestConversation>();
  for (const m of unsent) {
    let group = byConversation.get(m.conversationId);
    if (!group) {
      group = {
        conversationId: m.conversationId,
        counterpartName: m.senderName ?? 'A burner',
        listingName: m.listingName,
        listingType: m.listingType,
        messages: [],
      };
      byConversation.set(m.conversationId, group);
    }
    group.messages.push({
      senderName: m.senderName ?? 'A burner',
      body: m.body,
      sharedEmail: m.sharedEmail,
      sharedPhone: m.sharedPhone,
      createdAt: m.createdAt,
    });
  }

  const activeListings = await db
    .select({ id: listings.id, name: listings.name })
    .from(listings)
    .where(and(eq(listings.userId, user.id), isNull(listings.deletedAt), isNull(listings.cancelledAt)))
    .limit(10);

  const magicToken = await mintMagicToken(user.id);
  const rendered = renderDigest({
    appOrigin,
    magicToken,
    recipientName: user.name,
    conversations: Array.from(byConversation.values()),
    totalNewMessages: unsent.length,
    activeListings,
  });

  const result = await sendEmail({
    userId: user.id,
    to: user.email!,
    kind: 'digest',
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  // Suppressed recipients still get marked: retrying every tick forever helps no one.
  void result;
  const now = new Date();
  await db
    .update(messages)
    .set({ emailedAt: now })
    .where(inArray(messages.id, unsent.map((m) => m.messageId)));
  await db.update(users).set({ lastDigestAt: now }).where(eq(users.id, user.id));
}

export async function runDigestTick(): Promise<void> {
  const lockClient = await pool.connect();
  try {
    const lock = await lockClient.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock(${DIGEST_LOCK_KEY}) AS locked`,
    );
    if (!lock.rows[0]?.locked) return;

    try {
      const appOrigin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
      const now = Date.now();
      const candidates = await db
        .select()
        .from(users)
        .where(and(ne(users.digestFrequency, 'off'), isNull(users.bannedAt)));

      for (const user of candidates) {
        if (!isDue(user, now)) continue;
        try {
          await digestForUser(user, appOrigin);
        } catch (err) {
          // One bad recipient must not sink the whole tick; unmarked rows retry next time.
          console.error(`digest failed for user ${user.id}`, err);
        }
      }
    } finally {
      await lockClient.query(`SELECT pg_advisory_unlock(${DIGEST_LOCK_KEY})`);
    }
  } finally {
    lockClient.release();
  }
}
