import { Link } from 'react-router-dom';
import { useMe } from '../api/session';
import { useStoredState } from '../lib/prefs';

/* Fixed spots rather than random: the reduced-motion frame is these exact
   positions frozen, so they have to read as deliberate decoration. They hug the
   corners and right gutter so the headline stays clear of them even when it
   wraps at phone widths. Staggered timings keep the live version from pulsing
   in unison. */
const SPARKS: { top: string; left: string; dur: string; delay: string }[] = [
  { top: '4%', left: '2%', dur: '9s', delay: '0s' },
  { top: '20%', left: '92%', dur: '12s', delay: '1.8s' },
  { top: '55%', left: '95%', dur: '10s', delay: '0.7s' },
  { top: '82%', left: '90%', dur: '13s', delay: '2.6s' },
  { top: '6%', left: '72%', dur: '11s', delay: '3.4s' },
];

/** One-time intro for brand-new visitors (no session yet, never dismissed).
 *
 *  Deliberately louder than everything else on the board: it renders exactly
 *  once per visitor and its one job is getting them to post BEFORE they browse.
 *  A post keeps matching against listings that arrive later; browsing only sees
 *  what's already there. Hence the aurora treatment — the ember→violet gradient
 *  is the driver and rider identity colors meeting, i.e. the matching itself as
 *  decoration. One-off surface, not a new pattern to copy. */
export default function WelcomeCard() {
  const { data: me, isLoading } = useMe();
  const [dismissed, setDismissed] = useStoredState('ridefinder-welcome-dismissed-v1', false);

  if (dismissed || isLoading || me) return null;

  return (
    <div className="welcome-banner">
      <div className="welcome-banner-inner">
        <div className="welcome-banner-sky" aria-hidden="true">
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className="wb-spark"
              style={{ top: s.top, left: s.left, animationDuration: s.dur, animationDelay: s.delay }}
            >
              ✨
            </span>
          ))}
          <span className="wb-unicorn">🦄</span>
        </div>

        <div className="welcome-banner-content">
          <button
            type="button"
            className="icon-btn welcome-banner-close"
            aria-label="Dismiss welcome message"
            onClick={() => setDismissed(true)}
          >
            ✕
          </button>
          <h2>✨ It all starts with posting what you want</h2>
          <p>
            Don&rsquo;t just scroll — post. <strong>The matching does the rest</strong>: it scores
            every ride on the board against yours, keeps watching as new posts roll in, and emails
            you the good ones. Browsers see today&rsquo;s board;{' '}
            <strong>posters catch tomorrow&rsquo;s too</strong>.
          </p>
          <p>
            Even if what you want is a unicorn with a bike rack — post it. Worst case you match a
            sparkle pony with an empty trailer. 🦄✨
          </p>
          <p className="welcome-banner-trust">
            Free · no account · your email &amp; phone stay off the public board
          </p>
          <div className="welcome-banner-actions">
            <Link to="/post" className="btn">
              Post what you want
            </Link>
            <button type="button" className="btn-ghost" onClick={() => setDismissed(true)}>
              Just browsing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
