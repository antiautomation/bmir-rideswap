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

/* App-level knobs, same live-tunable machinery as the rate limits. */
export const APP_CONFIG_DEFAULTS = {
  magicLinkDays: 30,
  sessionDays: 365,
  flagAutoHideThreshold: 3,
  maxListingsPerDay: 5,
  maxActiveListingsPerDirection: 3,
  /* Hours a listing outlives its departure window, in the departure point's
     local time (see listingRules.ts). Flexible-time posts expire this many
     hours past local midnight — default 4 = 4am the next day. */
  expiryGraceHours: 4,
  flexibleExpiryGraceHours: 4,
} as const;

export type AppConfigKey = keyof typeof APP_CONFIG_DEFAULTS;

export const APP_CONFIG_KEYS = Object.keys(APP_CONFIG_DEFAULTS) as AppConfigKey[];

/* Counts and limits floor at 1, but zero grace hours is a legitimate choice
   ("expire exactly at window end"). Without this, a stored 0 silently reads
   back as the default. */
const ZERO_MIN_KEYS = new Set<string>(['expiryGraceHours', 'flexibleExpiryGraceHours']);
export const settingMin = (key: string): number => (ZERO_MIN_KEYS.has(key) ? 0 : 1);

interface Group<K extends string> {
  row: string;
  defaults: Record<K, number>;
  keys: K[];
  cache: Partial<Record<K, number>>;
}

const groups = {
  rateLimits: {
    row: 'rateLimits',
    defaults: RATE_LIMIT_DEFAULTS,
    keys: RATE_LIMIT_KEYS,
    cache: {},
  } as Group<RateLimitKey>,
  appConfig: {
    row: 'appConfig',
    defaults: APP_CONFIG_DEFAULTS,
    keys: APP_CONFIG_KEYS,
    cache: {},
  } as Group<AppConfigKey>,
};

let loadedAt = 0;
let inflight: Promise<void> | null = null;

async function refresh(): Promise<void> {
  for (const group of Object.values(groups)) {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, group.row)).limit(1);
    group.cache = (rows[0]?.value as Partial<Record<string, number>> | undefined) ?? {};
  }
  loadedAt = Date.now();
}

function cachedValue<K extends string>(group: Group<K>, key: K): number {
  if (Date.now() - loadedAt > 30_000 && !inflight) {
    inflight = refresh()
      .catch(() => {})
      .finally(() => {
        inflight = null;
      });
  }
  const v = group.cache[key];
  return typeof v === 'number' && Number.isFinite(v) && v >= settingMin(key) ? Math.floor(v) : group.defaults[key];
}

export function rateLimit(key: RateLimitKey): number {
  return cachedValue(groups.rateLimits, key);
}

export function appConfig(key: AppConfigKey): number {
  return cachedValue(groups.appConfig, key);
}

async function getGroup<K extends string>(group: Group<K>): Promise<Record<K, number>> {
  await refresh();
  const out = { ...group.defaults };
  for (const key of group.keys) {
    const v = group.cache[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= settingMin(key)) out[key] = Math.floor(v);
  }
  return out;
}

async function setGroup<K extends string>(group: Group<K>, patch: Partial<Record<K, number>>): Promise<void> {
  await refresh();
  const merged: Partial<Record<K, number>> = { ...group.cache };
  for (const key of group.keys) {
    const v = patch[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= settingMin(key)) merged[key] = Math.floor(v);
  }
  await db
    .insert(appSettings)
    .values({ key: group.row, value: merged, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: merged, updatedAt: new Date() } });
  group.cache = merged;
  loadedAt = Date.now();
}

export const getRateLimits = (): Promise<Record<RateLimitKey, number>> => getGroup(groups.rateLimits);
export const setRateLimits = (p: Partial<Record<RateLimitKey, number>>): Promise<void> => setGroup(groups.rateLimits, p);
export const getAppConfig = (): Promise<Record<AppConfigKey, number>> => getGroup(groups.appConfig);
export const setAppConfig = (p: Partial<Record<AppConfigKey, number>>): Promise<void> => setGroup(groups.appConfig, p);
