import type { Context } from 'hono';

// In-memory sliding windows. Single-replica assumption (railway.json numReplicas: 1);
// resets on deploy, which is acceptable — the abuse-critical limits are DB-count based.
const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 20_000;

export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  let hits = buckets.get(key);
  if (hits) {
    while (hits.length > 0 && hits[0]! < cutoff) hits.shift();
  } else {
    hits = [];
    buckets.set(key, hits);
  }
  if (hits.length >= max) return false;
  hits.push(now);

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, v] of buckets) {
      if (v.length === 0 || v[v.length - 1]! < cutoff) buckets.delete(k);
      if (buckets.size <= MAX_BUCKETS / 2) break;
    }
  }
  return true;
}

export function clientIp(c: Context): string {
  // Probed against prod (2026-07-27): x-envoy-external-address is NOT
  // sanitized by Railway's edge — a client can set it — so never trust it.
  // The edge appends its own hops to X-Forwarded-For; the rightmost entry is
  // a Railway edge-node address and the one before it is the client as the
  // edge saw it. Everything further left is client-supplied and must never
  // be trusted, or anyone can mint fresh buckets per request (recovery-code
  // guessing, anon floods, flag storms). With a single entry (no proxy /
  // local dev) that entry is the peer itself.
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 2]!;
    if (parts.length === 1) return parts[0]!;
  }
  return 'unknown';
}
