import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '../api/session';
import {
  formatCountdown,
  resetTerminalSession,
  startIdleWatch,
  useIdleRemaining,
} from '../lib/terminal';

/** Seconds the post-success handoff stays up before the station resets itself. */
const POSTED_RESET_SECONDS = 60;

/** The always-visible strip at the top of the station: names the mode, shows
 *  THIS user's session code the whole time (it is their only key — the walk-up
 *  audience is exactly the people without a working phone to screenshot it),
 *  and carries the inactivity countdown with a manual reset.
 *
 *  Also the mode's bootstrapper: a fresh reset lands here with no session, and
 *  the banner immediately mints the next anonymous one so the code is on
 *  screen before the user does anything. (Note for the station: /api/session/anon
 *  is IP rate-limited — raise anonSessionsPerHour in the admin console for the
 *  event, one station IP serves many users an hour.) */
export function TerminalBanner() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const remaining = useIdleRemaining();
  const minted = useRef(false);

  useEffect(() => {
    startIdleWatch();
  }, []);

  useEffect(() => {
    if (me || minted.current) return;
    minted.current = true;
    void (async () => {
      try {
        const res = await fetch('/api/session/anon', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
          credentials: 'same-origin',
        });
        if (res.ok) await queryClient.invalidateQueries({ queryKey: ['me'] });
      } catch {
        /* offline or rate-limited — the code appears once posting creates one */
      }
    })();
  }, [me, queryClient]);

  return (
    <div className="terminal-banner" role="region" aria-label="Entry console session">
      <span className="terminal-banner-title">🖥 BMIR Entry Console</span>
      <span className="terminal-banner-code">
        Your session code: <strong>{me?.recoveryCode ?? '…'}</strong> — write it down!
      </span>
      <span className="terminal-banner-spacer" />
      <span className="terminal-banner-timer">
        Resets after {formatCountdown(remaining)} idle
      </span>
      <button
        type="button"
        className="btn-secondary terminal-banner-reset"
        onClick={() => void resetTerminalSession()}
      >
        Reset now
      </button>
    </div>
  );
}

/** The handoff after a post goes up: the code one last time, written LARGE,
 *  with a one-minute fuse into the reset that turns the station over to the
 *  next person. Resetting is the point — the modal offers it, the timer
 *  guarantees it. */
export function TerminalPostedModal() {
  const { data: me } = useMe();
  const [left, setLeft] = useState(POSTED_RESET_SECONDS);
  const fired = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true;
      void resetTerminalSession();
    }
  }, [left]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terminal-posted-title"
    >
      <div className="modal-sheet terminal-posted">
        <h2 id="terminal-posted-title">✅ Your listing is live!</h2>
        <p className="modal-body-text">
          <strong>Write this code down</strong> — on paper, on your arm, anywhere. It is the only
          key to your listing and the replies it gets:
        </p>
        <p className="code-block terminal-posted-code">{me?.recoveryCode ?? '…'}</p>
        <p className="modal-body-text">
          On any phone or computer: open the site, go to <strong>You → Recover</strong>, and enter
          the code to pick up this session — your listing, matches, and messages come with it.
        </p>
        <p className="terminal-posted-timer" role="timer">
          This station resets in <strong>{formatCountdown(left)}</strong>
        </p>
        <button type="button" className="btn btn-block" onClick={() => void resetTerminalSession()}>
          Done — reset for the next person
        </button>
      </div>
    </div>
  );
}
