import { appConfig } from './settings.js';

/* Expiry is anchored to the *departure point's* wall clock: to-BRC posts leave
   from the poster's city, from-BRC posts leave from the playa. Posters never
   see a timezone picker — we derive the offset from the geocoded city's state.

   The event window sits entirely inside daylight-saving time, so each state
   maps to a fixed August UTC offset. Split-timezone states (TX, FL, TN, KY,
   ID, OR, ND, SD, NE, KS, IN, MI) get their majority zone — at worst an hour
   off on a multi-hour grace window, which never strands a listing mid-window. */
const PLAYA_UTC_OFFSET = '-07:00'; // Black Rock City, Pacific daylight time

const AUGUST_STATE_OFFSETS: Record<string, string> = {
  // Eastern (EDT)
  CT: '-04:00', DC: '-04:00', DE: '-04:00', FL: '-04:00', GA: '-04:00',
  IN: '-04:00', MA: '-04:00', MD: '-04:00', ME: '-04:00', MI: '-04:00',
  NC: '-04:00', NH: '-04:00', NJ: '-04:00', NY: '-04:00', OH: '-04:00',
  PA: '-04:00', RI: '-04:00', SC: '-04:00', VA: '-04:00', VT: '-04:00',
  WV: '-04:00',
  // Central (CDT)
  AL: '-05:00', AR: '-05:00', IA: '-05:00', IL: '-05:00', KS: '-05:00',
  KY: '-05:00', LA: '-05:00', MN: '-05:00', MO: '-05:00', MS: '-05:00',
  ND: '-05:00', NE: '-05:00', OK: '-05:00', SD: '-05:00', TN: '-05:00',
  TX: '-05:00', WI: '-05:00',
  // Mountain (MDT)
  CO: '-06:00', ID: '-06:00', MT: '-06:00', NM: '-06:00', UT: '-06:00',
  WY: '-06:00',
  // Arizona observes no DST (MST year-round)
  AZ: '-07:00',
  // Pacific (PDT)
  CA: '-07:00', NV: '-07:00', OR: '-07:00', WA: '-07:00',
  // Alaska (AKDT) / Hawaii (no DST)
  AK: '-08:00', HI: '-10:00',
  // Canadian provinces (no code collides with a US state). SK skips DST.
  BC: '-07:00', YT: '-07:00',
  AB: '-06:00', SK: '-06:00',
  MB: '-05:00',
  ON: '-04:00', QC: '-04:00',
  NS: '-03:00',
  // Mexico carries one code for the whole country, so this is Baja/Pacific —
  // by far the likeliest driving origin. Off by an hour or two for the
  // interior, which only shifts expiry grace, not matching.
  MX: '-07:00',
};

export type Direction = 'to_brc' | 'from_brc';

export function departureUtcOffset(direction: Direction, originState: string | null): string {
  if (direction === 'from_brc') return PLAYA_UTC_OFFSET;
  return (originState !== null && AUGUST_STATE_OFFSETS[originState]) || PLAYA_UTC_OFFSET;
}

export const TIME_SLOT_RE = /^(\d{2}):00 - (\d{2}):00$/;

/** A listing outlives its departure window by `expiryGraceHours` (admin-tunable,
 *  default 4). 'Flexible' treats the whole day as the window and expires
 *  `flexibleExpiryGraceHours` past local midnight — default 4, i.e. 4am the
 *  next day at the departure point. */
export function computeExpiresAt(
  travelDate: string,
  timeSlot: string,
  direction: Direction,
  originState: string | null,
): Date {
  const offset = departureUtcOffset(direction, originState);
  const endOfDay = new Date(`${travelDate}T23:59:59${offset}`).getTime() + 1000;

  const match = TIME_SLOT_RE.exec(timeSlot);
  if (!match) {
    // 'flexible' (or anything unrecognized)
    return new Date(endOfDay + appConfig('flexibleExpiryGraceHours') * 3600 * 1000);
  }
  const endHour = Number(match[2]);
  const base =
    endHour >= 24
      ? endOfDay
      : new Date(`${travelDate}T${String(endHour).padStart(2, '0')}:00:00${offset}`).getTime();
  return new Date(base + appConfig('expiryGraceHours') * 3600 * 1000);
}

// Normalized form used only for fuzzy matching (pg_trgm), never displayed.
export function normalizeLocation(raw: string): string {
  let s = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = s.split(' ');
  if (parts.length > 1 && parts[parts.length - 1]!.length === 2) {
    s = parts.slice(0, -1).join(' ');
  }
  return s;
}
