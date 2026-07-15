import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import { createAnonUser } from './recoveryCodes.js';
import { issueSessionCookie, resolveSessionUser, type SessionUser } from './tokens.js';
import { allow, clientIp } from '../lib/rateLimit.js';

declare module 'hono' {
  interface ContextVariableMap {
    user: SessionUser | null;
  }
}

export const sessionMiddleware = createMiddleware(async (c, next) => {
  c.set('user', await resolveSessionUser(c));
  await next();
});

export function requireUser(c: Context): SessionUser {
  const user = c.get('user');
  if (!user) throw new HTTPException(401, { message: 'no_session' });
  if (user.bannedAt) throw new HTTPException(403, { message: 'banned' });
  return user;
}

export function requireAdmin(c: Context): SessionUser {
  const user = requireUser(c);
  if (!user.isAdmin) throw new HTTPException(403, { message: 'forbidden' });
  return user;
}

// Returns the current session's user, creating an anonymous user + session cookie
// on first write. Use on endpoints where a session should exist implicitly.
export async function ensureUser(c: Context): Promise<SessionUser> {
  const existing = c.get('user');
  if (existing) {
    if (existing.bannedAt) throw new HTTPException(403, { message: 'banned' });
    return existing;
  }
  if (!allow(`anon:${clientIp(c)}`, 10, 3600_000)) {
    throw new HTTPException(429, { message: 'rate_limited' });
  }
  const user = await createAnonUser();
  await issueSessionCookie(c, user.id);
  c.set('user', user);
  return user;
}
