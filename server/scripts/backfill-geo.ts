/* One-time backfill: geocode existing listings' locations and recompute all
   live matches so corridor ("on the way") scoring applies to the whole board.
   Run: npm run backfill:geo -w server  (needs DATABASE_URL) */
import { and, gt, isNull } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db/client.js';
import { listings } from '../src/db/schema.js';
import { ensureCitiesLoaded, geocodeLocation } from '../src/lib/cities.js';
import { recomputeMatchesForListing } from '../src/matching/score.js';

async function main(): Promise<void> {
  await ensureCitiesLoaded();

  const all = await db.select().from(listings);
  let geocoded = 0;
  for (const l of all) {
    const origin = await geocodeLocation(l.locationNorm);
    await db
      .update(listings)
      .set({ originLat: origin?.lat ?? null, originLng: origin?.lng ?? null })
      .where(eq(listings.id, l.id));
    if (origin) geocoded += 1;
  }
  console.log(`geocoded ${geocoded}/${all.length} listings`);

  const live = await db
    .select()
    .from(listings)
    .where(
      and(isNull(listings.cancelledAt), isNull(listings.deletedAt), isNull(listings.hiddenAt), gt(listings.expiresAt, new Date())),
    );
  for (const l of live) {
    // Refetch so recompute sees the fresh coordinates.
    const [fresh] = await db.select().from(listings).where(eq(listings.id, l.id)).limit(1);
    if (fresh) await recomputeMatchesForListing(fresh);
  }
  console.log(`recomputed matches for ${live.length} live listings`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
