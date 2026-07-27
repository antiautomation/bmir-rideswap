import { Link } from 'react-router-dom';
import { useMyMatches } from '../api/matches';
import { useIdSet } from '../lib/prefs';

/** Slim board banner shown when the current session has computed matches. */
export default function MatchesTeaser() {
  const { data } = useMyMatches();
  const hiddenMatches = useIdSet('ridefinder-hidden-matches-v1');
  const count = (data?.matches ?? []).filter(
    (m) => !hiddenMatches.has(`${m.driverListingId}-${m.riderListingId}`),
  ).length;
  if (count === 0) return null;

  return (
    <Link to="/matches" className="matches-teaser">
      <span className="matches-teaser-text">
        ✨ {count} potential {count === 1 ? 'match' : 'matches'} for your listings
      </span>
      <span className="matches-teaser-cta">View →</span>
    </Link>
  );
}
