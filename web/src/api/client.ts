export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`${status} ${code}`);
    this.name = 'ApiError';
  }
}

type OutcomeListener = (ok: boolean) => void;
const outcomeListeners = new Set<OutcomeListener>();

/** Connectivity seam: every real request reports success/failure here. */
export function onRequestOutcome(fn: OutcomeListener): () => void {
  outcomeListeners.add(fn);
  return () => outcomeListeners.delete(fn);
}

function notify(ok: boolean): void {
  for (const fn of outcomeListeners) fn(ok);
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? 'GET',
      headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      signal: opts.signal,
    });
  } catch (err) {
    // A thrown fetch = no response at all: the network-level failure signal.
    if (!(err instanceof DOMException && err.name === 'AbortError')) notify(false);
    throw err;
  }
  notify(true);
  if (!res.ok) {
    let code = 'error';
    try {
      const parsed = (await res.json()) as { error?: string };
      if (parsed.error) code = parsed.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
