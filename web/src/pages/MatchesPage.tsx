import { useState } from 'react';
import EmptyState from '../components/EmptyState';
import MatchCard from '../components/MatchCard';
import MessageComposer from '../components/MessageComposer';
import { useMyMatches } from '../api/matches';
import { useIdSet, useStoredState } from '../lib/prefs';
import { useMe } from '../api/session';
import { BELONGINGS_ORDER } from '../api/types';
import type { Belongings, Listing } from '../api/types';
import '../styles/matches.css';

export default function MatchesPage() {
  const { data: me } = useMe();
  const { data, isLoading } = useMyMatches();
  const [messageTarget, setMessageTarget] = useState<Listing | null>(null);
  // Same store as the board's ★ — starring in either place pins it in both.
  const favorites = useIdSet('ridefinder-favorites-v1');
  const hiddenMatches = useIdSet('ridefinder-hidden-matches-v1');
  const [showHidden, setShowHidden] = useState(false);
  const [showLowQuality, setShowLowQuality] = useStoredState('ridefinder-show-lowq-v1', false);

  const matchKey = (m: { driverListingId: string; riderListingId: string }): string =>
    `${m.driverListingId}-${m.riderListingId}`;

  const [mf, setMf] = useStoredState<{ minScore: number; hasPhoto: boolean; gear: 'any' | Belongings }>(
    'ridefinder-match-filters-v1',
    { minScore: 0, hasPhoto: false, gear: 'any' },
  );

  const allRaw = data?.matches ?? [];
  const passesFilters = (m: (typeof allRaw)[number]): boolean => {
    if (m.score < mf.minScore) return false;
    if (mf.hasPhoto && m.listing.avatarVersion === null) return false;
    if (mf.gear !== 'any') {
      const l = m.listing;
      if (l.type === 'driver') {
        if (l.cargoSpace === null || BELONGINGS_ORDER[l.cargoSpace] < BELONGINGS_ORDER[mf.gear]) return false;
      } else if (l.riderStuff === null || BELONGINGS_ORDER[l.riderStuff] > BELONGINGS_ORDER[mf.gear]) {
        return false;
      }
    }
    return true;
  };

  const all = allRaw.filter(passesFilters).sort((a, b) => {
    const aStar = favorites.has(a.listing.id) ? 1 : 0;
    const bStar = favorites.has(b.listing.id) ? 1 : 0;
    if (aStar !== bStar) return bStar - aStar;
    return b.score - a.score;
  });
  const hiddenCount = all.filter((m) => hiddenMatches.has(matchKey(m))).length;
  const matches = showHidden ? all : all.filter((m) => !hiddenMatches.has(matchKey(m)));

  // The email floor doubles as the in-app quality bar: anything under it is real
  // but weak, so it stays out of the main list until asked for. `all` is already
  // starred-first/score-desc, so each half keeps that order.
  const emailFloor = data?.emailFloor ?? 60;
  const quality = matches.filter((m) => m.score >= emailFloor);
  const lower = matches.filter((m) => m.score < emailFloor);

  const renderMatch = (match: (typeof matches)[number]) => (
    <MatchCard
      key={`${match.driverListingId}-${match.riderListingId}`}
      match={match}
      onMessage={setMessageTarget}
      isFavorite={favorites.has(match.listing.id)}
      onToggleFavorite={favorites.toggle}
      isHidden={hiddenMatches.has(matchKey(match))}
      onToggleHidden={() => hiddenMatches.toggle(matchKey(match))}
    />
  );

  return (
    <>
      <h1>Closest Matches</h1>
      <p className="matches-subtitle">
        Rides and riders that line up <em>best</em> with your listings — these aren&rsquo;t
        guaranteed perfect fits, just the closest ones we found (only listings going your
        direction are considered at all). The circled number is a 0&ndash;100 compatibility
        score: how well the dates, route, gear fit, timing, and posting recency line up. The
        badges under each name show what earned most of the score, and the filters below let
        you narrow things down yourself. Matches that fall below the quality bar are tucked
        behind the &ldquo;show lower-quality matches&rdquo; toggle and are never emailed to you.
      </p>

      {allRaw.length > 0 && (
        <div className="filter-grid match-filters">
          <select
            aria-label="Minimum score"
            value={String(mf.minScore)}
            onChange={(e) => setMf({ ...mf, minScore: Number(e.target.value) })}
          >
            <option value="0">Any score</option>
            <option value="50">Score 50+</option>
            <option value="65">Score 65+</option>
            <option value="80">Score 80+</option>
          </select>
          <select
            aria-label="Gear"
            value={mf.gear}
            onChange={(e) => setMf({ ...mf, gear: e.target.value as 'any' | Belongings })}
          >
            <option value="any">Any gear</option>
            <option value="minimal">Minimal gear</option>
            <option value="standard">Standard gear</option>
            <option value="substantial">Lots of gear</option>
            <option value="extensive">Extensive gear</option>
          </select>
          <button
            type="button"
            className="pill pill-toggle"
            aria-pressed={mf.hasPhoto}
            onClick={() => setMf({ ...mf, hasPhoto: !mf.hasPhoto })}
          >
            📸 Has photo
          </button>
        </div>
      )}

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
        <>
          {quality.length > 0 && <div className="matches-list">{quality.map(renderMatch)}</div>}

          {lower.length > 0 && (
            <>
              <label className="admin-toggle">
                <input
                  type="checkbox"
                  checked={showLowQuality}
                  onChange={(e) => setShowLowQuality(e.target.checked)}
                />{' '}
                Show lower-quality matches ({lower.length})
              </label>
              {showLowQuality && <div className="matches-list">{lower.map(renderMatch)}</div>}
            </>
          )}
        </>
      )}

      {messageTarget && (
        <MessageComposer listing={messageTarget} onClose={() => setMessageTarget(null)} />
      )}
    </>
  );
}
