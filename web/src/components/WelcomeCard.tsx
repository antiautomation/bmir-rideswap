import { Link } from 'react-router-dom';
import { useMe } from '../api/session';
import { useStoredState } from '../lib/prefs';

/** One-time intro for brand-new visitors (no session yet, never dismissed). */
export default function WelcomeCard() {
  const { data: me, isLoading } = useMe();
  const [dismissed, setDismissed] = useStoredState('ridefinder-welcome-dismissed-v1', false);

  if (dismissed || isLoading || me) return null;

  return (
    <div className="card welcome-card">
      <button
        type="button"
        className="icon-btn welcome-card-close"
        aria-label="Dismiss welcome message"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
      <h2>Rides to &amp; from Black Rock City — free, no account needed</h2>
      <p className="muted">
        Post a ride or a seat request and you get a private session code — that&rsquo;s your only
        login. Your email and phone stay <strong>off the public board</strong>; they&rsquo;re shared
        only when you choose to, inside a private message. We&rsquo;ll email you when someone
        writes back or when a matching ride appears.
      </p>
      <div className="welcome-card-actions">
        <Link to="/post" className="btn">
          Create a post
        </Link>
        <button type="button" className="btn-ghost" onClick={() => setDismissed(true)}>
          Just browsing
        </button>
      </div>
    </div>
  );
}
