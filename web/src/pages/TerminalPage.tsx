import { useEffect, useRef } from 'react';
import { armTerminal } from '../lib/terminal';

/** /terminal — staff setup URL for the BMIR camp computer station. Visiting it
 *  arms terminal mode on this browser (optionally tuning the inactivity window
 *  via ?idle=SECONDS), guarantees a completely fresh session regardless of what
 *  the browser held before, and hard-loads the board so the whole app boots in
 *  terminal mode. Each subsequent user handoff happens through the reset, not
 *  through this page. */
export default function TerminalPage() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      const idle = new URLSearchParams(window.location.search).get('idle');
      armTerminal(idle !== null ? Number(idle) : undefined);

      // Whatever session this browser was holding belongs to staff or to a
      // previous life of the machine — never to the next walk-up user.
      try {
        await fetch('/api/session/logout', { method: 'POST', credentials: 'same-origin' });
      } catch {
        /* offline — proceed; the board will sort itself out once connected */
      }
      const flag = localStorage.getItem('ridefinder-terminal-v1');
      const idleSetting = localStorage.getItem('ridefinder-terminal-idle-v1');
      try {
        localStorage.clear();
        if (flag !== null) localStorage.setItem('ridefinder-terminal-v1', flag);
        if (idleSetting !== null) localStorage.setItem('ridefinder-terminal-idle-v1', idleSetting);
      } catch {
        /* storage unavailable */
      }
      window.location.replace('/');
    })();
  }, []);

  return <p className="board-loading">Setting up the entry console…</p>;
}
