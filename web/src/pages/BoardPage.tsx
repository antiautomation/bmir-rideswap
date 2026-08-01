import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import EmptyState from '../components/EmptyState';
import FilterBar from '../components/FilterBar';
import MatchesTeaser from '../components/MatchesTeaser';
import WelcomeCard from '../components/WelcomeCard';
import ListingCard from '../components/ListingCard';
import MessageComposer from '../components/MessageComposer';
import { cancelListing, deleteListing, flagListing, useListings } from '../api/listings';
import type { Listing } from '../api/types';
import {
  applyFilters,
  DEFAULT_FILTERS,
  filterOptions,
  stalePicks,
  type FilterState,
} from '../lib/filters';
import { useIdSet, useStoredState } from '../lib/prefs';

export default function BoardPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useListings();
  const [filters, setFilters] = useStoredState<FilterState>('ridefinder-filters-v1', DEFAULT_FILTERS);
  const favorites = useIdSet('ridefinder-favorites-v1');
  const hidden = useIdSet('ridefinder-hidden-v1');
  const [messageTarget, setMessageTarget] = useState<Listing | null>(null);

  const listings = data?.listings ?? [];

  // Every dropdown option is a value that still returns a listing under the
  // filters already set — so no option is ever a dead end, and days/cities drop
  // off on their own as listings expire.
  const { days, cities, capacities } = useMemo(
    () => filterOptions(listings, filters, favorites, hidden),
    [listings, filters, favorites, hidden],
  );

  // A pick can stop existing entirely — a stale persisted filter, a listing that
  // expired, or a day that only had BRC→ posts once you switch to →BRC. Left
  // alone that filters the board by something the user can't see or undo, so
  // reset just those picks back to their catch-all.
  const stale = useMemo(
    () => stalePicks(listings, filters, favorites, hidden),
    [listings, filters, favorites, hidden],
  );

  useEffect(() => {
    if (stale) setFilters((prev) => ({ ...prev, ...stale }));
  }, [stale, setFilters]);

  const { drivers, riders } = useMemo(
    () => applyFilters(listings, filters, favorites, hidden),
    [listings, filters, favorites, hidden],
  );

  const showDrivers = filters.kind !== 'riders';
  const showRiders = filters.kind !== 'drivers';

  // Column CTAs carry the column's type plus the active direction filter, so the
  // form opens already set to what the user is looking at.
  const directionParam = filters.direction === 'all' ? '' : `&direction=${filters.direction}`;

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
      <FilterBar
        filters={filters}
        onChange={setFilters}
        days={days}
        cities={cities}
        capacities={capacities}
      />

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
              {/* "space" not "rides": a driver with a trailer and no spare seat
                  is offering cargo room, and lands in this column too. */}
              🚗 Drivers offering space <span className="pill">{drivers.length}</span>
              <Link
                to={`/post?type=driver${directionParam}`}
                className="board-column-post"
                aria-label="Create a driver post"
              >
                + Post
              </Link>
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
              🎒 Riders & cargo needing space <span className="pill">{riders.length}</span>
              <Link
                to={`/post?type=rider${directionParam}`}
                className="board-column-post"
                aria-label="Create a rider post"
              >
                + Post
              </Link>
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
