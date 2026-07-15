import { BELONGINGS_ORDER, type Belongings, type Direction, type Listing } from '../api/types';
import { isExpired } from './expiry';

export interface FilterState {
  direction: 'all' | Direction;
  kind: 'all' | 'drivers' | 'riders';
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

export function applyFilters(
  listings: Listing[],
  f: FilterState,
  favorites: Set<string> | HasId,
  hidden: HasId,
  now: number = Date.now(),
): { drivers: Listing[]; riders: Listing[] } {
  const locationQuery = f.locationQuery.trim().toLowerCase();

  const filtered = listings.filter((listing) => {
    if (hidden.has(listing.id)) return false;
    if (!f.showExpired && isExpired(listing, now)) return false;
    if (f.direction !== 'all' && listing.direction !== f.direction) return false;
    if (f.day !== 'all' && listing.travelDate !== f.day) return false;
    if (locationQuery && !listing.location.toLowerCase().includes(locationQuery)) return false;
    if (!matchesCapacity(listing, f.capacity)) return false;
    if (f.favoritesOnly && !favorites.has(listing.id) && !listing.isMine) return false;
    return true;
  });

  const drivers = filtered.filter((listing) => listing.type === 'driver').sort(sortListings);
  const riders = filtered.filter((listing) => listing.type === 'rider').sort(sortListings);

  return { drivers, riders };
}
