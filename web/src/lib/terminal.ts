/* The BMIR camp entry console ("terminal"): a kiosk mode for the computer
 * station at the station's camp, where people without working phones publish
 * listings. It is the ordinary app plus a wrapper: every walk-up user gets
 * their own fresh anonymous session whose code is displayed the whole time,
 * an inactivity timer wipes the station between users, and posting ends in a
 * write-your-code-down handoff that resets deliberately.
 *
 * Armed once by visiting /terminal on the station's browser; the flag lives in
 * localStorage and survives every reset — the reset preserves exactly this key
 * and nothing else. */

import { useSyncExternalStore } from 'react';

const FLAG_KEY = 'ridefinder-terminal-v1';
const IDLE_KEY = 'ridefinder-terminal-idle-v1';

export const DEFAULT_IDLE_SECONDS = 300;
/** Floor is test-sized on purpose (drive the auto-reset without a five-minute
 *  wait); staff configure real values via /terminal?idle=N. */
const MIN_IDLE_SECONDS = 5;
const MAX_IDLE_SECONDS = 3600;

export function isTerminal(): boolean {
  try {
    return localStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function armTerminal(idleSeconds?: number): void {
  localStorage.setItem(FLAG_KEY, '1');
  if (idleSeconds !== undefined && Number.isFinite(idleSeconds)) {
    const clamped = Math.min(MAX_IDLE_SECONDS, Math.max(MIN_IDLE_SECONDS, Math.round(idleSeconds)));
    localStorage.setItem(IDLE_KEY, String(clamped));
  }
}

export function idleSeconds(): number {
  const raw = Number(localStorage.getItem(IDLE_KEY));
  if (!Number.isFinite(raw) || raw < MIN_IDLE_SECONDS || raw > MAX_IDLE_SECONDS) {
    return DEFAULT_IDLE_SECONDS;
  }
  return Math.round(raw);
}

/** Wipe this user's presence and hand the station to the next person: server
 *  logout (clears the session cookie), every bit of local state except the
 *  terminal flag and its idle setting, then a hard navigation to the board.
 *  Hard on purpose — a full page load guarantees no React state, query cache,
 *  or half-typed form survives to the next user. */
export async function resetTerminalSession(): Promise<void> {
  try {
    await fetch('/api/session/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    // Offline reset: the cookie outlives this attempt, but the station is
    // useless offline anyway and the wipe below still clears everything local.
  }
  const idle = localStorage.getItem(IDLE_KEY);
  try {
    localStorage.clear();
    localStorage.setItem(FLAG_KEY, '1');
    if (idle !== null) localStorage.setItem(IDLE_KEY, idle);
  } catch {
    /* storage unavailable — the reload alone still drops in-memory state */
  }
  window.location.assign('/');
}

/* ---- Inactivity countdown ----------------------------------------------- */
/* One module-level store: the banner renders it, anything can read it. Any
 * pointer or key activity pushes the deadline back to the full window. */

let deadline = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let resetting = false;
const listeners = new Set<() => void>();
let remaining = DEFAULT_IDLE_SECONDS;

function notify(): void {
  for (const fn of listeners) fn();
}

function bump(): void {
  deadline = Date.now() + idleSeconds() * 1000;
}

function tick(): void {
  const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  if (next !== remaining) {
    remaining = next;
    notify();
  }
  if (next <= 0 && !resetting) {
    resetting = true;
    void resetTerminalSession();
  }
}

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

/** Idempotent; the banner calls it on mount when the terminal flag is set. */
export function startIdleWatch(): void {
  if (timer) return;
  bump();
  remaining = idleSeconds();
  timer = setInterval(tick, 500);
  for (const ev of ACTIVITY_EVENTS) {
    window.addEventListener(ev, bump, { passive: true });
  }
}

export function useIdleRemaining(): number {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => remaining,
  );
}

export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
