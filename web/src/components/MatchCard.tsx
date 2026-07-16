import { Link } from 'react-router-dom';
import type { Listing, Match, MatchReasons } from '../api/types';
import { directionArrow, formatTravelDate } from '../lib/format';

interface MatchCardProps {
  match: Match;
  onMessage: (listing: Listing) => void;
}

function scoreTier(score: number): 'ok' | 'ember' | 'dim' {
  if (score >= 75) return 'ok';
  if (score >= 55) return 'ember';
  return 'dim';
}

/** Only dimensions that actually earned points get a pill — highest threshold wins per dimension. */
function reasonPills(reasons: MatchReasons): string[] {
  const pills: string[] = [];

  if (reasons.date >= 40) pills.push('📅 Same day');
  else if (reasons.date >= 25) pills.push('📅 1 day apart');
  else if (reasons.date >= 12) pills.push('📅 2 days apart');

  if (reasons.location >= 30) pills.push('📍 Same area');
  else if (reasons.location >= 15) pills.push('📍 Nearby');

  if (reasons.capacity >= 15) pills.push('🎒 Perfect gear fit');
  else if (reasons.capacity >= 12) pills.push('🎒 Gear fits');
  else if (reasons.capacity >= 8) pills.push('🎒 Plenty of room');

  if (reasons.time >= 10) pills.push('🕐 Times align');
  else if (reasons.time >= 7) pills.push('🕐 Flexible timing');

  if (reasons.fresh >= 5) pills.push('✨ Recently posted');

  return pills;
}

export default function MatchCard({ match, onMessage }: MatchCardProps) {
  const { listing, myListing } = match;
  const isDriver = listing.type === 'driver';
  const pills = reasonPills(match.reasons);

  return (
    <article className="card match-card">
      <div className="match-card-header">
        <span className={`match-score match-score--${scoreTier(match.score)}`}>
          {match.score}
        </span>
        <span className={`pill ${isDriver ? 'pill-driver' : 'pill-rider'}`}>
          {isDriver ? '🚗 Driver' : '🎒 Rider'}
        </span>
        <span className="match-route">
          {directionArrow(listing.direction)} · {formatTravelDate(listing.travelDate)}
        </span>
      </div>

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
      </div>
    </article>
  );
}
