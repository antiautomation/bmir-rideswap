import type { Belongings, Direction } from '../api/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Parses a 'YYYY-MM-DD' string as a LOCAL date (never `new Date('YYYY-MM-DD')`, which is UTC). */
export function formatTravelDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(year, month - 1, day);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function to12Hour(hhmm: string): string {
  const [hoursStr] = hhmm.split(':');
  let hours = Number(hoursStr ?? 0);
  // 24:00 is midnight (the 9pm–12am slot's end), not noon.
  if (hours === 24 || hours === 0) return '12am';
  const suffix = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}${suffix}`;
}

export function formatTimeSlot(slot: string): string {
  if (slot === 'flexible') return 'Flexible time';
  const [start, end] = slot.split(' - ').map((s) => s.trim());
  if (!start || !end) return slot;
  return `${to12Hour(start)} – ${to12Hour(end)}`;
}

/** Prefixes the time slot with a departure cue so it isn't misread as an arrival time. */
export function formatDepartureWindow(slot: string): string {
  if (slot === 'flexible') return '🕤 Departing anytime';
  return `🕤 Departing ${formatTimeSlot(slot)}`;
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const diffMs = now - Date.parse(iso);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function directionLabel(direction: Direction): string {
  return direction === 'to_brc' ? 'to BRC' : 'from BRC';
}

export function directionArrow(direction: Direction): string {
  return direction === 'to_brc' ? '→ BRC' : 'BRC →';
}

const BELONGINGS_LABELS: Record<Belongings, string> = {
  minimal: 'Minimal gear',
  standard: 'Standard gear',
  substantial: 'Lots of gear',
  extensive: 'Extensive gear',
};

export function belongingsLabel(belongings: Belongings): string {
  return BELONGINGS_LABELS[belongings];
}

/** What each gear tier actually means — shown by the ⓘ on gear pills. */
export const BELONGINGS_MEANINGS: Record<Belongings, string> = {
  minimal: 'a backpack',
  standard: 'a suitcase or bin',
  substantial: 'suitcases/bins + a bike',
  extensive: 'a truck-bed load',
};
