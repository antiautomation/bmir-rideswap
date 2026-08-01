import { useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import type { Belongings, Listing } from '../api/types';
import { useMe } from '../api/session';
import { isExpired } from '../lib/expiry';
import { BELONGINGS_MEANINGS, belongingsLabel, directionArrow, formatDepartureWindow, formatTravelDate, isCargoOnly } from '../lib/format';

/** Gear pill with an ⓘ that reveals what the tier means. Click/tap toggles
 *  (Safari doesn't focus buttons on click, so :focus CSS alone won't do);
 *  hovering the pill also shows it on desktop. */
function GearPill({ level }: { level: Belongings }) {
  const [open, setOpen] = useState(false);
  const label = belongingsLabel(level);
  const meaning = BELONGINGS_MEANINGS[level];
  return (
    <span className="pill gear-pill">
      {label}
      <button
        type="button"
        className="gear-info"
        aria-label={`${label}: ${meaning}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        ⓘ
      </button>
      <span className={open ? 'gear-tip gear-tip--open' : 'gear-tip'} role="tooltip">
        {meaning}
      </span>
    </span>
  );
}

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

/** "1 seat" / "3 seats" — never bare "1 seats". Riders read as a need rather
 *  than an offer, since the same number means opposite things per side. */
function seatsLabel(seats: number, isDriver: boolean): string {
  const noun = seats === 1 ? 'seat' : 'seats';
  return isDriver ? `${seats} ${noun}` : `needs ${seats} ${noun}`;
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
  const { data: me } = useMe();
  const isAdmin = me?.isAdmin ?? false;
  const expired = isExpired(listing);
  const isDriver = listing.type === 'driver';
  const cargoOnly = isCargoOnly(listing);
  const hasMore = Boolean(listing.details || listing.campInfo || listing.routeDetails);
  const showDetails = hasMore && (forceExpanded || expanded);
  /** The toggle lives in the footer, so the footer also carries pending cards. */
  const canToggleDetails = hasMore && !forceExpanded;
  const showFooter = !listing.pending || canToggleDetails;
  const detailsId = `listing-details-${listing.id}`;

  const handleCancel = () => {
    if (
      window.confirm(
        'Deactivate this listing? It comes off the board and stops matching. Your messages stay, and you can post again anytime.',
      )
    ) {
      onCancel?.(listing.id);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Delete this listing permanently? This cannot be undone.')) {
      onDelete?.(listing.id);
    }
  };

  /** Destructive and rare actions sit behind ⋯ so the footer keeps to one row —
   *  Delete on your own posts, Report on everyone else's. Deactivate stays out
   *  in the open, since that's the move we want when a ride is settled. */
  const overflowAction = listing.isMine
    ? onDelete && (
        <button type="button" onClick={handleDelete}>
          Delete listing
        </button>
      )
    : onFlag && (
        <button type="button" onClick={() => onFlag(listing.id)}>
          Report listing
        </button>
      );

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
        <span>{formatDepartureWindow(listing.timeSlot)}</span>
        {/* Seats read on both sides now. Zero of them is the cargo-only case,
            which keeps the card's own driver/rider rail and pill — it's a state
            of a listing, not a third identity, so it gets no colour of its own. */}
        <span className="pill">
          {cargoOnly
            ? isDriver
              ? '📦 Cargo space only'
              : '📦 Cargo only'
            : seatsLabel(listing.passengerSpace, isDriver)}
        </span>
        {isDriver
          ? listing.cargoSpace !== null && <GearPill level={listing.cargoSpace} />
          : listing.riderStuff !== null && <GearPill level={listing.riderStuff} />}
        {listing.pending && <span className="pill pill-warn">Waiting to sync</span>}
        {expired && <span className="pill pill-warn">Expired</span>}
        {listing.cancelledAt && <span className="pill pill-dim">Deactivated</span>}
      </div>

      {showDetails && (
        <div className="listing-details" id={detailsId}>
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

      {showFooter && (
        <div className="card-footer">
          {canToggleDetails && (
            <button
              type="button"
              className="btn-secondary listing-details-toggle"
              aria-expanded={expanded}
              aria-controls={detailsId}
              onClick={() => setExpanded((v) => !v)}
            >
              Details <span className="chevron" aria-hidden="true">▾</span>
            </button>
          )}
          {!listing.pending &&
            (listing.isMine ? (
              <>
                <Link to={`/listing/${listing.id}/edit`} className="btn-secondary">
                  Edit
                </Link>
                {onCancel && !listing.cancelledAt && (
                  <button type="button" className="btn-secondary" onClick={handleCancel}>
                    Deactivate
                  </button>
                )}
              </>
            ) : (
              <>
                {isAdmin && (
                  <Link
                    to={`/listing/${listing.id}/edit`}
                    className="icon-btn"
                    title="Admin: edit this post"
                    aria-label="Admin: edit this post"
                  >
                    🛠
                  </Link>
                )}
                {onMessage && (
                  <button type="button" className="btn" onClick={() => onMessage(listing)}>
                    Message
                  </button>
                )}
              </>
            ))}
          {!listing.pending && overflowAction && (
            <details className="listing-card-menu push-right">
              <summary className="icon-btn" aria-label="More options">
                ⋯
              </summary>
              <div className="listing-menu">{overflowAction}</div>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
