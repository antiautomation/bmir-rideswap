import { and, eq, gt, isNull, ne, notInArray, or, sql } from 'drizzle-orm';
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
  /** Present when location credit came from corridor proximity rather than
   *  name similarity: extra driving miles to pick this rider up en route. */
  detourMi?: number;
}

// Black Rock City (the Man). Both directions share the same corridor geometry:
// picking someone up on the way out costs the same extra miles as dropping
// them off on the way home.
const BRC = { lat: 40.7864, lng: -119.2065 };

const EARTH_RADIUS_MI = 3958.8;

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

/** Corridor location credit: how many extra miles the driver adds by routing
 *  through the rider's city. Great-circle triangle — an approximation of road
 *  distance, but detour deltas track real routes closely enough for scoring.
 *  Never beats an exact city match (30); comfortably beats weak name fuzz. */
function corridorPoints(detourMi: number): number {
  if (detourMi <= 15) return 26;
  if (detourMi <= 40) return 22;
  if (detourMi <= 80) return 15;
  if (detourMi <= 150) return 8;
  return 0;
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
  let detourMi: number | undefined;
  if (driver.locationNorm === rider.locationNorm) {
    location = 30;
  } else if (
    FLEXIBLE_LOCATION_WORDS.some((w) => driver.locationNorm.includes(w) || rider.locationNorm.includes(w))
  ) {
    location = 15;
  } else {
    const nameScore = Math.max(0, Math.round(locationSimilarity * 30));
    let corridorScore = 0;
    if (
      driver.originLat != null &&
      driver.originLng != null &&
      rider.originLat != null &&
      rider.originLng != null
    ) {
      const direct = haversineMiles(driver.originLat, driver.originLng, BRC.lat, BRC.lng);
      const viaRider =
        haversineMiles(driver.originLat, driver.originLng, rider.originLat, rider.originLng) +
        haversineMiles(rider.originLat, rider.originLng, BRC.lat, BRC.lng);
      const detour = Math.max(0, viaRider - direct);
      corridorScore = corridorPoints(detour);
      if (corridorScore > nameScore) detourMi = Math.round(detour);
    }
    location = Math.max(nameScore, corridorScore);
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
  const reasons: MatchReasons = { date, location, capacity, time, fresh };
  if (detourMi !== undefined) reasons.detourMi = detourMi;
  return { score, reasons };
}

function isLive(l: ListingRow, now: number): boolean {
  return !l.cancelledAt && !l.deletedAt && !l.hiddenAt && l.expiresAt.getTime() > now;
}

export async function recomputeMatchesForListing(listing: ListingRow): Promise<void> {
  const now = Date.now();
  const sideEq =
    listing.type === 'driver'
      ? eq(matches.driverListingId, listing.id)
      : eq(matches.riderListingId, listing.id);

  if (!isLive(listing, now)) {
    await db.delete(matches).where(sideEq);
    return;
  }

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

  // Replace this listing's match set without nuking notification state: pairs
  // that survive the recompute are updated in place (notified*At untouched, so
  // nobody gets re-emailed about a match they already saw), pairs that no
  // longer qualify are deleted.
  const otherCol = listing.type === 'driver' ? matches.riderListingId : matches.driverListingId;
  const keepIds = rows.map((r) => (listing.type === 'driver' ? r.riderListingId : r.driverListingId));
  await db.delete(matches).where(keepIds.length > 0 ? and(sideEq, notInArray(otherCol, keepIds)) : sideEq);

  if (rows.length > 0) {
    await db
      .insert(matches)
      .values(rows)
      .onConflictDoUpdate({
        target: [matches.driverListingId, matches.riderListingId],
        set: {
          score: sql`excluded.score`,
          reasons: sql`excluded.reasons`,
          computedAt: new Date(),
        },
      });
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
