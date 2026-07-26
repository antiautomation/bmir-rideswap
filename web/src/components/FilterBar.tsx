import type { FilterState } from '../lib/filters';
import { formatTravelDate } from '../lib/format';

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  /** Unique travel dates present on the board, sorted ascending. */
  days: string[];
  cities: string[];
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

export default function FilterBar({ filters, onChange, days, cities }: FilterBarProps) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]): void {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="filter-bar">
      <div className="filter-row-segs">
        <div className="seg" role="group" aria-label="Direction">
          {DIRECTION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={filters.direction === opt.value}
              onClick={() => set('direction', opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="seg" role="group" aria-label="Listing type">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={filters.kind === opt.value}
              onClick={() => set('kind', opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-grid">
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

        <select
          aria-label="Filter by city"
          value={cities.some((c) => c.toLowerCase() === filters.locationQuery.trim().toLowerCase()) ? filters.locationQuery : ''}
          onChange={(e) => set('locationQuery', e.target.value)}
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

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

      <details className="filter-more">
        <summary className="btn-ghost">
          More filters <span className="chevron" aria-hidden="true">▾</span>
        </summary>
        <div className="filter-more-panel">
          <button
            type="button"
            className="pill pill-toggle"
            aria-pressed={filters.favoritesOnly}
            onClick={() => set('favoritesOnly', !filters.favoritesOnly)}
          >
            Favorites only
          </button>
          <button
            type="button"
            className="pill pill-toggle"
            aria-pressed={filters.showExpired}
            onClick={() => set('showExpired', !filters.showExpired)}
          >
            Show recently expired
          </button>
        </div>
      </details>
    </div>
  );
}
