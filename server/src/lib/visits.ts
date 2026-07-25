import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { ipGeo, visits } from '../db/schema.js';

/* Privacy-preserving pageview capture: IPs are salted-hashed before storage,
   and geolocation happens through a small in-memory queue holding the raw IP
   only until a lookup succeeds — it is never written anywhere. */

const SALT = process.env.IP_HASH_SALT ?? process.env.ADMIN_KEY ?? 'ridefinder';

const pendingGeo = new Map<string, string>(); // ipHash -> raw ip, transient
const knownGeo = new Set<string>();
const MAX_PENDING = 500;

export function hashIp(ip: string): string {
  return createHash('sha256').update(`${SALT}:${ip}`).digest('hex').slice(0, 32);
}

function isPrivateIp(ip: string): boolean {
  return /^(::1$|::ffff:127\.|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fe80:|fc|fd|unknown$)/.test(ip);
}

export interface VisitInput {
  ip: string;
  path: string;
  referrer: string | null;
  hadSession: boolean;
  ownHost: string | null;
}

export async function recordVisit(input: VisitInput): Promise<void> {
  const ipHash = hashIp(input.ip);

  let referrerHost: string | null = null;
  if (input.referrer) {
    try {
      const host = new URL(input.referrer).hostname.toLowerCase();
      if (host && host !== input.ownHost) referrerHost = host.slice(0, 120);
    } catch {
      /* unparseable referrer — drop it */
    }
  }

  await db.insert(visits).values({
    day: new Date().toISOString().slice(0, 10),
    ipHash,
    path: input.path.slice(0, 200),
    referrerHost,
    hadSession: input.hadSession,
  });

  if (!knownGeo.has(ipHash) && !pendingGeo.has(ipHash) && pendingGeo.size < MAX_PENDING) {
    const existing = await db.select({ h: ipGeo.ipHash }).from(ipGeo).where(eq(ipGeo.ipHash, ipHash)).limit(1);
    if (existing.length > 0) knownGeo.add(ipHash);
    else pendingGeo.set(ipHash, input.ip);
  }
}

async function drainGeoQueue(): Promise<void> {
  const batch = [...pendingGeo.entries()].slice(0, 3);
  for (const [ipHash, ip] of batch) {
    pendingGeo.delete(ipHash);
    if (isPrivateIp(ip)) {
      await db.insert(ipGeo).values({ ipHash, region: null, country: 'local' }).onConflictDoNothing();
      knownGeo.add(ipHash);
      continue;
    }
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: ctrl.signal });
      clearTimeout(timer);
      const data = (await res.json()) as {
        success?: boolean;
        region?: string;
        country?: string;
        country_code?: string;
      };
      if (data.success) {
        // US → state name ("Nevada"); elsewhere → country name.
        const region = data.country_code === 'US' ? (data.region ?? null) : (data.country ?? null);
        await db.insert(ipGeo).values({ ipHash, region, country: data.country_code ?? null }).onConflictDoNothing();
        knownGeo.add(ipHash);
      }
      // Non-success (rate limited, reserved range): drop; a future visit retries.
    } catch {
      /* network hiccup — a future visit re-queues it */
    }
  }
}

export function startGeoWorker(): void {
  setInterval(() => {
    drainGeoQueue().catch(() => {});
  }, 20_000).unref();
}
