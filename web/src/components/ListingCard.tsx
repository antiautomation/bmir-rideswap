import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Listing } from '../api/types';
import { isExpired } from '../lib/expiry';
import { belongingsLabel, directionArrow, formatTimeSlot, formatTravelDate } from '../lib/format';

interface ListingCardProps {
  listing: Listing;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onCancel?: (id: string) => void;
  onDelete?: (id: string) => void;
  onFlag?: (id: string) => void;
  /** Detail-page use: render details always expanded, no "More…" toggle. */
  forceExpanded?: boolean;
}

export default function ListingCard({
  listing,
  isFavorite,
  onToggleFavorite,
  onCancel,
  onDelete,
  onFlag,
  forceExpanded = false,
}: ListingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const expired = isExpired(listing);
  const isDriver = listing.type === 'driver';
  const showDetails = forceExpanded || expanded;
  const hasMore = Boolean(listing.details || listing.campInfo || listing.routeDetails);

  const handleCancel = () => {
    if (window.confirm('Cancel this listing? It will be removed from the board.')) {
      onCancel?.(listing.id);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Delete this listing permanently? This cannot be undone.')) {
      onDelete?.(listing.id);
    }
  };

  return (
    <article
      className={`listing-card ${isDriver ? 'listing-card--driver' : 'listing-card--rider'}`}
    >
      <div className="listing-card-row listing-card-row--top">
        <span className={`pill pill--type ${isDriver ? 'pill--ember' : 'pill--dusk'}`}>
          {isDriver ? '🚗 Driver' : '🎒 Rider'}
        </span>
        <span className="listing-card-direction">{directionArrow(listing.direction)}</span>
        <span className="listing-card-spacer" />
        <button
          type="button"
          className="favorite-toggle"
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => onToggleFavorite(listing.id)}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>

      <div className="listing-card-row">
        <span className="listing-card-name">{listing.name}</span>
        <span className="listing-card-location">· {listing.location}</span>
      </div>

      <div className="listing-card-row listing-card-row--meta">
        <span>
          {formatTravelDate(listing.travelDate)} · {formatTimeSlot(listing.timeSlot)}
        </span>
        {expired && <span className="pill pill--wait">Expired</span>}
        {listing.pending && <span className="pill pill--wait">Waiting to sync</span>}
        {listing.cancelledAt && <span className="pill pill--dim">Cancelled</span>}
      </div>

      <div className="listing-card-row listing-card-row--pills">
        {isDriver ? (
          <>
            {listing.passengerSpace !== null && (
              <span className="pill">{listing.passengerSpace} seats</span>
            )}
            {listing.cargoSpace !== null && (
              <span className="pill">{belongingsLabel(listing.cargoSpace)}</span>
            )}
          </>
        ) : (
          listing.riderStuff !== null && (
            <span className="pill">{belongingsLabel(listing.riderStuff)}</span>
          )
        )}
      </div>

      {hasMore && (
        <div className="listing-card-details">
          {showDetails ? (
            <>
              {listing.details && <p>{listing.details}</p>}
              {listing.campInfo && (
                <p>
                  <strong>Camp:</strong> {listing.campInfo}
                </p>
              )}
              {listing.routeDetails && (
                <p>
                  <strong>Route:</strong> {listing.routeDetails}
                </p>
              )}
              {!forceExpanded && (
                <button type="button" className="link-button" onClick={() => setExpanded(false)}>
                  Less…
                </button>
              )}
            </>
          ) : (
            <button type="button" className="link-button" onClick={() => setExpanded(true)}>
              More…
            </button>
          )}
        </div>
      )}

      <div className="listing-card-footer">
        <button type="button" disabled title="Private messaging coming soon">
          Message
        </button>

        {listing.isMine ? (
          <div className="listing-card-owner-actions">
            <Link to={`/listing/${listing.id}/edit`} className="button-like">
              Edit
            </Link>
            {onCancel && !listing.cancelledAt && (
              <button type="button" className="button-secondary" onClick={handleCancel}>
                Cancel listing
              </button>
            )}
            {onDelete && (
              <button type="button" className="button-danger" onClick={handleDelete}>
                Delete
              </button>
            )}
          </div>
        ) : (
          onFlag && (
            <details className="overflow-menu">
              <summary aria-label="More options">⋯</summary>
              <div className="overflow-menu-popover">
                <button type="button" onClick={() => onFlag(listing.id)}>
                  Report listing
                </button>
              </div>
            </details>
          )
        )}
      </div>
    </article>
  );
}
