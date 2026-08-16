import { aliasedTable, and, asc, desc, eq, gt, gte, inArray, isNull, ne, or } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { conversations, listings, matches, messages, users } from '../db/schema.js';
import { mintMagicToken } from '../auth/magic.js';
import { sendEmail } from '../email/ses.js';
import { listingTypeLabel } from '../email/layout.js';
import { renderDigest, type DigestConversation, type DigestMatch } from '../email/templates.js';
import { matchingConfig } from '../lib/settings.js';

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
      photoId: messages.photoId,
      sharedEmail: messages.sharedEmail,
      sharedPhone: messages.sharedPhone,
      createdAt: messages.createdAt,
      senderName: sender.name,
      listingName: listings.name,
      listingType: listings.type,
      listingPassengerSpace: listings.passengerSpace,
      listingOwnerId: listings.userId,
      listingDate: listings.travelDate,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(listings, eq(conversations.listingId, listings.id))
    .innerJoin(sender, eq(messages.senderUserId, sender.id))
    .where(
      and(
        isNull(messages.emailedAt),
        // Already read in the app → nothing to notify about. (Rows stay
        // un-emailed forever, which is fine: this readAt filter keeps them out.)
        isNull(messages.readAt),
        ne(messages.senderUserId, user.id),
        or(eq(conversations.initiatorUserId, user.id), eq(listings.userId, user.id)),
      ),
    )
    .orderBy(asc(messages.createdAt))
    .limit(100);

  const driverListing = aliasedTable(listings, 'driver_listing');
  const riderListing = aliasedTable(listings, 'rider_listing');
  const liveSide = (side: typeof driverListing) =>
    and(isNull(side.cancelledAt), isNull(side.deletedAt), isNull(side.hiddenAt), gt(side.expiresAt, new Date()));
  const unnotifiedMatches = await db
    .select({ match: matches, driver: driverListing, rider: riderListing })
    .from(matches)
    .innerJoin(driverListing, eq(matches.driverListingId, driverListing.id))
    .innerJoin(riderListing, eq(matches.riderListingId, riderListing.id))
    .where(
      and(
        or(
          and(eq(driverListing.userId, user.id), isNull(matches.notifiedDriverAt)),
          and(eq(riderListing.userId, user.id), isNull(matches.notifiedRiderAt)),
        ),
        liveSide(driverListing),
        liveSide(riderListing),
        // Weak matches stay browsable in the app but never earn an email. They
        // are simply not fetched, so they also keep their notified*At null and
        // become emailable if the threshold is later lowered. A user's personal
        // floor can only tighten the global one, never loosen it.
        gte(matches.score, Math.max(matchingConfig('minEmailScore'), user.matchEmailMinScore ?? 0)),
        user.matchEmailSameDayOnly ? eq(driverListing.travelDate, riderListing.travelDate) : undefined,
      ),
    )
    .orderBy(desc(matches.score))
    .limit(100);
  const topMatches = unnotifiedMatches.slice(0, 5);
  const extraMatchCount = unnotifiedMatches.length - topMatches.length;

  if (unsent.length === 0 && topMatches.length === 0) return;

  const friendlyDate = (d: string): string => {
    const [y, mo, day] = d.split('-').map(Number);
    return new Date(y!, mo! - 1, day!).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const byConversation = new Map<string, DigestConversation>();
  for (const m of unsent) {
    let group = byConversation.get(m.conversationId);
    if (!group) {
      const kind = listingTypeLabel(m.listingType, m.listingPassengerSpace);
      const context =
        m.listingOwnerId === user.id
          ? `your ${kind} · ${friendlyDate(m.listingDate)}`
          : `${m.listingName}'s ${kind} · ${friendlyDate(m.listingDate)}`;
      group = {
        conversationId: m.conversationId,
        counterpartName: m.senderName ?? 'A burner',
        context,
        messages: [],
      };
      byConversation.set(m.conversationId, group);
    }
    group.messages.push({
      senderName: m.senderName ?? 'A burner',
      body: m.body,
      hasPhoto: m.photoId !== null,
      sharedEmail: m.sharedEmail,
      sharedPhone: m.sharedPhone,
      createdAt: m.createdAt,
    });
  }

  const activeListings = await db
    .select({ id: listings.id, direction: listings.direction })
    .from(listings)
    .where(and(eq(listings.userId, user.id), isNull(listings.deletedAt), isNull(listings.cancelledAt)))
    .limit(10);

  const newMatches: DigestMatch[] = topMatches.map(({ match, driver, rider }) => {
    const mineIsDriver = driver.userId === user.id;
    const mine = mineIsDriver ? driver : rider;
    const theirs = mineIsDriver ? rider : driver;
    return {
      listingId: theirs.id,
      myListingName: mine.name,
      theirName: theirs.name,
      theirType: theirs.type,
      theirPassengerSpace: theirs.passengerSpace,
      travelDate: theirs.travelDate,
      location: theirs.locationRaw,
      score: match.score,
    };
  });

  const magicToken = await mintMagicToken(user.id);
  const rendered = renderDigest({
    appOrigin,
    magicToken,
    recipientName: user.name,
    conversations: Array.from(byConversation.values()),
    totalNewMessages: unsent.length,
    newMatches,
    extraMatchCount,
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
  if (unsent.length > 0) {
    await db
      .update(messages)
      .set({ emailedAt: now })
      .where(inArray(messages.id, unsent.map((m) => m.messageId)));
  }
  // Stamp EVERY fetched match, not just the five rendered — the email covers
  // the rest with a "+N more" line, and leaving them unstamped would re-fire
  // this digest every tick until the backlog drained, one drip per period.
  for (const { match, driver } of unnotifiedMatches) {
    const mineIsDriver = driver.userId === user.id;
    await db
      .update(matches)
      .set(mineIsDriver ? { notifiedDriverAt: now } : { notifiedRiderAt: now })
      .where(
        and(
          eq(matches.driverListingId, match.driverListingId),
          eq(matches.riderListingId, match.riderListingId),
        ),
      );
  }
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
