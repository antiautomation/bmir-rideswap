import type { FilterState } from '../lib/filters';
import { formatTravelDate } from '../lib/format';

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  /** Unique travel dates present on the board, sorted ascending. */
  days: string[];
}

const DIRECTION_OPTIONS: { value: FilterState['direction']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'to_brc', label: '→ BRC' },
  { value: 'from_brc', label: 'BRC →' },
];

const KIND_OPTIONS: { value: FilterState['kind']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'drivers', label: '🚗 Drivers' },
  { value: 'riders', label: '🎒 Riders' },
];

const CAPACITY_OPTIONS: { value: FilterState['capacity']; label: string }[] = [
  { value: 'any', label: 'Any gear' },
  { value: 'minimal', label: 'Minimal gear' },
  { value: 'standard', label: 'Standard gear' },
  { value: 'substantial', label: 'Lots of gear' },
  { value: 'extensive', label: 'Extensive gear' },
];

export default function FilterBar({ filters, onChange, days }: FilterBarProps) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]): void {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="filter-bar">
      <div className="filter-bar-row">
        <div className="segmented" role="group" aria-label="Direction">
          {DIRECTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={filters.direction === opt.value ? 'segmented-option active' : 'segmented-option'}
              aria-pressed={filters.direction === opt.value}
              onClick={() => set('direction', opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="segmented" role="group" aria-label="Listing type">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={filters.kind === opt.value ? 'segmented-option active' : 'segmented-option'}
              aria-pressed={filters.kind === opt.value}
              onClick={() => set('kind', opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-bar-row">
        <select
          aria-label="Travel day"
          value={filters.day}
          onChange={(e) => set('day', e.target.value)}
        >
          <option value="all">All days</option>
          {days.map((day) => (
            <option key={day} value={day}>
              {formatTravelDate(day)}
            </option>
          ))}
        </select>

        <input
          type="search"
          aria-label="Filter by location"
          placeholder="Filter by city…"
          value={filters.locationQuery}
          onChange={(e) => set('locationQuery', e.target.value)}
        />

        <select
          aria-label="Gear capacity"
          value={filters.capacity}
          onChange={(e) => set('capacity', e.target.value as FilterState['capacity'])}
        >
          {CAPACITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <details className="filter-bar-more">
        <summary>More filters</summary>
        <div className="filter-bar-more-options">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={filters.favoritesOnly}
              onChange={(e) => set('favoritesOnly', e.target.checked)}
            />
            Favorites only
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={filters.showExpired}
              onChange={(e) => set('showExpired', e.target.checked)}
            />
            Show recently expired
          </label>
        </div>
      </details>
    </div>
  );
}
