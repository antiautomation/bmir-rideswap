import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { appSettings } from '../db/schema.js';

/* Runtime-tunable settings, admin-editable without a deploy. Stored as one
   jsonb row per group; read through a 30s in-process cache (single replica,
   see rateLimit.ts). allow() call sites need synchronous reads, so rateLimit()
   returns the cached value and refreshes in the background. */

export const RATE_LIMIT_DEFAULTS = {
  messagesPerHour: 20,
  newConversationsPerHour: 5,
  listingFlagsPerHour: 10,
  avatarUploadsPerHour: 10,
  anonSessionsPerHour: 10,
  recoveriesPerHour: 5,
  magicLinksPerHour: 30,
  emailLoginLinksPerHour: 5,
} as const;

export type RateLimitKey = keyof typeof RATE_LIMIT_DEFAULTS;

export const RATE_LIMIT_KEYS = Object.keys(RATE_LIMIT_DEFAULTS) as RateLimitKey[];

let cache: Partial<Record<RateLimitKey, number>> = {};
let loadedAt = 0;
let inflight: Promise<void> | null = null;

async function refresh(): Promise<void> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, 'rateLimits')).limit(1);
  const value = rows[0]?.value as Partial<Record<RateLimitKey, number>> | undefined;
  cache = value ?? {};
  loadedAt = Date.now();
}

export function rateLimit(key: RateLimitKey): number {
  if (Date.now() - loadedAt > 30_000 && !inflight) {
    inflight = refresh()
      .catch(() => {})
      .finally(() => {
        inflight = null;
      });
  }
  const v = cache[key];
  return typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.floor(v) : RATE_LIMIT_DEFAULTS[key];
}

export async function getRateLimits(): Promise<Record<RateLimitKey, number>> {
  await refresh();
  const out = { ...RATE_LIMIT_DEFAULTS } as Record<RateLimitKey, number>;
  for (const key of RATE_LIMIT_KEYS) {
    const v = cache[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 1) out[key] = Math.floor(v);
  }
  return out;
}

export async function setRateLimits(patch: Partial<Record<RateLimitKey, number>>): Promise<void> {
  await refresh();
  const merged: Partial<Record<RateLimitKey, number>> = { ...cache };
  for (const key of RATE_LIMIT_KEYS) {
    const v = patch[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 1) merged[key] = Math.floor(v);
  }
  await db
    .insert(appSettings)
    .values({ key: 'rateLimits', value: merged, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: merged, updatedAt: new Date() } });
  cache = merged;
  loadedAt = Date.now();
}
