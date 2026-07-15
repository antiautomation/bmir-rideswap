import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { db } from '../db/client.js';
import { authTokens, magicTokens, users } from '../db/schema.js';

export type SessionUser = typeof users.$inferSelect;

const COOKIE_NAME = 'rs_session';
const SESSION_TTL_MS = 365 * 24 * 3600 * 1000;
const TOUCH_INTERVAL_MS = 3600 * 1000;

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function newRawToken(prefix: 'bt' | 'ml'): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`;
}

export async function issueSessionCookie(c: Context, userId: string): Promise<void> {
  const raw = newRawToken('bt');
  await db.insert(authTokens).values({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  setCookie(c, COOKIE_NAME, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function resolveSessionUser(c: Context): Promise<SessionUser | null> {
  const raw = getCookie(c, COOKIE_NAME);
  if (!raw || !raw.startsWith('bt_')) return null;

  const rows = await db
    .select({ user: users, tokenId: authTokens.id, lastUsedAt: authTokens.lastUsedAt })
    .from(authTokens)
    .innerJoin(users, eq(authTokens.userId, users.id))
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(raw)),
        isNull(authTokens.revokedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  if (Date.now() - row.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    // Fire-and-forget freshness bookkeeping; a failure here must not fail the request.
    void db
      .update(authTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(authTokens.id, row.tokenId))
      .catch(() => {});
    void db
      .update(users)
      .set({ lastSeenAt: new Date() })
      .where(eq(users.id, row.user.id))
      .catch(() => {});
  }

  return row.user;
}

export async function revokeCurrentSession(c: Context): Promise<void> {
  const raw = getCookie(c, COOKIE_NAME);
  if (raw && raw.startsWith('bt_')) {
    await db
      .update(authTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(authTokens.tokenHash, hashToken(raw)), isNull(authTokens.revokedAt)));
  }
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  const now = new Date();
  await db
    .update(authTokens)
    .set({ revokedAt: now })
    .where(and(eq(authTokens.userId, userId), isNull(authTokens.revokedAt)));
  await db
    .update(magicTokens)
    .set({ revokedAt: now })
    .where(and(eq(magicTokens.userId, userId), isNull(magicTokens.revokedAt)));
}

export async function pruneExpiredTokens(): Promise<void> {
  await db.delete(authTokens).where(lt(authTokens.expiresAt, new Date()));
  await db.delete(magicTokens).where(lt(magicTokens.expiresAt, new Date()));
}
