import type { Listing } from '../api/types';

/** The 7-day cutoff is enforced server-side; this just hides expired listings client-side
 *  unless the user opts in via the "show recently expired" filter. */
export function isExpired(listing: Listing, now: number = Date.now()): boolean {
  return now > Date.parse(listing.expiresAt);
}
