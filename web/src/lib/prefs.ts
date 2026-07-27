import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

function readStored<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : initial;
  } catch {
    return initial;
  }
}

function writeStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full/unavailable — state still lives in memory for this session */
  }
}

/** useState synced to localStorage (JSON), with lazy init and try/catch. */
export function useStoredState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => readStored(key, initial));

  const setAndPersist = useCallback<Dispatch<SetStateAction<T>>>(
    (value) => {
      setState((prev) => {
        const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
        writeStored(key, next);
        return next;
      });
    },
    [key],
  );

  return [state, setAndPersist];
}

export interface IdSet {
  has(id: string): boolean;
  toggle(id: string): void;
  add(id: string): void;
}

/* ---------- Server sync (stars, hidden matches/listings follow the account) ----------
   localStorage stays as the instant/offline mirror. On load we fetch the
   account's prefs once: the first time a device syncs, its existing local ids
   are unioned up to the server (nothing lost from the pre-sync era); after
   that the server is the source of truth and edits flow up debounced.
   No session → everything keeps working locally, exactly as before. */

const SERVER_KEYS: Record<string, string> = {
  'ridefinder-favorites-v1': 'favorites',
  'ridefinder-hidden-v1': 'hiddenListings',
  'ridefinder-hidden-matches-v1': 'hiddenMatches',
};

let prefsPromise: Promise<Record<string, string[]> | null> | null = null;
function fetchServerPrefs(): Promise<Record<string, string[]> | null> {
  prefsPromise ??= fetch('/api/me/prefs', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { prefs?: Record<string, string[]> } | null) => d?.prefs ?? null)
    .catch(() => null);
  return prefsPromise;
}

const putTimers = new Map<string, number>();
function schedulePut(serverKey: string, ids: string[]): void {
  window.clearTimeout(putTimers.get(serverKey));
  putTimers.set(
    serverKey,
    window.setTimeout(() => {
      fetch('/api/me/prefs', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ [serverKey]: ids.slice(0, 1000) }),
      }).catch(() => {
        /* offline or no session — local mirror already has it */
      });
    }, 800),
  );
}

/** A set of ids mirrored in localStorage and synced to the account. */
export function useIdSet(key: string): IdSet {
  const [ids, setIds] = useStoredState<string[]>(key, []);
  const serverKey = SERVER_KEYS[key];

  useEffect(() => {
    if (!serverKey) return;
    let cancelled = false;
    void fetchServerPrefs().then((server) => {
      if (cancelled || server === null) return; // no session: stay local-only
      const serverIds = server[serverKey] ?? [];
      setIds((local) => {
        if (!readStored(`${key}:synced`, false)) {
          writeStored(`${key}:synced`, true);
          const union = [...new Set([...serverIds, ...local])];
          if (union.length !== serverIds.length) schedulePut(serverKey, union);
          return union;
        }
        return serverIds;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, serverKey]);

  const lookup = useMemo(() => new Set(ids), [ids]);

  const update = useCallback(
    (fn: (prev: string[]) => string[]) => {
      setIds((prev) => {
        const next = fn(prev);
        if (serverKey && next !== prev) schedulePut(serverKey, next);
        return next;
      });
    },
    [setIds, serverKey],
  );

  const toggle = useCallback(
    (id: string) => {
      update((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
    },
    [update],
  );

  const add = useCallback(
    (id: string) => {
      update((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    [update],
  );

  return useMemo(
    () => ({
      has: (id: string) => lookup.has(id),
      toggle,
      add,
    }),
    [lookup, toggle, add],
  );
}
