import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireUser } from '../auth/middleware.js';
import { db } from '../db/client.js';
import { listings, matches, users } from '../db/schema.js';
import { matchingConfig } from '../lib/settings.js';
import type { MatchReasons } from '../matching/score.js';
import { toListingDto } from './listings.js';

type ListingRow = typeof listings.$inferSelect;
type MatchRow = typeof matches.$inferSelect;

function liveListingFilter(now: Date) {
  return and(
    isNull(listings.cancelledAt),
    isNull(listings.deletedAt),
    isNull(listings.hiddenAt),
    gt(listings.expiresAt, now),
  );
}

function toMatchDto(match: MatchRow, mine: ListingRow, theirs: ListingRow, viewerId: string, theirAvatarVersion: number | null) {
  return {
    driverListingId: match.driverListingId,
    riderListingId: match.riderListingId,
    score: match.score,
    reasons: match.reasons as MatchReasons,
    computedAt: match.computedAt.toISOString(),
    myListing: { id: mine.id, type: mine.type, name: mine.name, travelDate: mine.travelDate },
    listing: toListingDto(theirs, viewerId, theirAvatarVersion),
  };
}

async function matchesForListings(myListings: ListingRow[], viewerId: string) {
  if (myListings.length === 0) return [];
  const now = new Date();
  const myIds = myListings.map((l) => l.id);
  const byId = new Map(myListings.map((l) => [l.id, l]));

  const rows = await db
    .select()
    .from(matches)
    .where(or(inArray(matches.driverListingId, myIds), inArray(matches.riderListingId, myIds)))
    .orderBy(desc(matches.score))
    .limit(100);

  const counterpartIds = rows.map((m) => (byId.has(m.driverListingId) ? m.riderListingId : m.driverListingId));
  if (counterpartIds.length === 0) return [];

  const counterpartRows = await db
    .select()
    .from(listings)
    .where(and(inArray(listings.id, counterpartIds), liveListingFilter(now)));
  const counterparts = new Map(counterpartRows.map((l) => [l.id, l]));
  const ownerIds = [...new Set(counterpartRows.map((l) => l.userId))];
  const avatarRows = ownerIds.length
    ? await db
        .select({ id: users.id, at: users.avatarUpdatedAt })
        .from(users)
        .where(inArray(users.id, ownerIds))
    : [];
  const avatarByOwner = new Map(avatarRows.map((r) => [r.id, r.at?.getTime() ?? null]));

  const out = [];
  for (const m of rows) {
    const mine = byId.get(m.driverListingId) ?? byId.get(m.riderListingId);
    const theirs = counterparts.get(byId.has(m.driverListingId) ? m.riderListingId : m.driverListingId);
    if (mine && theirs) out.push(toMatchDto(m, mine, theirs, viewerId, avatarByOwner.get(theirs.userId) ?? null));
  }
  return out;
}

export const matchRoutes = new Hono();

matchRoutes.get('/my/matches', async (c) => {
  const user = requireUser(c);
  const mine = await db
    .select()
    .from(listings)
    .where(and(eq(listings.userId, user.id), liveListingFilter(new Date())));
  // Everything is returned; emailFloor only tells the client where the
  // "lower-quality, won't be emailed about" cut sits so it can group them.
  return c.json({
    matches: await matchesForListings(mine, user.id),
    emailFloor: matchingConfig('minEmailScore'),
  });
});

matchRoutes.get('/listings/:id/matches', async (c) => {
  const user = requireUser(c);
  const id = c.req.param('id');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  const listing = rows[0];
  if (!listing || listing.deletedAt) throw new HTTPException(404, { message: 'not_found' });
  if (listing.userId !== user.id && !user.isAdmin) throw new HTTPException(403, { message: 'forbidden' });
  return c.json({ matches: await matchesForListings([listing], user.id) });
});
