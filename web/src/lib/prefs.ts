import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';

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

/** A set of ids backed by localStorage, exposed as has/toggle/add. */
export function useIdSet(key: string): IdSet {
  const [ids, setIds] = useStoredState<string[]>(key, []);

  const lookup = useMemo(() => new Set(ids), [ids]);

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => (prev.includes(id) ? prev.filter((existing) => existing !== id) : [...prev, id]));
    },
    [setIds],
  );

  const add = useCallback(
    (id: string) => {
      setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    },
    [setIds],
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
