import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import MatchesTeaser from '../components/MatchesTeaser';
import WelcomeCard from '../components/WelcomeCard';
import ListingCard from '../components/ListingCard';
import MessageComposer from '../components/MessageComposer';
import { cancelListing, deleteListing, flagListing, useListings } from '../api/listings';
import type { Listing } from '../api/types';
import { applyFilters, DEFAULT_FILTERS, type FilterState } from '../lib/filters';
import { useIdSet, useStoredState } from '../lib/prefs';

export default function BoardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useListings();
  const [filters, setFilters] = useStoredState<FilterState>('ridefinder-filters-v1', DEFAULT_FILTERS);
  const favorites = useIdSet('ridefinder-favorites-v1');
  const hidden = useIdSet('ridefinder-hidden-v1');
  const [messageTarget, setMessageTarget] = useState<Listing | null>(null);

  const listings = data?.listings ?? [];

  const days = useMemo(() => {
    const unique = new Set(listings.map((l) => l.travelDate));
    return Array.from(unique).sort();
  }, [listings]);

  // Cities with at least one active listing, deduped case-insensitively
  // (first-seen display form wins), like the day dropdown.
  const cities = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const l of listings) {
      const key = l.location.trim().toLowerCase();
      if (key && !byKey.has(key)) byKey.set(key, l.location.trim());
    }
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [listings]);

  // Stale free-text filters from the old search box would silently hide
  // everything now that the control is a dropdown — clear them once.
  useEffect(() => {
    const q = filters.locationQuery.trim().toLowerCase();
    if (q && listings.length > 0 && !cities.some((c) => c.toLowerCase() === q)) {
      setFilters({ ...filters, locationQuery: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities]);

  const { drivers, riders } = useMemo(
    () => applyFilters(listings, filters, favorites, hidden),
    [listings, filters, favorites, hidden],
  );

  const showDrivers = filters.kind !== 'riders';
  const showRiders = filters.kind !== 'drivers';

  function handleCancel(id: string): void {
    cancelListing(queryClient, id);
  }

  function handleDelete(id: string): void {
    deleteListing(queryClient, id);
  }

  function handleFlag(id: string): void {
    flagListing(queryClient, id);
    hidden.add(id);
  }

  if (isLoading) {
    return <p className="board-loading">Loading rides…</p>;
  }

  return (
    <>
      <h1 className="visually-hidden">Ride board</h1>
      <FilterBar filters={filters} onChange={setFilters} days={days} cities={cities} />

      <WelcomeCard />
      <MatchesTeaser />

      {isError && listings.length > 0 && (
        <p className="board-notice">Showing saved listings — reconnecting…</p>
      )}

      {isError && listings.length === 0 && (
        <div className="board-error">
          <p>Couldn&rsquo;t load the ride board.</p>
          <button type="button" className="btn-secondary" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}

      <div className={showDrivers && showRiders ? 'board-columns' : 'board-columns board-columns--single'}>
        {showDrivers && (
          <section className="board-column board-column--drivers">
            <h2 className="board-column-title">
              🚗 Drivers offering rides <span className="pill">{drivers.length}</span>
            </h2>
            {drivers.length === 0 ? (
              <EmptyState
                title="No drivers yet for these filters"
                hint="Try clearing them, or post a ride"
              />
            ) : (
              drivers.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isFavorite={favorites.has(listing.id)}
                  onToggleFavorite={favorites.toggle}
                  onCancel={listing.isMine ? handleCancel : undefined}
                  onDelete={listing.isMine ? handleDelete : undefined}
                  onFlag={listing.isMine ? undefined : handleFlag}
                  onMessage={listing.isMine ? undefined : setMessageTarget}
                />
              ))
            )}
          </section>
        )}

        {showRiders && (
          <section className="board-column board-column--riders">
            <h2 className="board-column-title">
              🎒 Riders looking for rides <span className="pill">{riders.length}</span>
            </h2>
            {riders.length === 0 ? (
              <EmptyState
                title="No riders yet for these filters"
                hint="Try clearing them, or post a ride"
              />
            ) : (
              riders.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isFavorite={favorites.has(listing.id)}
                  onToggleFavorite={favorites.toggle}
                  onCancel={listing.isMine ? handleCancel : undefined}
                  onDelete={listing.isMine ? handleDelete : undefined}
                  onFlag={listing.isMine ? undefined : handleFlag}
                  onMessage={listing.isMine ? undefined : setMessageTarget}
                />
              ))
            )}
          </section>
        )}
      </div>

      {messageTarget && (
        <MessageComposer listing={messageTarget} onClose={() => setMessageTarget(null)} />
      )}
    </>
  );
}
