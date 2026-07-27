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
  // Railway's Envoy edge reports the real client address here (client-sent
  // values are sanitized at the edge — verified empirically against prod).
  const envoy = c.req.header('x-envoy-external-address');
  if (envoy) return envoy.trim();
  // Fallback: rightmost X-Forwarded-For entry — the one appended by the edge
  // about the peer it actually saw. On Railway that's an edge-node address
  // (bucket shared per edge node, still unspoofable); the leftmost entries
  // are client-supplied and must never be trusted, or anyone can mint fresh
  // buckets per request (recovery-code guessing, anon floods, flag storms).
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    return parts[parts.length - 1]!.trim();
  }
  return 'unknown';
}
