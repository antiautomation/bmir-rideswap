import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { appConfig } from '../lib/settings.js';
import { magicTokens, users } from '../db/schema.js';
import { hashToken, newRawToken, type SessionUser } from './tokens.js';

// One token is minted per outbound email and shared by all links in it.
// Multi-use by design: mail scanners prefetch GET links, and burning the token
// on first use would lock the real reader out.
const magicTtlMs = (): number => appConfig('magicLinkDays') * 24 * 3600 * 1000;

export async function mintMagicToken(userId: string): Promise<string> {
  const raw = newRawToken('ml');
  await db.insert(magicTokens).values({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + magicTtlMs()),
  });
  return raw;
}

export async function resolveMagicToken(raw: string): Promise<SessionUser | null> {
  if (!raw.startsWith('ml_')) return null;
  const rows = await db
    .select({ user: users })
    .from(magicTokens)
    .innerJoin(users, eq(magicTokens.userId, users.id))
    .where(
      and(
        eq(magicTokens.tokenHash, hashToken(raw)),
        isNull(magicTokens.revokedAt),
        gt(magicTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0]?.user ?? null;
}

// Only same-origin absolute paths survive; anything else lands on /me.
export function sanitizeNextPath(next: string | null | undefined): string {
  if (!next) return '/me';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://') || next.includes('\\')) {
    return '/me';
  }
  return next;
}
