import { BELONGINGS_ORDER, type Belongings, type Direction, type Listing } from '../api/types';
import { isExpired } from './expiry';
import { isCargoOnly } from './format';

export interface FilterState {
  direction: 'all' | Direction;
  /** 'cargo' cuts across both sides rather than picking one — a cargo-only post
   *  is still a driver or a rider, just one with no seats. */
  kind: 'all' | 'drivers' | 'riders' | 'cargo';
  day: 'all' | string; // YYYY-MM-DD
  locationQuery: string;
  capacity: 'any' | Belongings;
  favoritesOnly: boolean;
  showExpired: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  direction: 'all',
  kind: 'all',
  day: 'all',
  locationQuery: '',
  capacity: 'any',
  favoritesOnly: false,
  showExpired: false,
};

/** Is anything narrowing the board? Key-driven off DEFAULT_FILTERS so a filter
 *  added later counts without touching this. */
export function hasActiveFilters(f: FilterState): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof FilterState)[]).some((key) => {
    const value = f[key];
    const initial = DEFAULT_FILTERS[key];
    // Trim strings so a whitespace-only city query doesn't read as a filter.
    return typeof value === 'string' && typeof initial === 'string'
      ? value.trim() !== initial.trim()
      : value !== initial;
  });
}

interface HasId {
  has(id: string): boolean;
}

function matchesCapacity(listing: Listing, capacity: FilterState['capacity']): boolean {
  if (capacity === 'any') return true;
  if (listing.type === 'driver') {
    return listing.cargoSpace !== null && BELONGINGS_ORDER[listing.cargoSpace] >= BELONGINGS_ORDER[capacity];
  }
  return listing.riderStuff !== null && BELONGINGS_ORDER[listing.riderStuff] <= BELONGINGS_ORDER[capacity];
}

function sortListings(a: Listing, b: Listing): number {
  if (a.travelDate !== b.travelDate) return a.travelDate < b.travelDate ? -1 : 1;
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}

/** The three dropdown filters. Everything else — direction, kind, expiry, hidden,
 *  favourites — is a "hard" axis that always applies. */
type Facet = 'day' | 'location' | 'capacity';

const ALL_FACETS: readonly Facet[] = ['day', 'location', 'capacity'];

interface MatchScope {
  /** Facets whose own filter to ignore. */
  skip?: readonly Facet[];
  /** Apply the drivers/riders toggle. The board honours it by hiding a whole
   *  column instead, so it leaves this off; option building needs it applied.
   *  The 'cargo' pick is exempt — it spans both columns, so no column can be
   *  hidden to honour it and it has to filter for real every time. */
  kind?: boolean;
}

function matchesFilters(
  listing: Listing,
  f: FilterState,
  favorites: Set<string> | HasId,
  hidden: HasId,
  now: number,
  scope: MatchScope = {},
): boolean {
  const skip = scope.skip ?? [];
  if (hidden.has(listing.id)) return false;
  if (!f.showExpired && isExpired(listing, now)) return false;
  if (f.direction !== 'all' && listing.direction !== f.direction) return false;
  if (f.kind === 'cargo') {
    if (!isCargoOnly(listing)) return false;
  } else if (scope.kind && f.kind !== 'all') {
    if (listing.type !== (f.kind === 'drivers' ? 'driver' : 'rider')) return false;
  }
  if (!skip.includes('day') && f.day !== 'all' && listing.travelDate !== f.day) return false;
  if (!skip.includes('location')) {
    const q = f.locationQuery.trim().toLowerCase();
    if (q && !listing.location.toLowerCase().includes(q)) return false;
  }
  if (!skip.includes('capacity') && !matchesCapacity(listing, f.capacity)) return false;
  if (f.favoritesOnly && !favorites.has(listing.id) && !listing.isMine) return false;
  return true;
}

export function applyFilters(
  listings: Listing[],
  f: FilterState,
  favorites: Set<string> | HasId,
  hidden: HasId,
  now: number = Date.now(),
): { drivers: Listing[]; riders: Listing[] } {
  const filtered = listings.filter((listing) => matchesFilters(listing, f, favorites, hidden, now));

  const drivers = filtered.filter((listing) => listing.type === 'driver').sort(sortListings);
  const riders = filtered.filter((listing) => listing.type === 'rider').sort(sortListings);

  return { drivers, riders };
}

/** Each list holds the values that still return a listing, plus whatever is
 *  currently picked. */
export interface FilterOptions {
  /** Travel dates, ascending. */
  days: string[];
  /** Cities, deduped case-insensitively, sorted for display. */
  cities: string[];
  /** Gear tiers, loosest first. */
  capacities: Belongings[];
}

const CAPACITY_TIERS = (Object.keys(BELONGINGS_ORDER) as Belongings[]).sort(
  (a, b) => BELONGINGS_ORDER[a] - BELONGINGS_ORDER[b],
);

/** Dropdown options that can't lead to a dead end: each facet's options are the
 *  values that still return a listing once *every other* active filter is
 *  applied. Deriving them from the whole board instead would offer, say, a day
 *  that only has BRC→ listings while the direction filter says →BRC — pick it
 *  and you land on an empty board with no hint why.
 *
 *  The current pick is always included, even in the rare case where it and
 *  another live pick don't overlap, so a control never claims "All days" while a
 *  day filter is quietly still applied. */
export function filterOptions(
  listings: Listing[],
  f: FilterState,
  favorites: Set<string> | HasId,
  hidden: HasId,
  now: number = Date.now(),
): FilterOptions {
  const forFacet = (skip: Facet): Listing[] =>
    listings.filter((l) => matchesFilters(l, f, favorites, hidden, now, { skip: [skip], kind: true }));

  const dayValues = new Set(forFacet('day').map((l) => l.travelDate));
  if (f.day !== 'all') dayValues.add(f.day);
  const days = Array.from(dayValues).sort();

  // First-seen display form wins, so "reno, nv" and "Reno, NV" collapse to one.
  const byKey = new Map<string, string>();
  for (const l of forFacet('location')) {
    const key = l.location.trim().toLowerCase();
    if (key && !byKey.has(key)) byKey.set(key, l.location.trim());
  }
  const picked = f.locationQuery.trim();
  if (picked && !byKey.has(picked.toLowerCase())) byKey.set(picked.toLowerCase(), picked);
  const cities = Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));

  const forCapacity = forFacet('capacity');
  const capacities = CAPACITY_TIERS.filter(
    (tier) => tier === f.capacity || forCapacity.some((l) => matchesCapacity(l, tier)),
  );

  return { days, cities, capacities };
}

/** Picks that no longer exist on the board *at all* — the listing expired, was
 *  deleted, or sits on the other side of the direction/kind toggle. Each facet is
 *  judged on its own against the hard axes only, so one dead pick can't drag the
 *  live ones down with it.
 *
 *  A pick that's individually live but doesn't overlap another live pick is
 *  deliberate narrowing, not staleness, and is left alone — the board's empty
 *  state already says to try clearing filters. Returns null when nothing is
 *  stale, so callers can skip the update entirely. */
export function stalePicks(
  listings: Listing[],
  f: FilterState,
  favorites: Set<string> | HasId,
  hidden: HasId,
  now: number = Date.now(),
): Partial<FilterState> | null {
  // Nothing loaded yet (first paint, or an offline start with no cache) is not
  // evidence that a pick is dead — resetting here would eat persisted filters.
  if (listings.length === 0) return null;

  const live = listings.filter((l) =>
    matchesFilters(l, f, favorites, hidden, now, { skip: ALL_FACETS, kind: true }),
  );

  const reset: Partial<FilterState> = {};
  if (f.day !== 'all' && !live.some((l) => l.travelDate === f.day)) reset.day = 'all';
  const q = f.locationQuery.trim();
  if (q && !live.some((l) => l.location.toLowerCase().includes(q.toLowerCase()))) reset.locationQuery = '';
  if (f.capacity !== 'any' && !live.some((l) => matchesCapacity(l, f.capacity))) reset.capacity = 'any';

  return Object.keys(reset).length > 0 ? reset : null;
}
