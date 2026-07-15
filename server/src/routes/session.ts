import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ensureUser, requireUser } from '../auth/middleware.js';
import { findUserByRecoveryCode } from '../auth/recoveryCodes.js';
import { issueSessionCookie, revokeAllSessions, revokeCurrentSession } from '../auth/tokens.js';
import type { SessionUser } from '../auth/tokens.js';
import { unreadCountFor } from './conversations.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { allow, clientIp } from '../lib/rateLimit.js';

export function toMe(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    digestFrequency: user.digestFrequency,
    recoveryCode: user.recoveryCode,
    isAdmin: user.isAdmin,
    unreadCount: 0, // overridden by GET /me; toMe's callers that don't need it keep 0
  };
}

const recoverSchema = z.object({
  code: z.string().min(1).max(60),
});

const meUpdateSchema = z.object({
  name: z.string().max(60).optional(),
  email: z.union([z.string().email().max(120), z.literal('')]).optional(),
  phone: z.union([z.string().max(30), z.literal('')]).optional(),
  digestFrequency: z.enum(['instant', 'hourly', 'daily', 'off']).optional(),
});

export const sessionRoutes = new Hono();

sessionRoutes.post('/session/anon', async (c) => {
  const user = await ensureUser(c);
  return c.json({ me: toMe(user) });
});

sessionRoutes.post(
  '/session/recover',
  zValidator('json', recoverSchema, (result, c) => {
    if (!result.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    if (!allow(`recover:${clientIp(c)}`, 5, 3600_000)) {
      throw new HTTPException(429, { message: 'rate_limited' });
    }
    const { code } = c.req.valid('json');
    const user = await findUserByRecoveryCode(code);
    if (!user) throw new HTTPException(404, { message: 'invalid_code' });
    if (user.bannedAt) throw new HTTPException(403, { message: 'banned' });
    await issueSessionCookie(c, user.id);
    return c.json({ me: toMe(user) });
  },
);

sessionRoutes.get('/me', async (c) => {
  const user = requireUser(c);
  return c.json({ me: { ...toMe(user), unreadCount: await unreadCountFor(user.id) } });
});

sessionRoutes.patch(
  '/me',
  zValidator('json', meUpdateSchema, (result, c) => {
    if (!result.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    const user = await ensureUser(c);
    const data = c.req.valid('json');

    const updates: Partial<typeof users.$inferInsert> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.email !== undefined) {
      const trimmed = data.email.trim().toLowerCase();
      updates.email = trimmed === '' ? null : trimmed;
    }
    if (data.phone !== undefined) {
      const cleaned = data.phone.trim().replace(/[^0-9+()\-\s]/g, '');
      updates.phone = cleaned === '' ? null : cleaned;
    }
    if (data.digestFrequency !== undefined) updates.digestFrequency = data.digestFrequency;

    let updated = user;
    if (Object.keys(updates).length > 0) {
      const rows = await db.update(users).set(updates).where(eq(users.id, user.id)).returning();
      updated = rows[0]!;
    }
    return c.json({ me: toMe(updated) });
  },
);

sessionRoutes.post('/session/logout', async (c) => {
  await revokeCurrentSession(c);
  return c.body(null, 204);
});

sessionRoutes.post('/session/logout-all', async (c) => {
  const user = requireUser(c);
  await revokeAllSessions(user.id);
  await revokeCurrentSession(c);
  return c.body(null, 204);
});
