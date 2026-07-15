import { api, ApiError } from '../api/client';

export interface OutboxItem {
  id: string;
  createdAt: number;
  /** Human-readable, e.g. 'post listing' — shown in the status bar. */
  label: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  attempts: number;
}

export interface OutboxFailure {
  item: OutboxItem;
  status: number | null;
  code: string;
}

const STORAGE_KEY = 'ridefinder-outbox-v1';
const MAX_ATTEMPTS = 8;
const RETRY_DELAY_MS = 30_000;

function load(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

let items: OutboxItem[] = load();
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const changeListeners = new Set<() => void>();
const failureListeners = new Set<(failure: OutboxFailure) => void>();
const successListeners = new Set<(item: OutboxItem) => void>();

function persist(next: OutboxItem[]): void {
  items = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage full/unavailable — queue still lives in memory */
  }
  for (const fn of changeListeners) fn();
}

export function getOutboxItems(): OutboxItem[] {
  return items;
}

export function subscribeOutbox(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

export function onOutboxFailure(fn: (failure: OutboxFailure) => void): () => void {
  failureListeners.add(fn);
  return () => failureListeners.delete(fn);
}

export function onOutboxSuccess(fn: (item: OutboxItem) => void): () => void {
  successListeners.add(fn);
  return () => successListeners.delete(fn);
}

/** Queue a mutation and immediately attempt to send it. Resolves when this
 *  flush pass ends — the item may still be queued if the network is down. */
export function enqueue(input: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts'>): Promise<void> {
  const item: OutboxItem = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    attempts: 0,
  };
  persist([...items, item]);
  return flushOutbox();
}

function scheduleRetry(): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flushOutbox();
  }, RETRY_DELAY_MS);
}

function dropHead(failure: OutboxFailure): void {
  persist(items.slice(1));
  for (const fn of failureListeners) fn(failure);
}

/** Sequential, order-preserving replay. Stops at the first retryable failure. */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    while (items.length > 0) {
      const head = items[0]!;
      try {
        await api(head.path, { method: head.method, body: head.body });
        persist(items.slice(1));
        for (const fn of successListeners) fn(head);
      } catch (err) {
        if (err instanceof ApiError && err.status < 500) {
          // The server understood and rejected it — retrying will never help.
          dropHead({ item: head, status: err.status, code: err.code });
          continue;
        }
        const attempts = head.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
          dropHead({ item: head, status: null, code: 'gave_up' });
          continue;
        }
        persist([{ ...head, attempts }, ...items.slice(1)]);
        scheduleRetry();
        return;
      }
    }
  } finally {
    flushing = false;
  }
}

export function initOutbox(): void {
  window.addEventListener('online', () => void flushOutbox());
  if (items.length > 0) void flushOutbox();
}
