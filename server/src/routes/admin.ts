import { timingSafeEqual } from 'node:crypto';
import { zValidator } from '@hono/zod-validator';
import { and, count, desc, eq, gt, ilike, isNull, isNotNull, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ensureUser, requireAdmin } from '../auth/middleware.js';
import { normalizeRecoveryCode } from '../auth/recoveryCodes.js';
import { db } from '../db/client.js';
import { conversations, emailLog, emailSuppressions, flags, listings, messages, users } from '../db/schema.js';
import { sendEmail } from '../email/ses.js';
import { isUniqueViolation } from '../lib/pg.js';
import { normalizePhone } from '../lib/phone.js';
import { allow, clientIp } from '../lib/rateLimit.js';
import { emailTakenByOther } from './session.js';
import {
  APP_CONFIG_DEFAULTS,
  APP_CONFIG_KEYS,
  getAppConfig,
  getRateLimits,
  RATE_LIMIT_DEFAULTS,
  RATE_LIMIT_KEYS,
  setAppConfig,
  setRateLimits,
  settingMin,
} from '../lib/settings.js';

function keyMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_KEY;
  if (!expected || expected === 'change-me') return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const adminRoutes = new Hono();

adminRoutes.post(
  '/admin/claim',
  zValidator('json', z.object({ key: z.string().min(1).max(200) }), (r, c) => {
    if (!r.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    if (!allow(`admin-claim:${clientIp(c)}`, 3, 3600_000)) {
      throw new HTTPException(429, { message: 'rate_limited' });
    }
    const { key } = c.req.valid('json');
    if (!keyMatches(key)) {
      console.warn(`admin claim FAILED from ${clientIp(c)}`);
      throw new HTTPException(403, { message: 'forbidden' });
    }
    const user = await ensureUser(c);
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, user.id));
    console.warn(`admin claim SUCCEEDED for user ${user.id} from ${clientIp(c)}`);
    return c.json({ ok: true });
  },
);

adminRoutes.get('/admin/overview', async (c) => {
  requireAdmin(c);
  const now = new Date();
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const [userCount] = await db.select({ n: count() }).from(users);
  const [activeListings] = await db
    .select({ n: count() })
    .from(listings)
    .where(and(isNull(listings.deletedAt), isNull(listings.cancelledAt), isNull(listings.hiddenAt), gt(listings.expiresAt, now)));
  const [hiddenListings] = await db.select({ n: count() }).from(listings).where(isNotNull(listings.hiddenAt));
  const [messages24h] = await db.select({ n: count() }).from(messages).where(gt(messages.createdAt, dayAgo));
  const [emails24h] = await db.select({ n: count() }).from(emailLog).where(gt(emailLog.sentAt, dayAgo));
  const [flagCount] = await db.select({ n: count() }).from(flags);
  return c.json({
    users: userCount!.n,
    activeListings: activeListings!.n,
    hiddenListings: hiddenListings!.n,
    messages24h: messages24h!.n,
    emails24h: emails24h!.n,
    totalFlags: flagCount!.n,
  });
});

adminRoutes.get('/admin/flags', async (c) => {
  requireAdmin(c);
  const rows = await db
    .select({
      flagId: flags.id,
      reason: flags.reason,
      createdAt: flags.createdAt,
      listingId: listings.id,
      listingName: listings.name,
      listingType: listings.type,
      hiddenAt: listings.hiddenAt,
      deletedAt: listings.deletedAt,
      ownerBanned: sql<boolean>`(SELECT banned_at IS NOT NULL FROM users WHERE users.id = ${listings.userId})`,
      ownerId: listings.userId,
    })
    .from(flags)
    .innerJoin(listings, eq(flags.listingId, listings.id))
    .orderBy(desc(flags.createdAt))
    .limit(100);
  return c.json({
    flags: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      hiddenAt: r.hiddenAt?.toISOString() ?? null,
      deletedAt: r.deletedAt?.toISOString() ?? null,
    })),
  });
});

async function setListingState(id: string, patch: Partial<typeof listings.$inferInsert>): Promise<void> {
  const updated = await db.update(listings).set(patch).where(eq(listings.id, id)).returning();
  if (updated.length === 0) throw new HTTPException(404, { message: 'not_found' });
}

adminRoutes.post('/admin/listings/:id/hide', async (c) => {
  requireAdmin(c);
  await setListingState(c.req.param('id'), { hiddenAt: new Date() });
  return c.json({ ok: true });
});

adminRoutes.post('/admin/listings/:id/unhide', async (c) => {
  requireAdmin(c);
  await setListingState(c.req.param('id'), { hiddenAt: null });
  return c.json({ ok: true });
});

adminRoutes.post('/admin/listings/:id/restore', async (c) => {
  requireAdmin(c);
  await setListingState(c.req.param('id'), { deletedAt: null });
  return c.json({ ok: true });
});

adminRoutes.post('/admin/users/:id/ban', async (c) => {
  requireAdmin(c);
  const id = c.req.param('id');
  const updated = await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, id)).returning();
  if (updated.length === 0) throw new HTTPException(404, { message: 'not_found' });
  await db.update(listings).set({ hiddenAt: new Date() }).where(and(eq(listings.userId, id), isNull(listings.hiddenAt)));
  return c.json({ ok: true });
});

adminRoutes.post('/admin/users/:id/unban', async (c) => {
  requireAdmin(c);
  const updated = await db.update(users).set({ bannedAt: null }).where(eq(users.id, c.req.param('id'))).returning();
  if (updated.length === 0) throw new HTTPException(404, { message: 'not_found' });
  return c.json({ ok: true });
});

/* Manual contact fixes ("I typo'd my email", "put my new number on it") — same
   normalization and uniqueness rules as the user-facing PATCH /me. */
adminRoutes.patch(
  '/admin/users/:id',
  zValidator(
    'json',
    z
      .object({
        email: z.union([z.string().email().max(120), z.literal('')]).optional(),
        phone: z.union([z.string().max(30), z.literal('')]).optional(),
      })
      .strict(),
    (r, c) => {
      if (!r.success) return c.json({ error: 'invalid' }, 400);
    },
  ),
  async (c) => {
    const admin = requireAdmin(c);
    const id = c.req.param('id');
    const data = c.req.valid('json');

    const updates: Partial<typeof users.$inferInsert> = {};
    if (data.email !== undefined) {
      const trimmed = data.email.trim().toLowerCase();
      updates.email = trimmed === '' ? null : trimmed;
      if (updates.email && (await emailTakenByOther(updates.email, id))) {
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
    if (Object.keys(updates).length === 0) return c.json({ ok: true });

    try {
      const updated = await db.update(users).set(updates).where(eq(users.id, id)).returning();
      if (updated.length === 0) throw new HTTPException(404, { message: 'not_found' });
    } catch (err) {
      if (isUniqueViolation(err)) throw new HTTPException(409, { message: 'email_taken' });
      throw err;
    }
    console.warn(`admin ${admin.id} edited contact info for user ${id}`);
    return c.json({ ok: true });
  },
);

adminRoutes.get('/admin/emails', async (c) => {
  requireAdmin(c);
  const rows = await db.select().from(emailLog).orderBy(desc(emailLog.sentAt)).limit(50);
  return c.json({
    emails: rows.map((r) => ({ ...r, sentAt: r.sentAt.toISOString() })),
  });
});

adminRoutes.get('/admin/suppressions', async (c) => {
  requireAdmin(c);
  const q = (c.req.query('q') ?? '').trim();
  const rows = await db
    .select()
    .from(emailSuppressions)
    .where(q ? ilike(emailSuppressions.email, `%${q}%`) : undefined)
    .orderBy(desc(emailSuppressions.createdAt))
    .limit(200);
  return c.json({
    suppressions: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
});

adminRoutes.post(
  '/admin/unsuppress',
  zValidator('json', z.object({ email: z.string().email() }), (r, c) => {
    if (!r.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    const admin = requireAdmin(c);
    const email = c.req.valid('json').email.trim().toLowerCase();
    const removed = await db.delete(emailSuppressions).where(eq(emailSuppressions.email, email)).returning();
    if (removed.length === 0) throw new HTTPException(404, { message: 'not_found' });
    console.warn(`admin ${admin.id} un-suppressed ${email} (was: ${removed[0]!.reason})`);
    return c.json({ ok: true });
  },
);

adminRoutes.post(
  '/admin/test-email',
  zValidator('json', z.object({ to: z.string().email() }), (r, c) => {
    if (!r.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    const user = requireAdmin(c);
    const { to } = c.req.valid('json');
    const result = await sendEmail({
      userId: user.id,
      to,
      kind: 'test',
      subject: 'RideFinder test email',
      html: '<p>This is a test email from RideFinder. If you can read this, SES is configured correctly. 🔥</p>',
      text: 'This is a test email from RideFinder. If you can read this, SES is configured correctly.',
    });
    return c.json({ sent: result.sent, messageId: result.messageId, dryRun: process.env.EMAIL_DRY_RUN === '1' });
  },
);

/* ---------- Users: browse, security review, ban-by-code, hard delete ---------- */

adminRoutes.get('/admin/users', async (c) => {
  requireAdmin(c);
  const q = (c.req.query('q') ?? '').trim();
  const limit = Math.min(Number(c.req.query('limit') ?? '100') || 100, 200);
  const includeUnvalidated = c.req.query('includeUnvalidated') === '1';
  const searchCond = q
    ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`), eq(users.recoveryCode, normalizeRecoveryCode(q)))
    : undefined;
  // "Unvalidated" = sessions that never completed anything: no email (posting
  // requires one), no listings, no messages. Usually failed/abandoned attempts.
  const validatedCond = includeUnvalidated
    ? undefined
    : sql`(${users.email} IS NOT NULL
        OR EXISTS (SELECT 1 FROM listings vl WHERE vl.user_id = ${users.id})
        OR EXISTS (SELECT 1 FROM messages vm WHERE vm.sender_user_id = ${users.id}))`;
  const where = searchCond && validatedCond ? and(searchCond, validatedCond) : (searchCond ?? validatedCond);
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      isAdmin: users.isAdmin,
      bannedAt: users.bannedAt,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
      hasAvatar: sql<boolean>`(${users.avatarUpdatedAt} IS NOT NULL)`,
      listingCount: sql<number>`(SELECT count(*)::int FROM listings WHERE listings.user_id = users.id)`,
      messageCount: sql<number>`(SELECT count(*)::int FROM messages WHERE messages.sender_user_id = users.id)`,
      flagsAgainst: sql<number>`(SELECT count(*)::int FROM flags JOIN listings fl ON fl.id = flags.listing_id WHERE fl.user_id = users.id)`,
    })
    .from(users)
    .where(where)
    .orderBy(desc(users.lastSeenAt))
    .limit(limit);
  return c.json({
    users: rows.map((u) => ({
      ...u,
      bannedAt: u.bannedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      lastSeenAt: u.lastSeenAt.toISOString(),
    })),
  });
});

adminRoutes.get('/admin/users/:id', async (c) => {
  requireAdmin(c);
  const id = c.req.param('id');
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) throw new HTTPException(404, { message: 'not_found' });

  const userListings = await db
    .select({
      id: listings.id,
      type: listings.type,
      direction: listings.direction,
      name: listings.name,
      locationRaw: listings.locationRaw,
      travelDate: listings.travelDate,
      details: listings.details,
      createdAt: listings.createdAt,
      expiresAt: listings.expiresAt,
      cancelledAt: listings.cancelledAt,
      deletedAt: listings.deletedAt,
      hiddenAt: listings.hiddenAt,
      flagCount: sql<number>`(SELECT count(*)::int FROM flags WHERE flags.listing_id = listings.id)`,
    })
    .from(listings)
    .where(eq(listings.userId, id))
    .orderBy(desc(listings.createdAt));

  // Every conversation the user participates in (as initiator or listing owner),
  // with the full thread — this is the security-review view.
  const convRows = await db
    .select({
      conv: conversations,
      listingName: listings.name,
      listingId: listings.id,
      listingOwnerId: listings.userId,
    })
    .from(conversations)
    .innerJoin(listings, eq(conversations.listingId, listings.id))
    .where(or(eq(conversations.initiatorUserId, id), eq(listings.userId, id)))
    .orderBy(desc(conversations.createdAt))
    .limit(50);

  const convIds = convRows.map((r) => r.conv.id);
  const allMessages = convIds.length
    ? await db.execute(sql`
        SELECT m.id, m.conversation_id, m.sender_user_id, m.body, m.shared_email, m.shared_phone, m.created_at,
               u.name AS sender_name
        FROM messages m JOIN users u ON u.id = m.sender_user_id
        WHERE m.conversation_id IN (SELECT unnest(ARRAY[${sql.join(convIds.map((cid) => sql`${cid}::uuid`), sql`, `)}]))
        ORDER BY m.created_at ASC`)
    : { rows: [] as Record<string, unknown>[] };

  const counterpartIds = [
    ...new Set(
      convRows.map((r) => (r.conv.initiatorUserId === id ? r.listingOwnerId : r.conv.initiatorUserId)),
    ),
  ];
  const counterparts = counterpartIds.length
    ? await db
        .select({ id: users.id, name: users.name, bannedAt: users.bannedAt })
        .from(users)
        .where(sql`${users.id} IN (SELECT unnest(ARRAY[${sql.join(counterpartIds.map((cid) => sql`${cid}::uuid`), sql`, `)}]))`)
    : [];
  const counterpartById = new Map(counterparts.map((u) => [u.id, u]));

  const messagesByConv = new Map<string, Record<string, unknown>[]>();
  for (const m of allMessages.rows as Record<string, unknown>[]) {
    const key = String(m.conversation_id);
    if (!messagesByConv.has(key)) messagesByConv.set(key, []);
    messagesByConv.get(key)!.push(m);
  }

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      // Detail view only, never the list: lets the operator hand someone their
      // session code in person. A code IS the account — treat accordingly.
      recoveryCode: user.recoveryCode,
      digestFrequency: user.digestFrequency,
      isAdmin: user.isAdmin,
      bannedAt: user.bannedAt?.toISOString() ?? null,
      hasAvatar: user.avatarUpdatedAt != null,
      createdAt: user.createdAt.toISOString(),
      lastSeenAt: user.lastSeenAt.toISOString(),
    },
    listings: userListings.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      expiresAt: l.expiresAt.toISOString(),
      cancelledAt: l.cancelledAt?.toISOString() ?? null,
      deletedAt: l.deletedAt?.toISOString() ?? null,
      hiddenAt: l.hiddenAt?.toISOString() ?? null,
    })),
    conversations: convRows.map((r) => {
      const counterpartId = r.conv.initiatorUserId === id ? r.listingOwnerId : r.conv.initiatorUserId;
      const counterpart = counterpartById.get(counterpartId);
      return {
        id: r.conv.id,
        listingId: r.listingId,
        listingName: r.listingName,
        counterpartId,
        counterpartName: counterpart ? (counterpart.name ?? '(unnamed)') : '(deleted)',
        counterpartBanned: counterpart?.bannedAt != null,
        createdAt: r.conv.createdAt.toISOString(),
        messages: (messagesByConv.get(r.conv.id) ?? []).map((m) => ({
          id: String(m.id),
          fromThisUser: String(m.sender_user_id) === id,
          senderName: String(m.sender_name ?? ''),
          body: String(m.body),
          sharedEmail: (m.shared_email as string | null) ?? null,
          sharedPhone: (m.shared_phone as string | null) ?? null,
          createdAt: new Date(m.created_at as string).toISOString(),
        })),
      };
    }),
  });
});

adminRoutes.post(
  '/admin/ban-by-code',
  zValidator('json', z.object({ code: z.string().min(3).max(100) }), (r, c) => {
    if (!r.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    requireAdmin(c);
    const code = normalizeRecoveryCode(c.req.valid('json').code);
    const [target] = await db.select().from(users).where(eq(users.recoveryCode, code)).limit(1);
    if (!target) throw new HTTPException(404, { message: 'not_found' });
    if (target.isAdmin) throw new HTTPException(400, { message: 'cannot_ban_admin' });
    await db.update(users).set({ bannedAt: new Date() }).where(eq(users.id, target.id));
    await db
      .update(listings)
      .set({ hiddenAt: new Date() })
      .where(and(eq(listings.userId, target.id), isNull(listings.hiddenAt)));
    console.warn(`admin banned user ${target.id} by recovery code`);
    return c.json({ ok: true, userId: target.id, name: target.name });
  },
);

/* Admin management from the console — beats sharing the ADMIN_KEY: every grant
   is attributed in the logs and individually revocable. Self-demotion is
   refused so the last admin can't lock themselves out by accident (the key
   claim remains the recovery path regardless). */

adminRoutes.post('/admin/users/:id/promote', async (c) => {
  const admin = requireAdmin(c);
  const id = c.req.param('id');
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new HTTPException(404, { message: 'not_found' });
  if (target.bannedAt) throw new HTTPException(400, { message: 'cannot_promote_banned' });
  if (!target.isAdmin) {
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, id));
    console.warn(`admin ${admin.id} PROMOTED user ${id} (${target.name ?? 'unnamed'}) to admin`);
  }
  return c.json({ ok: true });
});

adminRoutes.post('/admin/users/:id/demote', async (c) => {
  const admin = requireAdmin(c);
  const id = c.req.param('id');
  if (id === admin.id) throw new HTTPException(400, { message: 'cannot_demote_self' });
  const updated = await db.update(users).set({ isAdmin: false }).where(eq(users.id, id)).returning();
  if (updated.length === 0) throw new HTTPException(404, { message: 'not_found' });
  console.warn(`admin ${admin.id} REVOKED admin from user ${id} (${updated[0]!.name ?? 'unnamed'})`);
  return c.json({ ok: true });
});

adminRoutes.delete('/admin/users/:id', async (c) => {
  const admin = requireAdmin(c);
  const id = c.req.param('id');
  if (id === admin.id) throw new HTTPException(400, { message: 'cannot_delete_self' });
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new HTTPException(404, { message: 'not_found' });
  if (target.isAdmin) throw new HTTPException(400, { message: 'cannot_delete_admin' });

  // Hard delete, FK-dependency order. Listings cascade matches + their flags.
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      DELETE FROM messages WHERE sender_user_id = ${id}
        OR conversation_id IN (
          SELECT co.id FROM conversations co
          LEFT JOIN listings l ON l.id = co.listing_id
          WHERE co.initiator_user_id = ${id} OR l.user_id = ${id})`);
    await tx.execute(sql`
      DELETE FROM conversations WHERE initiator_user_id = ${id}
        OR listing_id IN (SELECT id FROM listings WHERE user_id = ${id})`);
    await tx.execute(sql`DELETE FROM flags WHERE flagger_id = ${id}`);
    await tx.execute(sql`DELETE FROM listings WHERE user_id = ${id}`);
    await tx.execute(sql`UPDATE email_log SET user_id = NULL WHERE user_id = ${id}`);
    await tx.execute(sql`DELETE FROM users WHERE id = ${id}`);
  });
  console.warn(`admin ${admin.id} hard-DELETED user ${id} (${target.name ?? 'unnamed'})`);
  return c.json({ ok: true });
});

/* ---------- Listings browse + soft delete ---------- */

adminRoutes.get('/admin/listings', async (c) => {
  requireAdmin(c);
  const state = c.req.query('state') ?? 'all';
  const q = (c.req.query('q') ?? '').trim();
  const now = new Date();
  const conds = [];
  if (state === 'active') {
    conds.push(isNull(listings.cancelledAt), isNull(listings.deletedAt), isNull(listings.hiddenAt), gt(listings.expiresAt, now));
  } else if (state === 'hidden') conds.push(isNotNull(listings.hiddenAt));
  else if (state === 'cancelled') conds.push(isNotNull(listings.cancelledAt));
  else if (state === 'deleted') conds.push(isNotNull(listings.deletedAt));
  else if (state === 'expired') conds.push(sql`${listings.expiresAt} <= ${now}`);
  if (q) conds.push(or(ilike(listings.name, `%${q}%`), ilike(listings.locationRaw, `%${q}%`))!);

  const rows = await db
    .select({
      id: listings.id,
      type: listings.type,
      direction: listings.direction,
      name: listings.name,
      locationRaw: listings.locationRaw,
      travelDate: listings.travelDate,
      createdAt: listings.createdAt,
      expiresAt: listings.expiresAt,
      cancelledAt: listings.cancelledAt,
      deletedAt: listings.deletedAt,
      hiddenAt: listings.hiddenAt,
      ownerId: listings.userId,
      ownerName: users.name,
      ownerBanned: sql<boolean>`(${users.bannedAt} IS NOT NULL)`,
      flagCount: sql<number>`(SELECT count(*)::int FROM flags WHERE flags.listing_id = listings.id)`,
    })
    .from(listings)
    .innerJoin(users, eq(listings.userId, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(listings.createdAt))
    .limit(200);
  return c.json({
    listings: rows.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      expiresAt: l.expiresAt.toISOString(),
      cancelledAt: l.cancelledAt?.toISOString() ?? null,
      deletedAt: l.deletedAt?.toISOString() ?? null,
      hiddenAt: l.hiddenAt?.toISOString() ?? null,
    })),
  });
});

adminRoutes.post('/admin/listings/:id/delete', async (c) => {
  requireAdmin(c);
  await setListingState(c.req.param('id'), { deletedAt: new Date() });
  return c.json({ ok: true });
});

/* ---------- Messages review ---------- */

adminRoutes.get('/admin/messages', async (c) => {
  requireAdmin(c);
  const limit = Math.min(Number(c.req.query('limit') ?? '100') || 100, 200);
  const result = await db.execute(sql`
    SELECT m.id, m.body, m.shared_email, m.shared_phone, m.created_at, m.conversation_id,
           s.id AS sender_id, s.name AS sender_name, (s.banned_at IS NOT NULL) AS sender_banned,
           r.id AS recipient_id, r.name AS recipient_name,
           l.name AS listing_name, l.id AS listing_id
    FROM messages m
    JOIN conversations co ON co.id = m.conversation_id
    JOIN listings l ON l.id = co.listing_id
    JOIN users s ON s.id = m.sender_user_id
    JOIN users r ON r.id = (CASE WHEN m.sender_user_id = co.initiator_user_id THEN l.user_id ELSE co.initiator_user_id END)
    ORDER BY m.created_at DESC
    LIMIT ${limit}`);
  return c.json({
    messages: (result.rows as Record<string, unknown>[]).map((m) => ({
      id: String(m.id),
      body: String(m.body),
      sharedEmail: (m.shared_email as string | null) ?? null,
      sharedPhone: (m.shared_phone as string | null) ?? null,
      createdAt: new Date(m.created_at as string).toISOString(),
      conversationId: String(m.conversation_id),
      senderId: String(m.sender_id),
      senderName: (m.sender_name as string | null) ?? '(unnamed)',
      senderBanned: Boolean(m.sender_banned),
      recipientId: String(m.recipient_id),
      recipientName: (m.recipient_name as string | null) ?? '(unnamed)',
      listingId: String(m.listing_id),
      listingName: String(m.listing_name),
    })),
  });
});

/* ---------- Metrics (server-side, privacy-preserving) ---------- */

adminRoutes.get('/admin/metrics', async (c) => {
  requireAdmin(c);
  const days = Math.min(Math.max(Number(c.req.query('days') ?? '14') || 14, 7), 90);
  const since = sql`current_date - ${days}::int`;

  const traffic = await db.execute(sql`
    SELECT day::text, count(*)::int AS pageviews, count(DISTINCT ip_hash)::int AS visitors
    FROM visits WHERE day > ${since} GROUP BY day ORDER BY day`);
  const activity = await db.execute(sql`
    SELECT d.day::text,
      (SELECT count(*)::int FROM users u WHERE u.created_at::date = d.day) AS new_users,
      (SELECT count(*)::int FROM listings l WHERE l.created_at::date = d.day) AS new_listings,
      (SELECT count(*)::int FROM messages m WHERE m.created_at::date = d.day) AS messages
    FROM generate_series(current_date - ${days}::int + 1, current_date, '1 day') AS d(day)
    ORDER BY d.day`);
  const referrers = await db.execute(sql`
    SELECT referrer_host, count(DISTINCT ip_hash)::int AS visitors
    FROM visits WHERE day > ${since} AND referrer_host IS NOT NULL
    GROUP BY referrer_host ORDER BY visitors DESC LIMIT 15`);
  const regions = await db.execute(sql`
    SELECT coalesce(g.region, 'Unknown') AS region, count(DISTINCT v.ip_hash)::int AS visitors
    FROM visits v LEFT JOIN ip_geo g ON g.ip_hash = v.ip_hash
    WHERE v.day > ${since}
    GROUP BY 1 ORDER BY visitors DESC LIMIT 15`);
  const topPaths = await db.execute(sql`
    SELECT path, count(*)::int AS views FROM visits WHERE day > ${since}
    GROUP BY path ORDER BY views DESC LIMIT 10`);
  const totals = await db.execute(sql`
    SELECT
      (SELECT count(DISTINCT ip_hash)::int FROM visits WHERE day > ${since}) AS visitors,
      (SELECT count(*)::int FROM visits WHERE day > ${since}) AS pageviews,
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM messages) AS messages,
      (SELECT count(*)::int FROM matches) AS matches`);

  return c.json({
    days,
    traffic: traffic.rows,
    activity: activity.rows,
    referrers: referrers.rows,
    regions: regions.rows,
    topPaths: topPaths.rows,
    totals: totals.rows[0] ?? {},
  });
});

/* ---------- Runtime settings (rate limits) ---------- */

adminRoutes.get('/admin/settings', async (c) => {
  requireAdmin(c);
  return c.json({
    rateLimits: await getRateLimits(),
    defaults: RATE_LIMIT_DEFAULTS,
    appConfig: await getAppConfig(),
    appConfigDefaults: APP_CONFIG_DEFAULTS,
  });
});

adminRoutes.put(
  '/admin/settings',
  zValidator(
    'json',
    z.object({
      rateLimits: z
        .object(
          Object.fromEntries(RATE_LIMIT_KEYS.map((k) => [k, z.number().int().min(1).max(100_000).optional()])),
        )
        .strict()
        .optional(),
      appConfig: z
        .object(
          Object.fromEntries(APP_CONFIG_KEYS.map((k) => [k, z.number().int().min(settingMin(k)).max(10_000).optional()])),
        )
        .strict()
        .optional(),
    }),
    (r, c) => {
      if (!r.success) return c.json({ error: 'invalid' }, 400);
    },
  ),
  async (c) => {
    requireAdmin(c);
    const body = c.req.valid('json');
    if (body.rateLimits) await setRateLimits(body.rateLimits);
    if (body.appConfig) await setAppConfig(body.appConfig);
    console.warn('admin updated settings', JSON.stringify(body));
    return c.json({ rateLimits: await getRateLimits(), appConfig: await getAppConfig() });
  },
);

// SNS bounce/complaint webhook. v1 trust model: unguessable-enough path + payload shape
// checks; optionally pin the topic via SES_SNS_TOPIC_ARN.
export const webhookRoutes = new Hono();

webhookRoutes.post('/webhooks/ses', async (c) => {
  let payload: Record<string, unknown>;
  try {
    payload = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'invalid' }, 400);
  }

  const pinnedTopic = process.env.SES_SNS_TOPIC_ARN;
  if (pinnedTopic && payload.TopicArn !== pinnedTopic) {
    return c.json({ error: 'forbidden' }, 403);
  }

  if (payload.Type === 'SubscriptionConfirmation' && typeof payload.SubscribeURL === 'string') {
    const url = new URL(payload.SubscribeURL);
    if (url.hostname.endsWith('.amazonaws.com')) {
      await fetch(payload.SubscribeURL);
      console.log('SNS subscription confirmed');
    }
    return c.json({ ok: true });
  }

  if (payload.Type === 'Notification' && typeof payload.Message === 'string') {
    try {
      const msg = JSON.parse(payload.Message) as {
        notificationType?: string;
        bounce?: { bounceType?: string; bouncedRecipients?: { emailAddress?: string }[] };
        complaint?: { complainedRecipients?: { emailAddress?: string }[] };
      };
      const suppress: { email: string; reason: string }[] = [];
      if (msg.notificationType === 'Bounce' && msg.bounce?.bounceType === 'Permanent') {
        for (const r of msg.bounce.bouncedRecipients ?? []) {
          if (r.emailAddress) suppress.push({ email: r.emailAddress.toLowerCase(), reason: 'bounce' });
        }
      }
      if (msg.notificationType === 'Complaint') {
        for (const r of msg.complaint?.complainedRecipients ?? []) {
          if (r.emailAddress) suppress.push({ email: r.emailAddress.toLowerCase(), reason: 'complaint' });
        }
      }
      for (const s of suppress) {
        await db.insert(emailSuppressions).values(s).onConflictDoNothing();
        console.warn(`email suppressed (${s.reason}): ${s.email}`);
      }
    } catch (err) {
      console.error('SNS notification parse failed', err);
    }
  }
  return c.json({ ok: true });
});
