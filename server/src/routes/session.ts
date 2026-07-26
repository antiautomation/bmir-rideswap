import { zValidator } from '@hono/zod-validator';
import { and, eq, ne, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ensureUser, requireUser } from '../auth/middleware.js';
import { mintMagicToken } from '../auth/magic.js';
import { findUserByRecoveryCode } from '../auth/recoveryCodes.js';
import { issueSessionCookie, revokeAllSessions, revokeCurrentSession } from '../auth/tokens.js';
import type { SessionUser } from '../auth/tokens.js';
import { unreadCountFor } from './conversations.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { sendEmail } from '../email/ses.js';
import { allow, clientIp } from '../lib/rateLimit.js';
import { rateLimit } from '../lib/settings.js';
import { normalizePhone } from '../lib/phone.js';

/** One account per email: true when another user already owns this address. */
export async function emailTakenByOther(email: string, selfId: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, ne(users.id, selfId)))
    .limit(1);
  return rows.length > 0;
}

export function toMe(user: SessionUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    digestFrequency: user.digestFrequency,
    phoneContactPref: user.phoneContactPref,
    recoveryCode: user.recoveryCode,
    isAdmin: user.isAdmin,
    avatarVersion: user.avatarUpdatedAt?.getTime() ?? null,
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
  phoneContactPref: z.enum(['sms', 'whatsapp']).optional(),
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
    if (!allow(`recover:${clientIp(c)}`, rateLimit('recoveriesPerHour'), 3600_000)) {
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
      if (updates.email && (await emailTakenByOther(updates.email, user.id))) {
        throw new HTTPException(409, { message: 'email_taken' });
      }
    }
    if (data.phone !== undefined) {
      if (data.phone.trim() === '') {
        updates.phone = null;
      } else {
        const normalized = normalizePhone(data.phone);
        if (!normalized) throw new HTTPException(400, { message: 'invalid_phone' });
        updates.phone = normalized;
      }
    }
    if (data.digestFrequency !== undefined) updates.digestFrequency = data.digestFrequency;
    if (data.phoneContactPref !== undefined) updates.phoneContactPref = data.phoneContactPref;

    let updated = user;
    if (Object.keys(updates).length > 0) {
      try {
        const rows = await db.update(users).set(updates).where(eq(users.id, user.id)).returning();
        updated = rows[0]!;
      } catch (err) {
        // Unique-index race: two sessions claiming the same email simultaneously.
        if ((err as { code?: string }).code === '23505') {
          throw new HTTPException(409, { message: 'email_taken' });
        }
        throw err;
      }
    }
    return c.json({ me: toMe(updated) });
  },
);

/* "Send me a magic login link": email-based way back into the account that owns
   an address. Always answers ok — the response never reveals whether an account
   exists (enumeration-safe); the email itself only goes to the owner. */
sessionRoutes.post(
  '/session/email-link',
  zValidator('json', z.object({ email: z.string().email().max(120) }), (result, c) => {
    if (!result.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    if (!allow(`emaillink:${clientIp(c)}`, rateLimit('emailLoginLinksPerHour'), 3600_000)) {
      throw new HTTPException(429, { message: 'rate_limited' });
    }
    const email = c.req.valid('json').email.trim().toLowerCase();
    // Per-address cap regardless of account existence — nobody's inbox gets hammered.
    if (allow(`emaillink-to:${email}`, 3, 3600_000)) {
      const rows = await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      const user = rows[0];
      if (user && !user.bannedAt) {
        const appOrigin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
        const link = `${appOrigin}/a/${await mintMagicToken(user.id)}`;
        const hello = user.name ? `Hey ${user.name},` : 'Hey,';
        await sendEmail({
          userId: user.id,
          to: email,
          kind: 'login_link',
          subject: 'Your RideFinder sign-in link',
          text: `${hello}\n\nHere's your sign-in link for RideFinder:\n\n${link}\n\nIt signs you straight into your account — no password needed — and works for 30 days. If you didn't ask for this, you can ignore it; nobody can get in without this email.\n\n— RideFinder · rides to & from Black Rock City`,
          html: `<p>${hello}</p><p>Here's your sign-in link for RideFinder:</p><p><a href="${link}">Sign in to RideFinder</a></p><p>It signs you straight into your account — no password needed — and works for 30 days. If you didn't ask for this, you can ignore it; nobody can get in without this email.</p><p>— RideFinder · rides to &amp; from Black Rock City</p>`,
        });
      }
    }
    return c.json({ ok: true });
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
