// Listings expire 3 hours after the end of their time slot, matching v1 behavior
// (legacy/index.html getExpirationTime). All times are playa time, pinned to PDT (-07:00)
// since the event window is entirely inside daylight-saving time.
const PLAYA_UTC_OFFSET = '-07:00';
const EXPIRY_GRACE_MS = 3 * 3600 * 1000;

export const TIME_SLOT_RE = /^(\d{2}):00 - (\d{2}):00$/;

export function computeExpiresAt(travelDate: string, timeSlot: string): Date {
  const match = TIME_SLOT_RE.exec(timeSlot);
  if (!match) {
    // 'flexible' (or anything unrecognized): end of day playa time + grace.
    return new Date(new Date(`${travelDate}T23:59:59${PLAYA_UTC_OFFSET}`).getTime() + EXPIRY_GRACE_MS);
  }
  const endHour = Number(match[2]);
  const base =
    endHour >= 24
      ? new Date(`${travelDate}T23:59:59${PLAYA_UTC_OFFSET}`).getTime() + 1000
      : new Date(`${travelDate}T${String(endHour).padStart(2, '0')}:00:00${PLAYA_UTC_OFFSET}`).getTime();
  return new Date(base + EXPIRY_GRACE_MS);
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
