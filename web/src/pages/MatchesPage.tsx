import { useState } from 'react';
import EmptyState from '../components/EmptyState';
import MatchCard from '../components/MatchCard';
import MessageComposer from '../components/MessageComposer';
import { useMyMatches } from '../api/matches';
import { useIdSet } from '../lib/prefs';
import { useMe } from '../api/session';
import type { Listing } from '../api/types';
import '../styles/matches.css';

export default function MatchesPage() {
  const { data: me } = useMe();
  const { data, isLoading } = useMyMatches();
  const [messageTarget, setMessageTarget] = useState<Listing | null>(null);
  // Same store as the board's ★ — starring in either place pins it in both.
  const favorites = useIdSet('ridefinder-favorites-v1');
  const hiddenMatches = useIdSet('ridefinder-hidden-matches-v1');
  const [showHidden, setShowHidden] = useState(false);

  const matchKey = (m: { driverListingId: string; riderListingId: string }): string =>
    `${m.driverListingId}-${m.riderListingId}`;

  const all = [...(data?.matches ?? [])].sort((a, b) => {
    const aStar = favorites.has(a.listing.id) ? 1 : 0;
    const bStar = favorites.has(b.listing.id) ? 1 : 0;
    if (aStar !== bStar) return bStar - aStar;
    return b.score - a.score;
  });
  const hiddenCount = all.filter((m) => hiddenMatches.has(matchKey(m))).length;
  const matches = showHidden ? all : all.filter((m) => !hiddenMatches.has(matchKey(m)));

  return (
    <>
      <h1>Matches</h1>
      <p className="matches-subtitle">
        Rides and riders that line up with your listings — same direction, close dates, gear that
        fits.
      </p>

      {hiddenCount > 0 && (
        <label className="admin-toggle">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />{' '}
          Show hidden matches ({hiddenCount})
        </label>
      )}

      {isLoading && !data ? (
        <p className="muted">Finding matches…</p>
      ) : matches.length === 0 ? (
        <EmptyState
          title="No matches yet"
          hint={
            me === null
              ? 'Post a listing and matches appear here automatically.'
              : 'When someone posts a compatible ride, it shows up here — and in your email digest.'
          }
        />
      ) : (
        <div className="matches-list">
          {matches.map((match) => (
            <MatchCard
              key={`${match.driverListingId}-${match.riderListingId}`}
              match={match}
              onMessage={setMessageTarget}
              isFavorite={favorites.has(match.listing.id)}
              onToggleFavorite={favorites.toggle}
              isHidden={hiddenMatches.has(matchKey(match))}
              onToggleHidden={() => hiddenMatches.toggle(matchKey(match))}
            />
          ))}
        </div>
      )}

      {messageTarget && (
        <MessageComposer listing={messageTarget} onClose={() => setMessageTarget(null)} />
      )}
    </>
  );
}
