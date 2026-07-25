// Batched, resumable sender for outreach campaigns.
//
// Runs once a minute behind a Postgres advisory lock and sends at most
// `throttle_per_minute` messages per tick. Slow on purpose: a cold list of a few
// hundred addresses blasted in one go is how a young SES identity gets its
// reputation wrecked. Idempotency comes from campaign_sends — only rows still
// marked 'pending' are ever touched, so a restart mid-send re-mails nobody.

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db, pool } from '../db/client.js';
import { campaigns, campaignSends, contactLists, contacts } from '../db/schema.js';
import { renderAnnouncement } from '../email/announcement.js';
import { renderInvite, type InviteSegment } from '../email/invite.js';
import { sendEmail, unsubscribeHeaders } from '../email/ses.js';
import { refreshDynamicList } from '../lib/audiences.js';
import { sendableEmailsForList } from '../lib/contacts.js';

const CAMPAIGN_LOCK_KEY = 727003;
const MAX_ATTEMPTS = 3;
/** Gap between individual sends, well under any SES per-second cap. */
const SEND_GAP_MS = 200;

function appOrigin(): string {
  return (process.env.APP_ORIGIN ?? 'http://localhost:3000').replace(/\/+$/, '');
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** SES back-pressure — stop the tick rather than burning attempts on every row. */
function isThrottle(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? '';
  return name === 'ThrottlingException' || name === 'TooManyRequestsException' || name === 'LimitExceededException';
}

type CampaignRow = typeof campaigns.$inferSelect;
type ContactRow = typeof contacts.$inferSelect;

/** Build the message for one recipient, per the campaign's chosen template. */
export function renderForContact(
  campaign: Pick<CampaignRow, 'template' | 'subject' | 'headline' | 'intro' | 'ctaLabel' | 'ctaPath'>,
  contact: Pick<ContactRow, 'email' | 'name' | 'meta' | 'userId' | 'unsubscribeToken'>,
  origin: string,
): { subject: string; html: string; text: string } {
  if (campaign.template === 'invite') {
    const segment: InviteSegment =
      contact.meta.segment === 'driver' || contact.meta.segment === 'rider' ? contact.meta.segment : 'both';
    return renderInvite({
      appOrigin: origin,
      recipientName: contact.name,
      segment,
      unsubscribeToken: contact.unsubscribeToken,
      subject: campaign.subject,
      headline: campaign.headline,
      intro: campaign.intro,
    });
  }
  return renderAnnouncement({
    appOrigin: origin,
    recipientName: contact.name,
    unsubscribeToken: contact.unsubscribeToken,
    subject: campaign.subject,
    headline: campaign.headline,
    intro: campaign.intro,
    ctaLabel: campaign.ctaLabel,
    ctaPath: campaign.ctaPath,
    isUser: contact.userId != null,
  });
}

export async function runCampaignTick(): Promise<void> {
  const lockClient = await pool.connect();
  try {
    const lock = await lockClient.query<{ locked: boolean }>('SELECT pg_try_advisory_lock($1) AS locked', [
      CAMPAIGN_LOCK_KEY,
    ]);
    if (!lock.rows[0]?.locked) return;

    try {
      const [campaign] = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.status, 'sending'))
        .orderBy(asc(campaigns.startedAt))
        .limit(1);
      if (!campaign) return;

      const batchSize = Math.max(1, Math.min(campaign.throttlePerMinute, 500));
      const pending = await db
        .select({ email: campaignSends.email, attempts: campaignSends.attempts })
        .from(campaignSends)
        .where(and(eq(campaignSends.campaignId, campaign.id), eq(campaignSends.status, 'pending')))
        .orderBy(asc(campaignSends.email))
        .limit(batchSize);

      if (pending.length === 0) {
        await db
          .update(campaigns)
          .set({ status: 'done', finishedAt: new Date() })
          .where(eq(campaigns.id, campaign.id));
        console.log(`campaign ${campaign.id} (${campaign.name}) finished`);
        return;
      }

      const emails = pending.map((p) => p.email);
      const rows = await db.select().from(contacts).where(inArray(contacts.email, emails));
      const byEmail = new Map(rows.map((c) => [c.email.toLowerCase(), c]));

      const origin = appOrigin();
      let sent = 0;
      let skipped = 0;

      for (const row of pending) {
        const contact = byEmail.get(row.email.toLowerCase());

        const finish = async (patch: Partial<typeof campaignSends.$inferInsert>): Promise<void> => {
          await db
            .update(campaignSends)
            .set(patch)
            .where(and(eq(campaignSends.campaignId, campaign.id), eq(campaignSends.email, row.email)));
        };

        if (!contact) {
          await finish({ status: 'failed', error: 'contact_missing', attempts: row.attempts + 1 });
          skipped++;
          continue;
        }
        // Re-checked per row, not just at start: someone can unsubscribe from an
        // earlier batch of the same campaign while it's still running.
        if (contact.unsubscribedAt) {
          await finish({ status: 'unsubscribed', attempts: row.attempts + 1 });
          skipped++;
          continue;
        }
        if (contact.excludedAt) {
          await finish({ status: 'suppressed', error: 'excluded', attempts: row.attempts + 1 });
          skipped++;
          continue;
        }
        // "Come try the new site" makes no sense to someone already on it. Only
        // the invite template skips users — announcements are often FOR them.
        if (campaign.template === 'invite' && contact.userId != null) {
          await finish({ status: 'existing_user', attempts: row.attempts + 1 });
          skipped++;
          continue;
        }

        const { subject, html, text } = renderForContact(campaign, contact, origin);

        try {
          const result = await sendEmail({
            userId: contact.userId,
            to: contact.email,
            kind: campaign.template === 'invite' ? 'invite' : 'announcement',
            subject,
            html,
            text,
            headers: unsubscribeHeaders(`${origin}/u/${contact.unsubscribeToken}`),
          });
          if (result.sent) {
            await finish({
              status: 'sent',
              sesMessageId: result.messageId,
              sentAt: new Date(),
              attempts: row.attempts + 1,
              error: null,
            });
            sent++;
          } else {
            // sendEmail returns sent:false only for an already-suppressed address.
            await finish({ status: 'suppressed', error: 'on_suppression_list', attempts: row.attempts + 1 });
            skipped++;
          }
        } catch (err) {
          if (isThrottle(err)) {
            console.warn(`campaign ${campaign.id} throttled by SES; pausing tick after ${sent} sends`);
            break;
          }
          const attempts = row.attempts + 1;
          const message = err instanceof Error ? err.message.slice(0, 500) : 'send_failed';
          await finish({
            status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            error: message,
            attempts,
          });
          console.error(`campaign ${campaign.id} send to ${contact.email} failed (attempt ${attempts}):`, message);
        }

        await sleep(SEND_GAP_MS);
      }

      if (sent > 0 || skipped > 0) {
        console.log(`campaign ${campaign.id}: ${sent} sent, ${skipped} skipped this tick`);
      }
    } finally {
      await lockClient.query('SELECT pg_advisory_unlock($1)', [CAMPAIGN_LOCK_KEY]);
    }
  } catch (err) {
    console.error('campaign tick failed', err);
  } finally {
    lockClient.release();
  }
}

/**
 * Materialise the recipient list for a campaign and flip it to 'sending'.
 *
 * Dynamic lists are refreshed first so a send never goes out against a stale
 * audience. Rows are inserted with onConflictDoNothing, so resuming a paused
 * campaign (or re-running a finished one after the list grew) tops up the queue
 * without resetting anybody who already got mail.
 */
export async function startCampaign(campaignId: string): Promise<{ recipients: number; alreadySent: number }> {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!campaign) throw new Error('campaign_not_found');

  const [list] = await db.select().from(contactLists).where(eq(contactLists.id, campaign.listId)).limit(1);
  if (!list) throw new Error('list_not_found');
  if (list.kind === 'dynamic') await refreshDynamicList(list.id);

  const eligible = await sendableEmailsForList(campaign.listId);

  if (eligible.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < eligible.length; i += BATCH) {
      await db
        .insert(campaignSends)
        .values(eligible.slice(i, i + BATCH).map((email) => ({ campaignId, email })))
        .onConflictDoNothing();
    }
  }

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) FILTER (WHERE ${campaignSends.status} = 'sent')::int`,
    })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaignId));

  await db
    .update(campaigns)
    .set({ status: 'sending', startedAt: campaign.startedAt ?? new Date(), finishedAt: null })
    .where(eq(campaigns.id, campaignId));

  return { recipients: counts?.total ?? 0, alreadySent: counts?.sent ?? 0 };
}
