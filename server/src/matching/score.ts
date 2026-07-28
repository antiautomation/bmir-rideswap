import { and, eq, gt, isNull, ne, notInArray, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { listings, matches } from '../db/schema.js';
import { TIME_SLOT_RE } from '../lib/listingRules.js';
import { matchingConfig } from '../lib/settings.js';

type ListingRow = typeof listings.$inferSelect;

const BELONGINGS_RANK: Record<string, number> = { minimal: 1, standard: 2, substantial: 3, extensive: 4 };
const FLEXIBLE_LOCATION_WORDS = ['flexible', 'anywhere', 'any', 'tbd'];
const MAX_DATE_DELTA_DAYS = 2;

/* En-route pickup model (to_brc only). A driver heading to BRC collects a
   corridor rider partway along the leg, and on a long leg that pickup lands a
   calendar day or more after the driver's stated departure date — so comparing
   the two travel dates raw is fiction. Best-effort assumption: nobody drives
   more than ~8 hours in a day, at an average ~55 mph. */
const AVG_MPH = 55;
const DRIVING_HOURS_PER_DAY = 8;
/** Below this the pickup is same-day and the departure slots are comparable. */
const LOCAL_PICKUP_HOURS = 4;

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export interface MatchReasons {
  date: number;
  location: number;
  capacity: number;
  time: number;
  fresh: number;
  /** Whole days between the two travel dates (0, 1 or 2). Lets the client label
   *  date pills from the actual gap instead of reverse-engineering it from the
   *  points, which move with the admin-tunable weights. */
  dateDelta: number;
  /** Cargo tier minus rider-stuff tier: 0 = exact fit, 1 = a little room to
   *  spare, 2+ = lots. Same purpose as dateDelta — the client labels the pill
   *  from the fit itself, not from a points threshold that admin tuning moves. */
  capacityFit: number;
  /** 'aligned' = both flexible or slot starts within 3h, 'partial' = exactly one
   *  side flexible, 'none' = slots don't overlap. */
  timing: 'aligned' | 'partial' | 'none';
  /** Whole days the en-route pickup falls after the driver's departure date on a
   *  long to_brc leg. Present only when >= 1 — dateDelta is already measured
   *  against the effective pickup date, this just explains why. */
  pickupDaysLater?: number;
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
 *  Scored as a fraction of an exact city match, so it tracks the tunable
 *  locationPointsExact: the best tier is 0.87, so corridor proximity never beats
 *  an exact match, but it comfortably beats weak name fuzz. */
function corridorPoints(detourMi: number, exact: number): number {
  if (detourMi <= 15) return Math.round(0.87 * exact);
  if (detourMi <= 40) return Math.round(0.73 * exact);
  if (detourMi <= 80) return Math.round(0.5 * exact);
  if (detourMi <= 150) return Math.round(0.27 * exact);
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
  // How long the driver is on the road before reaching the rider's city. Only
  // meaningful for to_brc: on the way home both parties leave BRC together, so
  // there is no en-route pickup to model. Without coords we can't measure the
  // leg at all and fall back to the raw date comparison.
  const legHours =
    driver.direction === 'to_brc' &&
    driver.originLat != null &&
    driver.originLng != null &&
    rider.originLat != null &&
    rider.originLng != null
      ? haversineMiles(driver.originLat, driver.originLng, rider.originLat, rider.originLng) / AVG_MPH
      : null;
  const pickupDaysLater = legHours === null ? 0 : Math.floor(legHours / DRIVING_HOURS_PER_DAY);

  // Compare the rider's date against when the driver actually reaches them, not
  // against the driver's departure date.
  const pickupDate = pickupDaysLater > 0 ? addDays(driver.travelDate, pickupDaysLater) : driver.travelDate;
  const delta = dateDeltaDays(pickupDate, rider.travelDate);
  if (delta > MAX_DATE_DELTA_DAYS) return null;

  const cargo = BELONGINGS_RANK[driver.cargoSpace ?? ''] ?? 0;
  const stuff = BELONGINGS_RANK[rider.riderStuff ?? ''] ?? 0;
  if (cargo === 0 || stuff === 0 || stuff > cargo) return null;

  const dateDelta = Math.round(delta);
  const date =
    dateDelta === 0
      ? matchingConfig('datePointsSameDay')
      : dateDelta === 1
        ? matchingConfig('datePointsOneDayApart')
        : matchingConfig('datePointsTwoDaysApart');

  const locationExact = matchingConfig('locationPointsExact');
  let location: number;
  let detourMi: number | undefined;
  if (driver.locationNorm === rider.locationNorm) {
    location = locationExact;
  } else if (
    FLEXIBLE_LOCATION_WORDS.some((w) => driver.locationNorm.includes(w) || rider.locationNorm.includes(w))
  ) {
    location = Math.round(0.5 * locationExact);
  } else {
    const nameScore = Math.max(0, Math.round(locationSimilarity * locationExact));
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
      corridorScore = corridorPoints(detour, locationExact);
      if (corridorScore > nameScore) detourMi = Math.round(detour);
    }
    location = Math.max(nameScore, corridorScore);
  }

  const capacityFit = cargo - stuff;
  const capacity =
    capacityFit === 0
      ? matchingConfig('capacityPointsPerfect')
      : capacityFit === 1
        ? matchingConfig('capacityPointsGood')
        : matchingConfig('capacityPointsRoomy');

  const timeAligned = matchingConfig('timePointsAligned');
  let timing: MatchReasons['timing'];
  let time: number;
  if (legHours !== null && legHours > DRIVING_HOURS_PER_DAY) {
    // Multi-day leg: the driver's departure slot says nothing about what hour
    // they roll through the rider's city. Flat partial credit, slots ignored.
    timing = 'partial';
    time = Math.round(0.5 * timeAligned);
  } else {
    const dStart = slotStartHour(driver.timeSlot);
    const rStart = slotStartHour(rider.timeSlot);
    if (dStart === null && rStart === null) timing = 'aligned';
    else if (dStart === null || rStart === null) timing = 'partial';
    else timing = Math.abs(dStart - rStart) <= 3 ? 'aligned' : 'none';

    // A half-day leg still lets the slots be compared, but a nominal match is
    // worth less than a genuinely local pickup: the arrival hour has drifted,
    // and the ride itself is a different proposition (gas splits, a driver who
    // has already been alone for hours).
    if (timing === 'aligned' && legHours !== null && legHours > LOCAL_PICKUP_HOURS) timing = 'partial';
    time = timing === 'aligned' ? timeAligned : timing === 'partial' ? Math.round(0.7 * timeAligned) : 0;
  }

  const fresh =
    now - driver.createdAt.getTime() < 48 * 3600_000 || now - rider.createdAt.getTime() < 48 * 3600_000
      ? matchingConfig('freshPoints')
      : 0;

  // Hard cap on a date mismatch: strong location/gear/time credit must never
  // float a wrong-day pair into "great match" territory. The cap applies to the
  // total, after every dimension is summed.
  let score = date + location + capacity + time + fresh;
  if (dateDelta === 1) score = Math.min(score, matchingConfig('scoreCapOneDayApart'));
  else if (dateDelta === 2) score = Math.min(score, matchingConfig('scoreCapTwoDaysApart'));

  if (score < matchingConfig('minMatchScore')) return null;
  const reasons: MatchReasons = { date, location, capacity, time, fresh, dateDelta, capacityFit, timing };
  if (pickupDaysLater >= 1) reasons.pickupDaysLater = pickupDaysLater;
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

/** Rescore every live pair — used after the matching weights change so existing
 *  match rows pick up the new curve without waiting for a listing edit.
 *
 *  Only the driver side is walked. Every match row names exactly one driver
 *  listing, so one pass over the live drivers regenerates every pair exactly
 *  once — including the per-listing delete of pairs that no longer qualify,
 *  which covers the rider side of those same rows. Walking riders too would
 *  only redo identical work.
 *
 *  Returns the number of listings processed. */
export async function recomputeAllMatches(): Promise<number> {
  const now = Date.now();
  const drivers = await db
    .select()
    .from(listings)
    .where(
      and(
        eq(listings.type, 'driver'),
        isNull(listings.cancelledAt),
        isNull(listings.deletedAt),
        isNull(listings.hiddenAt),
        gt(listings.expiresAt, new Date(now)),
      ),
    );

  // Sequential on purpose: a rescore of the whole board is a background chore,
  // not something worth saturating the pool for.
  for (const driver of drivers) {
    await recomputeMatchesForListing(driver);
  }
  return drivers.length;
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
