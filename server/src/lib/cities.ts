import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { count, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { cities } from '../db/schema.js';
import { normalizeLocation } from './listingRules.js';

/* GeoNames US+CA cities (pop >15k, CC-BY) bundled as JSON and loaded into
   Postgres on first boot. Powers the /api/cities typeahead and listing
   geocoding for corridor ("on the way") matching. */

interface CityRow {
  n: string;
  s: string;
  c: string;
  lat: number;
  lng: number;
  p: number;
}

export async function ensureCitiesLoaded(): Promise<void> {
  const [{ n }] = (await db.select({ n: count() }).from(cities)) as [{ n: number }];
  if (n > 0) return;
  const dataPath = join(dirname(fileURLToPath(import.meta.url)), '../../data/cities-na.json');
  const rows = JSON.parse(await readFile(dataPath, 'utf8')) as CityRow[];
  const values = rows.map((r) => ({
    name: r.n,
    state: r.s,
    country: r.c,
    nameNorm: normalizeLocation(r.n),
    lat: r.lat,
    lng: r.lng,
    population: r.p,
  }));
  for (let i = 0; i < values.length; i += 500) {
    await db.insert(cities).values(values.slice(i, i + 500));
  }
  console.log(`loaded ${values.length} cities`);
}

export interface CitySuggestion {
  label: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
}

/** searchCities' first-pass normalization: lowercase, strip punctuation, collapse
 *  whitespace — unlike normalizeLocation it keeps a trailing state abbreviation. */
export function lightNormalize(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function searchCities(q: string, limit = 8): Promise<CitySuggestion[]> {
  // Light normalization only: normalizeLocation()'s trailing-2-letter drop is
  // for state abbreviations on complete inputs, but here it eats mid-word
  // typing ("san fr" → "san"). Fall back to the dropped form so a pasted
  // "Berkeley, CA" still finds Berkeley.
  const light = lightNormalize(q);
  const results = await searchCitiesNorm(light, limit);
  if (results.length > 0) return results;
  const dropped = normalizeLocation(q);
  if (dropped && dropped !== light) return searchCitiesNorm(dropped, limit);
  return results;
}

/** Does the typed text name this city outright — the bare city name, or name +
 *  state, in any casing/punctuation? A fuzzy hit ("Renoo") is not outright:
 *  rewriting typos would guess, and a guess stored silently is worse than the
 *  typo. Pure so it can be tested without a database. */
export function namesCityExactly(raw: string, city: { name: string; state: string }): boolean {
  const light = lightNormalize(raw);
  return (
    light === lightNormalize(city.name) ||
    light === lightNormalize(`${city.name} ${city.state}`) ||
    normalizeLocation(raw) === normalizeLocation(city.name)
  );
}

/** The dropdown's missed-tap rule, enforced where it can't be missed: when the
 *  typed text names exactly one of its suggestions outright, return that city's
 *  canonical "Name, ST" label to store instead. Counting outright matches — not
 *  raw suggestions — is the load-bearing part: trigram fuzz means "Reno" also
 *  suggests El Reno, OK, but only one of those is what "Reno" says. Ambiguous
 *  ("Springfield" names eight of them), fuzzy, or unknown text returns null and
 *  the raw text stands — this is help, not validation, same as the typeahead. */
export async function canonicalizeLocation(raw: string): Promise<string | null> {
  const q = raw.trim();
  if (q.length < 2) return null; // same floor as /api/cities
  // Wider net than the dropdown's 8: more room to surface a second same-named
  // city, and more results can only make "exactly one" stricter, never looser.
  const results = await searchCities(q, 20);
  const named = results.filter((city) => namesCityExactly(q, city));
  if (named.length !== 1) return null;
  const city = named[0]!;
  return city.label === raw ? null : city.label;
}

async function searchCitiesNorm(norm: string, limit: number): Promise<CitySuggestion[]> {
  if (!norm) return [];
  // Prefix matches first (what typeahead users expect), trigram to catch typos.
  const rows = await db
    .select({
      name: cities.name,
      state: cities.state,
      lat: cities.lat,
      lng: cities.lng,
      prefix: sql<boolean>`(${cities.nameNorm} LIKE ${`${norm}%`})`,
      sim: sql<number>`similarity(${cities.nameNorm}, ${norm})`,
    })
    .from(cities)
    .where(sql`${cities.nameNorm} LIKE ${`${norm}%`} OR similarity(${cities.nameNorm}, ${norm}) > 0.35`)
    .orderBy(
      // Prefix hits first, biggest city first among them (what a typeahead user
      // expects: "berk" → Berkeley CA, not Berkley MI); similarity only breaks
      // ties among non-prefix fuzzy matches.
      sql`(${cities.nameNorm} LIKE ${`${norm}%`}) DESC`,
      sql`CASE WHEN ${cities.nameNorm} LIKE ${`${norm}%`} THEN ${cities.population} ELSE 0 END DESC`,
      sql`similarity(${cities.nameNorm}, ${norm}) DESC`,
      sql`${cities.population} DESC`,
    )
    .limit(limit);
  return rows.map((r) => ({
    label: `${r.name}, ${r.state}`,
    name: r.name,
    state: r.state,
    lat: r.lat,
    lng: r.lng,
  }));
}

/** Resolve a listing's normalized location to coordinates, or null when it
 *  doesn't look like a known city. Exact normalized match wins; otherwise the
 *  best trigram match above a conservative threshold (population breaks ties,
 *  so a bare "springfield" resolves to the biggest Springfield). */
export async function geocodeLocation(
  locationNorm: string,
): Promise<{ lat: number; lng: number; state: string } | null> {
  const norm = locationNorm.trim();
  if (!norm) return null;
  const exact = await db
    .select({ lat: cities.lat, lng: cities.lng, state: cities.state })
    .from(cities)
    .where(eq(cities.nameNorm, norm))
    .orderBy(sql`${cities.population} DESC`)
    .limit(1);
  if (exact[0]) return exact[0];
  const fuzzy = await db
    .select({ lat: cities.lat, lng: cities.lng, state: cities.state, sim: sql<number>`similarity(${cities.nameNorm}, ${norm})` })
    .from(cities)
    .where(sql`similarity(${cities.nameNorm}, ${norm}) > 0.55`)
    .orderBy(sql`similarity(${cities.nameNorm}, ${norm}) DESC`, sql`${cities.population} DESC`)
    .limit(1);
  return fuzzy[0] ? { lat: fuzzy[0].lat, lng: fuzzy[0].lng, state: fuzzy[0].state } : null;
}
