import { useSyncExternalStore } from 'react';

import { onRequestOutcome } from '../api/client';
import { flushOutbox } from './outbox';

export interface ConnectivityState {
  status: 'online' | 'offline';
  lastChangedAt: number;
}

const PROBE_INTERVAL_MS = 45_000;
const PROBE_TIMEOUT_MS = 5_000;

let state: ConnectivityState = { status: 'online', lastChangedAt: Date.now() };
const listeners = new Set<() => void>();

let probeTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;

function setStatus(status: ConnectivityState['status']): void {
  if (state.status === status) return;
  state = { status, lastChangedAt: Date.now() };
  for (const fn of listeners) fn();
  syncProbeTimer();
}

function syncProbeTimer(): void {
  if (state.status === 'offline') {
    if (probeTimer) return;
    probeTimer = setInterval(() => void probe(), PROBE_INTERVAL_MS);
  } else if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
}

/** Ping the server to see if we're back. Success flips us online and kicks the outbox. */
export async function probe(): Promise<void> {
  try {
    const res = await fetch('/healthz', {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (res.ok) {
      setStatus('online');
      void flushOutbox();
    }
  } catch {
    /* still offline */
  }
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot(): ConnectivityState {
  return state;
}

export function useConnectivity(): ConnectivityState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Wire up all connectivity signals. Call once from main.tsx. */
export function initConnectivity(): void {
  if (initialized) return;
  initialized = true;

  // A page can be LOADED offline — the service worker serves the whole app from
  // cache, so nothing fails and the 'offline' event never fires (it only marks
  // transitions). Without this seed, an app opened in the dust believes it is
  // online until the first probe or hard failure.
  if (!navigator.onLine) setStatus('offline');

  onRequestOutcome((ok) => setStatus(ok ? 'online' : 'offline'));

  window.addEventListener('offline', () => setStatus('offline'));
  window.addEventListener('online', () => void probe());

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.status === 'offline') {
      void probe();
    }
  });
}
