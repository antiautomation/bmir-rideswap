/** Client half of the missed-dropdown-tap rule. Mirrors lightNormalize /
 *  normalizeLocation / namesCityExactly in server/src/lib/cities.ts — the two
 *  halves must agree, or the field would show one location while the server
 *  stores another. */

/** Lowercase, strip punctuation, collapse whitespace — keeps a trailing state
 *  abbreviation ("reno nv" stays "reno nv"). */
function lightNormalize(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** lightNormalize plus the server's trailing-2-letter state drop ("reno nv" → "reno"). */
function dropStateNormalize(raw: string): string {
  let s = lightNormalize(raw);
  const parts = s.split(' ');
  if (parts.length > 1 && parts[parts.length - 1]!.length === 2) {
    s = parts.slice(0, -1).join(' ');
  }
  return s;
}

/** Does the typed text name this city outright — the bare city name, or name +
 *  state, in any casing/punctuation? A fuzzy hit ("Renoo") is not outright. */
export function namesCityExactly(raw: string, city: { name: string; state: string }): boolean {
  const light = lightNormalize(raw);
  return (
    light === lightNormalize(city.name) ||
    light === lightNormalize(`${city.name} ${city.state}`) ||
    dropStateNormalize(raw) === dropStateNormalize(city.name)
  );
}
