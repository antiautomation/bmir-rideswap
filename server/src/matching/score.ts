import { and, eq, gt, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { listings, matches } from '../db/schema.js';
import { TIME_SLOT_RE } from '../lib/listingRules.js';

type ListingRow = typeof listings.$inferSelect;

const BELONGINGS_RANK: Record<string, number> = { minimal: 1, standard: 2, substantial: 3, extensive: 4 };
const FLEXIBLE_LOCATION_WORDS = ['flexible', 'anywhere', 'any', 'tbd'];
const MIN_SCORE = 35;
const MAX_DATE_DELTA_DAYS = 2;

export interface MatchReasons {
  date: number;
  location: number;
  capacity: number;
  time: number;
  fresh: number;
}

function dateDeltaDays(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

function slotStartHour(slot: string): number | null {
  const m = TIME_SLOT_RE.exec(slot);
  return m ? Number(m[1]) : null;
}

export function scorePair(
  driver: ListingRow,
  rider: ListingRow,
  locationSimilarity: number,
  now: number = Date.now(),
): { score: number; reasons: MatchReasons } | null {
  const delta = dateDeltaDays(driver.travelDate, rider.travelDate);
  if (delta > MAX_DATE_DELTA_DAYS) return null;

  const cargo = BELONGINGS_RANK[driver.cargoSpace ?? ''] ?? 0;
  const stuff = BELONGINGS_RANK[rider.riderStuff ?? ''] ?? 0;
  if (cargo === 0 || stuff === 0 || stuff > cargo) return null;

  const date = delta === 0 ? 40 : delta <= 1 ? 25 : 12;

  let location: number;
  if (driver.locationNorm === rider.locationNorm) {
    location = 30;
  } else if (
    FLEXIBLE_LOCATION_WORDS.some((w) => driver.locationNorm.includes(w) || rider.locationNorm.includes(w))
  ) {
    location = 15;
  } else {
    location = Math.max(0, Math.round(locationSimilarity * 30));
  }

  const fit = cargo - stuff;
  const capacity = fit === 0 ? 15 : fit === 1 ? 12 : 8;

  const dStart = slotStartHour(driver.timeSlot);
  const rStart = slotStartHour(rider.timeSlot);
  let time: number;
  if (dStart === null && rStart === null) time = 10;
  else if (dStart === null || rStart === null) time = 7;
  else time = Math.abs(dStart - rStart) <= 3 ? 10 : 0;

  const fresh =
    now - driver.createdAt.getTime() < 48 * 3600_000 || now - rider.createdAt.getTime() < 48 * 3600_000 ? 5 : 0;

  const score = date + location + capacity + time + fresh;
  if (score < MIN_SCORE) return null;
  return { score, reasons: { date, location, capacity, time, fresh } };
}

function isLive(l: ListingRow, now: number): boolean {
  return !l.cancelledAt && !l.deletedAt && !l.hiddenAt && l.expiresAt.getTime() > now;
}

export async function recomputeMatchesForListing(listing: ListingRow): Promise<void> {
  const now = Date.now();

  await db
    .delete(matches)
    .where(
      listing.type === 'driver'
        ? eq(matches.driverListingId, listing.id)
        : eq(matches.riderListingId, listing.id),
    );

  if (!isLive(listing, now)) return;

  const counterpartType = listing.type === 'driver' ? 'rider' : 'driver';
  const candidates = await db
    .select({
      row: listings,
      similarity: sql<number>`similarity(${listings.locationNorm}, ${listing.locationNorm})`,
    })
    .from(listings)
    .where(
      and(
        eq(listings.type, counterpartType),
        eq(listings.direction, listing.direction),
        ne(listings.userId, listing.userId),
        isNull(listings.cancelledAt),
        isNull(listings.deletedAt),
        isNull(listings.hiddenAt),
        gt(listings.expiresAt, new Date(now)),
      ),
    )
    .limit(1000);

  const rows: (typeof matches.$inferInsert)[] = [];
  for (const candidate of candidates) {
    const driver = listing.type === 'driver' ? listing : candidate.row;
    const rider = listing.type === 'rider' ? listing : candidate.row;
    const result = scorePair(driver, rider, candidate.similarity ?? 0, now);
    if (result) {
      rows.push({
        driverListingId: driver.id,
        riderListingId: rider.id,
        score: result.score,
        reasons: result.reasons,
      });
    }
  }

  if (rows.length > 0) {
    await db.insert(matches).values(rows).onConflictDoNothing();
  }
}

export async function pruneDeadMatches(): Promise<void> {
  const driverSide = db
    .select({ id: listings.id })
    .from(listings)
    .where(
      and(
        eq(listings.id, matches.driverListingId),
        isNull(listings.cancelledAt),
        isNull(listings.deletedAt),
        isNull(listings.hiddenAt),
        gt(listings.expiresAt, new Date()),
      ),
    );
  const riderSide = db
    .select({ id: listings.id })
    .from(listings)
    .where(
      and(
        eq(listings.id, matches.riderListingId),
        isNull(listings.cancelledAt),
        isNull(listings.deletedAt),
        isNull(listings.hiddenAt),
        gt(listings.expiresAt, new Date()),
      ),
    );
  await db.delete(matches).where(or(sql`NOT EXISTS ${driverSide}`, sql`NOT EXISTS ${riderSide}`));
}
