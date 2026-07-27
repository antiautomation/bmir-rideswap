// Admin API for outreach: contacts, contact lists, and email campaigns.
//
// Kept out of admin.ts so that file doesn't keep growing; mounted under the same
// /api prefix, using the same requireAdmin(c)-as-first-line convention.

import { zValidator } from '@hono/zod-validator';
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { requireAdmin } from '../auth/middleware.js';
import { db } from '../db/client.js';
import {
  campaigns,
  campaignSends,
  contactListMembers,
  contactLists,
  contacts,
  emailSuppressions,
} from '../db/schema.js';
import {
  DEFAULT_ANNOUNCEMENT_HEADLINE,
  DEFAULT_ANNOUNCEMENT_INTRO,
} from '../email/announcement.js';
import { DEFAULT_HEADLINE, DEFAULT_INTRO, DEFAULT_SUBJECT } from '../email/invite.js';
import { sendEmail, unsubscribeHeaders } from '../email/ses.js';
import { renderForContact, startCampaign } from '../jobs/campaigns.js';
import { AUDIENCES, countAudience, findAudience, refreshDynamicList } from '../lib/audiences.js';
import { MAX_PASTE_ENTRIES, parseContactText } from '../lib/contactParse.js';
import { addToList, newUnsubscribeToken, upsertContacts } from '../lib/contacts.js';

export const adminOutreachRoutes = new Hono();

function origin(): string {
  return (process.env.APP_ORIGIN ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/** Member counts + how many of them are actually mailable. */
const memberCount = sql<number>`(SELECT count(*) FROM contact_list_members m WHERE m.list_id = ${contactLists.id})::int`;
const sendableCount = sql<number>`(
  SELECT count(*) FROM contact_list_members m
  JOIN contacts ct ON ct.email = m.email
  WHERE m.list_id = ${contactLists.id} AND ct.unsubscribed_at IS NULL AND ct.excluded_at IS NULL
)::int`;

/* ---------- Overview ---------- */

adminOutreachRoutes.get('/admin/outreach/stats', async (c) => {
  requireAdmin(c);
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      unsubscribed: sql<number>`count(*) FILTER (WHERE unsubscribed_at IS NOT NULL)::int`,
      excluded: sql<number>`count(*) FILTER (WHERE excluded_at IS NOT NULL)::int`,
      sendable: sql<number>`count(*) FILTER (WHERE unsubscribed_at IS NULL AND excluded_at IS NULL)::int`,
      linkedToUsers: sql<number>`count(*) FILTER (WHERE user_id IS NOT NULL)::int`,
    })
    .from(contacts);

  const bySource = await db
    .select({ source: contacts.source, n: sql<number>`count(*)::int` })
    .from(contacts)
    .groupBy(contacts.source)
    .orderBy(desc(sql`count(*)`));

  const reasons = await db
    .select({ reason: sql<string>`split_part(exclude_reason, ':', 1)`, n: sql<number>`count(*)::int` })
    .from(contacts)
    .where(sql`exclude_reason IS NOT NULL`)
    .groupBy(sql`split_part(exclude_reason, ':', 1)`)
    .orderBy(desc(sql`count(*)`));

  const [suppressed] = await db.select({ n: sql<number>`count(*)::int` }).from(emailSuppressions);

  return c.json({
    ...totals,
    bySource,
    excludeReasons: reasons,
    suppressionListSize: suppressed?.n ?? 0,
    audiences: AUDIENCES.map((a) => ({ key: a.key, label: a.label, description: a.description })),
  });
});

/* ---------- Lists ---------- */

adminOutreachRoutes.get('/admin/lists', async (c) => {
  requireAdmin(c);
  const rows = await db
    .select({
      id: contactLists.id,
      name: contactLists.name,
      description: contactLists.description,
      kind: contactLists.kind,
      query: contactLists.query,
      createdAt: contactLists.createdAt,
      refreshedAt: contactLists.refreshedAt,
      members: memberCount,
      sendable: sendableCount,
      campaignCount: sql<number>`(SELECT count(*) FROM campaigns cp WHERE cp.list_id = ${contactLists.id})::int`,
    })
    .from(contactLists)
    .orderBy(desc(contactLists.createdAt));

  return c.json({
    lists: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      refreshedAt: r.refreshedAt?.toISOString() ?? null,
    })),
    audiences: AUDIENCES.map((a) => ({ key: a.key, label: a.label, description: a.description })),
  });
});

adminOutreachRoutes.post(
  '/admin/lists',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(120),
      description: z.string().max(500).nullable().optional(),
      kind: z.enum(['static', 'dynamic']),
      query: z.string().max(60).nullable().optional(),
    }),
    (r, c) => {
      if (!r.success) return c.json({ error: 'invalid' }, 400);
    },
  ),
  async (c) => {
    const admin = requireAdmin(c);
    const body = c.req.valid('json');
    if (body.kind === 'dynamic') {
      if (!body.query || !findAudience(body.query)) throw new HTTPException(400, { message: 'unknown_audience' });
    }

    const [existing] = await db
      .select({ id: contactLists.id })
      .from(contactLists)
      .where(eq(contactLists.name, body.name));
    if (existing) throw new HTTPException(409, { message: 'name_taken' });

    const [row] = await db
      .insert(contactLists)
      .values({
        name: body.name,
        description: body.description ?? null,
        kind: body.kind,
        query: body.kind === 'dynamic' ? body.query! : null,
        createdBy: admin.id,
      })
      .returning({ id: contactLists.id });

    // A dynamic list is useless until it's populated, so do it immediately. If
    // that fails, roll the list back rather than leaving an empty orphan behind.
    if (body.kind === 'dynamic') {
      try {
        await refreshDynamicList(row!.id);
      } catch (err) {
        await db.delete(contactLists).where(eq(contactLists.id, row!.id));
        console.error(`dynamic list creation rolled back (${body.query}):`, err);
        throw new HTTPException(500, { message: 'audience_refresh_failed' });
      }
    }

    return c.json({ id: row!.id });
  },
);

adminOutreachRoutes.patch(
  '/admin/lists/:id',
  zValidator(
    'json',
    z.object({ name: z.string().min(1).max(120), description: z.string().max(500).nullable().optional() }),
    (r, c) => {
      if (!r.success) return c.json({ error: 'invalid' }, 400);
    },
  ),
  async (c) => {
    requireAdmin(c);
    const body = c.req.valid('json');
    const updated = await db
      .update(contactLists)
      .set({ name: body.name, description: body.description ?? null })
      .where(eq(contactLists.id, c.req.param('id')))
      .returning({ id: contactLists.id });
    if (updated.length === 0) throw new HTTPException(404, { message: 'not_found' });
    return c.json({ ok: true });
  },
);

adminOutreachRoutes.delete('/admin/lists/:id', async (c) => {
  requireAdmin(c);
  const id = c.req.param('id');
  const [list] = await db.select({ id: contactLists.id }).from(contactLists).where(eq(contactLists.id, id));
  if (!list) throw new HTTPException(404, { message: 'not_found' });

  // The FK is RESTRICT; give a useful error instead of a raw constraint failure.
  const [used] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(campaigns)
    .where(eq(campaigns.listId, id));
  if ((used?.n ?? 0) > 0) throw new HTTPException(409, { message: 'list_in_use_by_campaign' });

  // Membership cascades; the contacts themselves survive on their other lists.
  await db.delete(contactLists).where(eq(contactLists.id, id));
  console.warn(`contact list ${id} deleted`);
  return c.json({ ok: true });
});

adminOutreachRoutes.post('/admin/lists/:id/refresh', async (c) => {
  requireAdmin(c);
  try {
    const result = await refreshDynamicList(c.req.param('id'));
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'refresh_failed';
    throw new HTTPException(message === 'list_not_found' ? 404 : 400, { message });
  }
});

/** Preview how many accounts an audience currently resolves to. */
adminOutreachRoutes.get('/admin/audiences/:key/count', async (c) => {
  requireAdmin(c);
  try {
    return c.json({ count: await countAudience(c.req.param('key')) });
  } catch {
    throw new HTTPException(400, { message: 'unknown_audience' });
  }
});

/* ---------- Members ---------- */

adminOutreachRoutes.get('/admin/lists/:id/members', async (c) => {
  requireAdmin(c);
  const listId = c.req.param('id');
  const q = (c.req.query('q') ?? '').trim();
  const state = c.req.query('state') ?? 'all'; // all | sendable | excluded | unsubscribed
  const limit = Math.min(Number(c.req.query('limit') ?? '200') || 200, 500);

  const conditions = [eq(contactListMembers.listId, listId)];
  if (q) conditions.push(or(ilike(contacts.email, `%${q}%`), ilike(contacts.name, `%${q}%`))!);
  if (state === 'sendable') conditions.push(isNull(contacts.unsubscribedAt), isNull(contacts.excludedAt));
  else if (state === 'excluded') conditions.push(sql`${contacts.excludedAt} IS NOT NULL`);
  else if (state === 'unsubscribed') conditions.push(sql`${contacts.unsubscribedAt} IS NOT NULL`);

  const rows = await db
    .select({
      email: contacts.email,
      name: contacts.name,
      source: contacts.source,
      meta: contacts.meta,
      userId: contacts.userId,
      unsubscribedAt: contacts.unsubscribedAt,
      excludedAt: contacts.excludedAt,
      excludeReason: contacts.excludeReason,
      addedAt: contactListMembers.addedAt,
    })
    .from(contactListMembers)
    .innerJoin(contacts, eq(contactListMembers.email, contacts.email))
    .where(and(...conditions))
    .orderBy(contacts.email)
    .limit(limit);

  return c.json({
    members: rows.map((r) => ({
      ...r,
      unsubscribedAt: r.unsubscribedAt?.toISOString() ?? null,
      excludedAt: r.excludedAt?.toISOString() ?? null,
      addedAt: r.addedAt.toISOString(),
    })),
  });
});

/** Paste import: one address per line, CSV, TSV, or "Name <a@b.com>" — any mix. */
adminOutreachRoutes.post(
  '/admin/lists/:id/paste',
  zValidator(
    'json',
    z.object({ text: z.string().max(1_000_000), dryRun: z.boolean().default(true) }),
    (r, c) => {
      if (!r.success) return c.json({ error: 'invalid' }, 400);
    },
  ),
  async (c) => {
    requireAdmin(c);
    const listId = c.req.param('id');
    const [list] = await db.select({ id: contactLists.id, kind: contactLists.kind }).from(contactLists).where(eq(contactLists.id, listId));
    if (!list) throw new HTTPException(404, { message: 'not_found' });
    if (list.kind === 'dynamic') throw new HTTPException(409, { message: 'list_is_dynamic' });

    const { text, dryRun } = c.req.valid('json');
    const parsed = parseContactText(text);

    // Which of these are new to this list vs already on it?
    const emails = parsed.entries.map((e) => e.email);
    let alreadyOnList = 0;
    if (emails.length > 0) {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(contactListMembers)
        .where(and(eq(contactListMembers.listId, listId), inArray(contactListMembers.email, emails)));
      alreadyOnList = row?.n ?? 0;
    }

    if (dryRun) {
      return c.json({
        dryRun: true,
        ...parsed.stats,
        parsed: parsed.entries.length,
        alreadyOnList,
        wouldAdd: parsed.entries.length - alreadyOnList,
        truncated: parsed.stats.valid > MAX_PASTE_ENTRIES,
        invalidSamples: parsed.invalid,
        sample: parsed.entries.slice(0, 10),
      });
    }

    const upsert = await upsertContacts(parsed.entries, 'paste');
    const { added } = await addToList(listId, emails);
    console.warn(
      `paste import into list ${listId}: ${parsed.entries.length} parsed, ${added} added, ${upsert.inserted} new contacts`,
    );

    return c.json({
      dryRun: false,
      ...parsed.stats,
      parsed: parsed.entries.length,
      alreadyOnList,
      added,
      newContacts: upsert.inserted,
      refreshedContacts: upsert.updated,
      autoExcluded: upsert.excluded,
      truncated: parsed.stats.valid > MAX_PASTE_ENTRIES,
      invalidSamples: parsed.invalid,
    });
  },
);

adminOutreachRoutes.delete(
  '/admin/lists/:id/members',
  zValidator('json', z.object({ email: z.string().email() }), (r, c) => {
    if (!r.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    requireAdmin(c);
    const { email } = c.req.valid('json');
    const removed = await db
      .delete(contactListMembers)
      .where(and(eq(contactListMembers.listId, c.req.param('id')), eq(contactListMembers.email, email)))
      .returning({ email: contactListMembers.email });
    if (removed.length === 0) throw new HTTPException(404, { message: 'not_found' });
    return c.json({ ok: true });
  },
);

/** Hold an address back from every campaign, or release it. Global, not per-list. */
adminOutreachRoutes.post(
  '/admin/contacts/exclude',
  zValidator(
    'json',
    z.object({ email: z.string().email(), exclude: z.boolean(), reason: z.string().max(120).optional() }),
    (r, c) => {
      if (!r.success) return c.json({ error: 'invalid' }, 400);
    },
  ),
  async (c) => {
    requireAdmin(c);
    const { email, exclude, reason } = c.req.valid('json');
    const updated = await db
      .update(contacts)
      .set(
        exclude
          ? { excludedAt: new Date(), excludeReason: reason ?? 'manual', updatedAt: new Date() }
          : { excludedAt: null, excludeReason: null, updatedAt: new Date() },
      )
      .where(eq(contacts.email, email))
      .returning({ email: contacts.email });
    if (updated.length === 0) throw new HTTPException(404, { message: 'not_found' });
    return c.json({ ok: true });
  },
);

/* ---------- Campaigns ---------- */

const campaignBody = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(200),
  listId: z.string().uuid(),
  template: z.enum(['invite', 'announcement']),
  headline: z.string().max(200).nullable().optional(),
  intro: z.string().max(20_000).nullable().optional(),
  ctaLabel: z.string().max(60).nullable().optional(),
  ctaPath: z.string().max(300).nullable().optional(),
  throttlePerMinute: z.number().int().min(1).max(500),
});

adminOutreachRoutes.get('/admin/campaigns', async (c) => {
  requireAdmin(c);
  const rows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      subject: campaigns.subject,
      listId: campaigns.listId,
      listName: contactLists.name,
      template: campaigns.template,
      status: campaigns.status,
      throttlePerMinute: campaigns.throttlePerMinute,
      createdAt: campaigns.createdAt,
      startedAt: campaigns.startedAt,
      finishedAt: campaigns.finishedAt,
      total: sql<number>`(SELECT count(*) FROM campaign_sends s WHERE s.campaign_id = ${campaigns.id})::int`,
      sent: sql<number>`(SELECT count(*) FROM campaign_sends s WHERE s.campaign_id = ${campaigns.id} AND s.status = 'sent')::int`,
      pending: sql<number>`(SELECT count(*) FROM campaign_sends s WHERE s.campaign_id = ${campaigns.id} AND s.status = 'pending')::int`,
      failed: sql<number>`(SELECT count(*) FROM campaign_sends s WHERE s.campaign_id = ${campaigns.id} AND s.status = 'failed')::int`,
    })
    .from(campaigns)
    .innerJoin(contactLists, eq(campaigns.listId, contactLists.id))
    .orderBy(desc(campaigns.createdAt))
    .limit(50);

  return c.json({
    campaigns: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      startedAt: r.startedAt?.toISOString() ?? null,
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
    defaults: {
      invite: { subject: DEFAULT_SUBJECT, headline: DEFAULT_HEADLINE, intro: DEFAULT_INTRO },
      announcement: {
        subject: 'An update from RideFinder',
        headline: DEFAULT_ANNOUNCEMENT_HEADLINE,
        intro: DEFAULT_ANNOUNCEMENT_INTRO,
      },
    },
  });
});

adminOutreachRoutes.post(
  '/admin/campaigns',
  zValidator('json', campaignBody, (r, c) => {
    if (!r.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    const admin = requireAdmin(c);
    const body = c.req.valid('json');
    const [list] = await db.select({ id: contactLists.id }).from(contactLists).where(eq(contactLists.id, body.listId));
    if (!list) throw new HTTPException(400, { message: 'unknown_list' });

    const [row] = await db
      .insert(campaigns)
      .values({
        name: body.name,
        subject: body.subject,
        listId: body.listId,
        template: body.template,
        headline: body.headline ?? null,
        intro: body.intro ?? null,
        ctaLabel: body.ctaLabel ?? null,
        ctaPath: body.ctaPath ?? null,
        throttlePerMinute: body.throttlePerMinute,
        createdBy: admin.id,
      })
      .returning({ id: campaigns.id });
    return c.json({ id: row!.id });
  },
);

adminOutreachRoutes.put(
  '/admin/campaigns/:id',
  zValidator('json', campaignBody, (r, c) => {
    if (!r.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    requireAdmin(c);
    const id = c.req.param('id');
    const [existing] = await db
      .select({ status: campaigns.status, listId: campaigns.listId })
      .from(campaigns)
      .where(eq(campaigns.id, id));
    if (!existing) throw new HTTPException(404, { message: 'not_found' });
    if (existing.status === 'sending') throw new HTTPException(409, { message: 'pause_first' });
    const body = c.req.valid('json');
    // Audience swap: the queue was materialised from the OLD list. Drop rows
    // not yet acted on so a restart doesn't mail people outside the new
    // audience; sent/suppressed/unsubscribed history stays for the stats.
    if (body.listId !== existing.listId) {
      await db
        .delete(campaignSends)
        .where(and(eq(campaignSends.campaignId, id), eq(campaignSends.status, 'pending')));
    }
    await db
      .update(campaigns)
      .set({
        name: body.name,
        subject: body.subject,
        listId: body.listId,
        template: body.template,
        headline: body.headline ?? null,
        intro: body.intro ?? null,
        ctaLabel: body.ctaLabel ?? null,
        ctaPath: body.ctaPath ?? null,
        throttlePerMinute: body.throttlePerMinute,
      })
      .where(eq(campaigns.id, id));
    return c.json({ ok: true });
  },
);

adminOutreachRoutes.get('/admin/campaigns/:id', async (c) => {
  requireAdmin(c);
  const id = c.req.param('id');
  const [campaign] = await db
    .select({
      campaign: campaigns,
      listName: contactLists.name,
      listKind: contactLists.kind,
      listSendable: sendableCount,
    })
    .from(campaigns)
    .innerJoin(contactLists, eq(campaigns.listId, contactLists.id))
    .where(eq(campaigns.id, id))
    .limit(1);
  if (!campaign) throw new HTTPException(404, { message: 'not_found' });

  const breakdown = await db
    .select({ status: campaignSends.status, n: sql<number>`count(*)::int` })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, id))
    .groupBy(campaignSends.status);

  const recent = await db
    .select({
      email: campaignSends.email,
      status: campaignSends.status,
      error: campaignSends.error,
      attempts: campaignSends.attempts,
      sentAt: campaignSends.sentAt,
    })
    .from(campaignSends)
    .where(and(eq(campaignSends.campaignId, id), sql`${campaignSends.sentAt} IS NOT NULL`))
    .orderBy(desc(campaignSends.sentAt))
    .limit(25);

  const problems = await db
    .select({
      email: campaignSends.email,
      status: campaignSends.status,
      error: campaignSends.error,
      attempts: campaignSends.attempts,
    })
    .from(campaignSends)
    .where(and(eq(campaignSends.campaignId, id), eq(campaignSends.status, 'failed')))
    .limit(25);

  const cp = campaign.campaign;
  return c.json({
    campaign: {
      ...cp,
      createdAt: cp.createdAt.toISOString(),
      startedAt: cp.startedAt?.toISOString() ?? null,
      finishedAt: cp.finishedAt?.toISOString() ?? null,
    },
    listName: campaign.listName,
    listKind: campaign.listKind,
    listSendable: campaign.listSendable,
    breakdown,
    recent: recent.map((r) => ({ ...r, sentAt: r.sentAt?.toISOString() ?? null })),
    problems,
  });
});

/** A throwaway contact shape for previews and tests — never persisted. */
function previewContact(name: string, asUser: boolean, segment: 'driver' | 'rider' | 'both') {
  return {
    email: 'preview@example.com',
    name,
    meta: { segment },
    userId: asUser ? 'preview' : null,
    unsubscribeToken: 'PREVIEW-TOKEN-NOT-REAL',
  };
}

/** Rendered HTML for the compose-screen preview iframe. */
adminOutreachRoutes.get('/admin/campaigns/:id/preview', async (c) => {
  requireAdmin(c);
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, c.req.param('id'))).limit(1);
  if (!campaign) throw new HTTPException(404, { message: 'not_found' });
  const asSegment = c.req.query('segment');
  const segment = asSegment === 'driver' || asSegment === 'rider' ? asSegment : 'both';
  const { html } = renderForContact(campaign, previewContact('Dusty', c.req.query('asUser') === '1', segment), origin());
  return c.html(html);
});

adminOutreachRoutes.post(
  '/admin/campaigns/:id/test',
  zValidator(
    'json',
    z.object({ to: z.string().email(), segment: z.enum(['driver', 'rider', 'both']).default('both') }),
    (r, c) => {
      if (!r.success) return c.json({ error: 'invalid' }, 400);
    },
  ),
  async (c) => {
    const admin = requireAdmin(c);
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, c.req.param('id'))).limit(1);
    if (!campaign) throw new HTTPException(404, { message: 'not_found' });
    const { to, segment } = c.req.valid('json');

    // Use the real contact row if we have one, so the test exercises the actual
    // unsubscribe link; otherwise a dead token that resolves to nothing.
    const [existing] = await db.select().from(contacts).where(eq(contacts.email, to)).limit(1);
    const contact = existing ?? {
      email: to,
      name: admin.name,
      meta: { segment },
      userId: admin.id,
      unsubscribeToken: `TEST-${newUnsubscribeToken()}`,
    };

    const { subject, html, text } = renderForContact(campaign, contact, origin());
    const result = await sendEmail({
      userId: admin.id,
      to,
      kind: `${campaign.template}-test`,
      subject,
      html,
      text,
      headers: unsubscribeHeaders(`${origin()}/u/${contact.unsubscribeToken}`),
    });
    return c.json({ sent: result.sent, messageId: result.messageId, dryRun: process.env.EMAIL_DRY_RUN === '1' });
  },
);

adminOutreachRoutes.post('/admin/campaigns/:id/start', async (c) => {
  requireAdmin(c);
  const id = c.req.param('id');
  const [campaign] = await db.select({ status: campaigns.status }).from(campaigns).where(eq(campaigns.id, id));
  if (!campaign) throw new HTTPException(404, { message: 'not_found' });
  if (campaign.status === 'sending') throw new HTTPException(409, { message: 'already_sending' });
  // In dry-run mode sendEmail() reports success without delivering, which would
  // silently burn the whole list to 'sent'. Test sends still work in dry-run.
  if (process.env.EMAIL_DRY_RUN === '1') {
    throw new HTTPException(409, { message: 'email_dry_run_enabled' });
  }
  const result = await startCampaign(id);
  console.warn(`campaign ${id} started: ${result.recipients} recipients (${result.alreadySent} already sent)`);
  return c.json(result);
});

adminOutreachRoutes.post('/admin/campaigns/:id/pause', async (c) => {
  requireAdmin(c);
  const id = c.req.param('id');
  const updated = await db
    .update(campaigns)
    .set({ status: 'paused' })
    .where(and(eq(campaigns.id, id), eq(campaigns.status, 'sending')))
    .returning({ id: campaigns.id });
  if (updated.length === 0) throw new HTTPException(409, { message: 'not_sending' });
  console.warn(`campaign ${id} paused`);
  return c.json({ ok: true });
});

/** Put failed rows back in the queue (does not touch anything already sent). */
adminOutreachRoutes.post('/admin/campaigns/:id/retry-failed', async (c) => {
  requireAdmin(c);
  const updated = await db
    .update(campaignSends)
    .set({ status: 'pending', attempts: 0, error: null })
    .where(and(eq(campaignSends.campaignId, c.req.param('id')), eq(campaignSends.status, 'failed')))
    .returning({ email: campaignSends.email });
  return c.json({ requeued: updated.length });
});

adminOutreachRoutes.delete('/admin/campaigns/:id', async (c) => {
  requireAdmin(c);
  const id = c.req.param('id');
  const [campaign] = await db.select({ status: campaigns.status }).from(campaigns).where(eq(campaigns.id, id));
  if (!campaign) throw new HTTPException(404, { message: 'not_found' });
  if (campaign.status === 'sending') throw new HTTPException(409, { message: 'pause_first' });
  await db.delete(campaigns).where(eq(campaigns.id, id));
  console.warn(`campaign ${id} deleted`);
  return c.json({ ok: true });
});
