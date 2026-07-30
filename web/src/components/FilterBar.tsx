import type { Belongings } from '../api/types';
import { DEFAULT_FILTERS, hasActiveFilters, type FilterState } from '../lib/filters';
import { belongingsLabel, formatTravelDate } from '../lib/format';

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  /** Options that still return a listing under the other active filters, so
   *  picking any of them can't land the user on an empty board. */
  days: string[];
  cities: string[];
  capacities: Belongings[];
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

export default function FilterBar({ filters, onChange, days, cities, capacities }: FilterBarProps) {
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
        {/* Each value falls back to its catch-all when the selection is no longer
            offered, so the control never renders blank in the frame before the
            board reconciles it. */}
        <select
          aria-label="Travel day"
          value={days.includes(filters.day) ? filters.day : 'all'}
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
          value={cities.find((c) => c.toLowerCase() === filters.locationQuery.trim().toLowerCase()) ?? ''}
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
          value={capacities.includes(filters.capacity as Belongings) ? filters.capacity : 'any'}
          onChange={(e) => set('capacity', e.target.value as FilterState['capacity'])}
        >
          <option value="any">Any gear</option>
          {capacities.map((level) => (
            <option key={level} value={level}>
              {belongingsLabel(level)}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-actions">
        <details className="filter-more">
          <summary className="btn-secondary">
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

        {hasActiveFilters(filters) && (
          <button type="button" className="btn filter-clear" onClick={() => onChange(DEFAULT_FILTERS)}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
