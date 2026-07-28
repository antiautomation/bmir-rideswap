import { Link } from 'react-router-dom';
import type { Listing, Match, MatchReasons } from '../api/types';
import { directionArrow, formatTravelDate } from '../lib/format';

interface MatchCardProps {
  match: Match;
  onMessage: (listing: Listing) => void;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  isHidden: boolean;
  onToggleHidden: () => void;
}

function scoreTier(score: number): 'ok' | 'ember' | 'dim' {
  if (score >= 75) return 'ok';
  if (score >= 55) return 'ember';
  return 'dim';
}

/** Only dimensions that actually earned points get a pill — highest threshold wins per dimension. */
function reasonPills(reasons: MatchReasons): string[] {
  const pills: string[] = [];

  // dateDelta is authoritative — point thresholds shift whenever an admin tunes
  // the matching weights. Older rows predate the field, so keep the old ladder.
  if (typeof reasons.dateDelta === 'number') {
    if (reasons.dateDelta === 0) pills.push('📅 Same day');
    else if (reasons.dateDelta === 1) pills.push('📅 1 day apart');
    else if (reasons.dateDelta === 2) pills.push('📅 2 days apart');
  } else if (reasons.date >= 40) pills.push('📅 Same day');
  else if (reasons.date >= 25) pills.push('📅 1 day apart');
  else if (reasons.date >= 12) pills.push('📅 2 days apart');

  // The corridor detour IS the location credit — when present it replaces the
  // plain location pill rather than showing alongside it.
  if (typeof reasons.detourMi === 'number') pills.push(`🛣️ on the way (+${reasons.detourMi} mi)`);
  else if (reasons.location >= 30) pills.push('📍 Same area');
  else if (reasons.location >= 15) pills.push('📍 Nearby');

  // Sits with the route pills: the pickup is on the way, just not on day one.
  if (typeof reasons.pickupDaysLater === 'number' && reasons.pickupDaysLater >= 1) {
    const d = reasons.pickupDaysLater;
    pills.push(`🛣️ pickup +${d} day${d === 1 ? '' : 's'} into their drive`);
  }

  if (typeof reasons.capacityFit === 'number') {
    if (reasons.capacityFit === 0) pills.push('🎒 Perfect gear fit');
    else if (reasons.capacityFit === 1) pills.push('🎒 Gear fits');
    else pills.push('🎒 Plenty of room');
  } else if (reasons.capacity >= 15) pills.push('🎒 Perfect gear fit');
  else if (reasons.capacity >= 12) pills.push('🎒 Gear fits');
  else if (reasons.capacity >= 8) pills.push('🎒 Plenty of room');

  if (reasons.timing) {
    if (reasons.timing === 'aligned') pills.push('🕐 Times align');
    else if (reasons.timing === 'partial') pills.push('🕐 Flexible timing');
  } else if (reasons.time >= 10) pills.push('🕐 Times align');
  else if (reasons.time >= 7) pills.push('🕐 Flexible timing');

  if (reasons.fresh > 0) pills.push('✨ Recently posted');

  return pills;
}

export default function MatchCard({ match, onMessage, isFavorite, onToggleFavorite, isHidden, onToggleHidden }: MatchCardProps) {
  const { listing, myListing } = match;
  const isDriver = listing.type === 'driver';
  const pills = reasonPills(match.reasons);

  return (
    <article className={isHidden ? 'card match-card match-card--hidden' : 'card match-card'}>
      <div className="match-card-header">
        <span className={`match-score match-score--${scoreTier(match.score)}`}>
          {match.score}
        </span>
        <span className={`pill ${isDriver ? 'pill-driver' : 'pill-rider'}`}>
          {isDriver ? '🚗 Driver' : '🎒 Rider'}
        </span>
        <span className="match-card-spacer" />
        <button
          type="button"
          className="icon-btn"
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Unstar this match' : 'Star this match — starred matches stay at the top'}
          onClick={() => onToggleFavorite(listing.id)}
        >
          {isFavorite ? '★' : '☆'}
        </button>
      </div>

      <p className="match-route">
        {directionArrow(listing.direction)} · {formatTravelDate(listing.travelDate)}
      </p>

      <div className="match-card-identity">
        <span className="match-name">{listing.name}</span>
        <span className="muted">· {listing.location}</span>
      </div>

      {pills.length > 0 && (
        <div className="match-reasons">
          {pills.map((label) => (
            <span key={label} className="pill">
              {label}
            </span>
          ))}
        </div>
      )}

      <p className="match-context">
        Matches your &ldquo;{myListing.name}&rdquo; {myListing.type} listing
      </p>

      <div className="card-footer">
        <button type="button" className="btn" onClick={() => onMessage(listing)}>
          Message
        </button>
        <Link to={`/listing/${listing.id}`} className="btn-ghost push-right">
          View listing
        </Link>
        <button type="button" className="btn-ghost" onClick={onToggleHidden}>
          {isHidden ? 'Unhide' : 'Hide'}
        </button>
      </div>
    </article>
  );
}
