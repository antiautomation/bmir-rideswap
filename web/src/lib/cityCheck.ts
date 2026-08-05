import { api } from '../api/client';
import type { CitiesResponse, City } from '../api/types';

/** Client-side twin of the server's normalizeLocation (listingRules.ts): the
 *  same lowercasing, punctuation strip, and trailing two-letter state drop, so
 *  "Reno, NV", "reno nv" and "Reno" all collapse to the same key. */
export function normalizeCity(raw: string): string {
  let s = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = s.split(' ');
  if (parts.length > 1 && parts[parts.length - 1]!.length === 2) {
    s = parts.slice(0, -1).join(' ');
  }
  return s;
}

export type CityVerdict =
  /** The input IS a city we know (possibly minus the state suffix). */
  | { kind: 'clean' }
  /** The input isn't a known city, but its first characters match one. */
  | { kind: 'suggest'; city: City }
  /** Nothing in the cities table starts like this at all. */
  | { kind: 'unknown' };

/** Submit-time sanity check for the location field. Asks the same endpoint the
 *  autocomplete uses, retrying with trailing words dropped so "Reno to BRC"
 *  still finds Reno — dirty input usually starts with the real city and decays
 *  into notes. Network trouble resolves 'clean': posting must never block on
 *  this (the form works offline through the outbox), and the server copes with
 *  unmatched locations anyway — this exists to catch typos while the person is
 *  still looking at the form, not to gatekeep. */
export async function checkCity(input: string): Promise<CityVerdict> {
  const norm = normalizeCity(input);
  if (!norm) return { kind: 'clean' };
  const words = input.trim().split(/\s+/);

  try {
    for (let n = words.length; n >= 1; n--) {
      const q = words.slice(0, n).join(' ');
      if (q.length < 2) break;
      const res = await api<CitiesResponse>(`/api/cities?q=${encodeURIComponent(q)}`);
      const cities = res.cities ?? [];
      if (cities.length === 0) continue;

      const exact = cities.find(
        (c) => normalizeCity(c.label) === norm || normalizeCity(c.name) === norm,
      );
      if (exact) return { kind: 'clean' };
      // Results are ranked prefix-match-first, then by population, so the top
      // hit is the natural "did you mean".
      return { kind: 'suggest', city: cities[0]! };
    }
    return { kind: 'unknown' };
  } catch {
    return { kind: 'clean' };
  }
}
