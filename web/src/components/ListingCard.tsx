import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
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
  onMessage?: (listing: Listing) => void;
  /** Detail-page use: render details always expanded, no toggle. */
  forceExpanded?: boolean;
}

/** "1 seat" / "3 seats" — never bare "1 seats". */
function seatsLabel(seats: number): string {
  return `${seats} ${seats === 1 ? 'seat' : 'seats'}`;
}

export default function ListingCard({
  listing,
  isFavorite,
  onToggleFavorite,
  onCancel,
  onDelete,
  onFlag,
  onMessage,
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
      className={`card listing-card ${isDriver ? 'listing-card--driver' : 'listing-card--rider'}`}
    >
      <div className="listing-card-header">
        <span className={`pill ${isDriver ? 'pill-driver' : 'pill-rider'}`}>
          {isDriver ? '🚗 Driver' : '🎒 Rider'}
        </span>
        <span className="listing-route">
          {directionArrow(listing.direction)} · {formatTravelDate(listing.travelDate)}
        </span>
        <span className="listing-card-spacer" />
        <button
          type="button"
          className="icon-btn"
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={() => onToggleFavorite(listing.id)}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>

      <div className="listing-card-identity">
        {listing.avatarVersion && !listing.pending && (
          <Avatar
            thumbSrc={`/api/listings/${listing.id}/avatar-thumb?v=${listing.avatarVersion}`}
            fullSrc={`/api/listings/${listing.id}/avatar?v=${listing.avatarVersion}`}
            name={listing.name}
            size={40}
          />
        )}
        <span className="listing-card-name">{listing.name}</span>
        <span className="listing-card-location">· {listing.location}</span>
      </div>

      <div className="listing-card-meta">
        <span>{formatTimeSlot(listing.timeSlot)}</span>
        {isDriver ? (
          <>
            {listing.passengerSpace !== null && (
              <span className="pill">{seatsLabel(listing.passengerSpace)}</span>
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
        {listing.pending && <span className="pill pill-warn">Waiting to sync</span>}
        {expired && <span className="pill pill-warn">Expired</span>}
        {listing.cancelledAt && <span className="pill pill-dim">Cancelled</span>}
      </div>

      {hasMore && (
        <div className="listing-details-wrap">
          {!forceExpanded && (
            <button
              type="button"
              className="btn-ghost listing-details-toggle"
              aria-expanded={showDetails}
              onClick={() => setExpanded((v) => !v)}
            >
              Details <span className="chevron" aria-hidden="true">▾</span>
            </button>
          )}
          {showDetails && (
            <div className="listing-details">
              {listing.details && <p>{listing.details}</p>}
              {listing.routeDetails && (
                <p>
                  <strong>Route:</strong> {listing.routeDetails}
                </p>
              )}
              {listing.campInfo && (
                <p>
                  <strong>Camp:</strong> {listing.campInfo}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {!listing.pending && (
        <div className="card-footer">
          {listing.isMine ? (
            <>
              <Link to={`/listing/${listing.id}/edit`} className="btn-secondary">
                Edit
              </Link>
              {onCancel && !listing.cancelledAt && (
                <button type="button" className="btn-secondary" onClick={handleCancel}>
                  Cancel listing
                </button>
              )}
              {onDelete && (
                <button type="button" className="btn-danger push-right" onClick={handleDelete}>
                  Delete
                </button>
              )}
            </>
          ) : (
            <>
              {onMessage && (
                <button type="button" className="btn" onClick={() => onMessage(listing)}>
                  Message
                </button>
              )}
              {onFlag && (
                <details className="listing-card-menu push-right">
                  <summary className="icon-btn" aria-label="More options">
                    ⋯
                  </summary>
                  <div className="listing-menu">
                    <button type="button" onClick={() => onFlag(listing.id)}>
                      Report listing
                    </button>
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}
