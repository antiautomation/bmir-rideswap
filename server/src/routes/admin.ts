import { timingSafeEqual } from 'node:crypto';
import { zValidator } from '@hono/zod-validator';
import { and, count, desc, eq, gt, isNull, isNotNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ensureUser, requireAdmin } from '../auth/middleware.js';
import { db } from '../db/client.js';
import { emailLog, emailSuppressions, flags, listings, messages, users } from '../db/schema.js';
import { sendEmail } from '../email/ses.js';
import { allow, clientIp } from '../lib/rateLimit.js';

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

adminRoutes.get('/admin/emails', async (c) => {
  requireAdmin(c);
  const rows = await db.select().from(emailLog).orderBy(desc(emailLog.sentAt)).limit(50);
  return c.json({
    emails: rows.map((r) => ({ ...r, sentAt: r.sentAt.toISOString() })),
  });
});

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
