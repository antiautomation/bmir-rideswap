/* TEMPORARY verification harness — deleted after use.
   Exercises startCampaign + runCampaignTick and the two-tier unsubscribe against
   synthetic @ridefinder.invalid contacts only. Never touches a real address. */
import { eq, inArray, sql } from 'drizzle-orm';
import { db, pool } from '../src/db/client.js';
import { campaigns, campaignSends, contacts, emailSuppressions, users } from '../src/db/schema.js';
import { renderAnnouncement } from '../src/email/announcement.js';
import { runCampaignTick, startCampaign } from '../src/jobs/campaigns.js';

const SYNTHETIC = /@ridefinder\.invalid$/;

async function report(campaignId: string): Promise<void> {
  const rows = await db
    .select({
      email: campaignSends.email,
      status: campaignSends.status,
      error: campaignSends.error,
      attempts: campaignSends.attempts,
      msg: campaignSends.sesMessageId,
    })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaignId))
    .orderBy(campaignSends.email);
  for (const r of rows) {
    console.log(
      `    ${r.email.padEnd(36)} ${r.status.padEnd(14)} attempts=${r.attempts} msg=${r.msg ?? '-'} ${r.error ?? ''}`,
    );
  }
}

async function main(): Promise<void> {
  const campaignId = process.argv[2];
  if (!campaignId) throw new Error('usage: .verify-outreach.ts <campaignId>');

  const all = await db.select().from(campaignSends).where(eq(campaignSends.campaignId, campaignId));
  void all;

  // Safety rail: refuse to run if the campaign's list contains any real address.
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) throw new Error('campaign not found');

  console.log('== 1. XSS / escaping check on admin-authored body ==');
  const nasty = renderAnnouncement({
    appOrigin: 'https://ridefinder.site',
    recipientName: '<img src=x onerror=alert(1)>',
    unsubscribeToken: 'tok',
    subject: 'x',
    headline: '<script>alert(1)</script>',
    intro: '**bold <b>raw</b>** and <script>bad()</script>\n\n## <em>heading</em>',
  });
  // Look for genuinely live markup. An escaped "onerror=" inside &lt;img&gt; text
  // is inert, so match opening tags and javascript: URLs, not bare substrings.
  const leaked = /<script|<img|<iframe|<b>|<em>|="javascript:/i.test(nasty.html);
  console.log(`    raw markup leaked into HTML: ${leaked ? 'YES — BUG' : 'no'}`);
  console.log(`    hostile name escaped:        ${nasty.html.includes('&lt;img src=x') ? 'yes' : 'NO — BUG'}`);
  console.log(`    bold markup still applied:   ${nasty.html.includes('<strong>') ? 'yes' : 'NO — BUG'}`);

  console.log('\n== 2. startCampaign materialises the list ==');
  const started = await startCampaign(campaignId);
  console.log(`    recipients=${started.recipients} alreadySent=${started.alreadySent}`);

  const queued = await db
    .select({ email: campaignSends.email })
    .from(campaignSends)
    .where(eq(campaignSends.campaignId, campaignId));
  const real = queued.filter((q) => !SYNTHETIC.test(q.email));
  if (real.length > 0) {
    console.log(`    ABORT — ${real.length} non-synthetic address(es) queued. Rolling back.`);
    await db.delete(campaignSends).where(eq(campaignSends.campaignId, campaignId));
    await db.update(campaigns).set({ status: 'draft', startedAt: null }).where(eq(campaigns.id, campaignId));
    return;
  }
  console.log(`    all ${queued.length} queued addresses are synthetic — safe to send`);

  console.log('\n== 3. tick 1 ==');
  await runCampaignTick();
  await report(campaignId);

  console.log('\n== 4. tick 2 (nothing pending → campaign done) ==');
  await runCampaignTick();
  const [after] = await db.select({ status: campaigns.status }).from(campaigns).where(eq(campaigns.id, campaignId));
  console.log(`    campaign status: ${after?.status}`);

  console.log('\n== 5. two-tier unsubscribe ==');
  // (a) a contact with no account → hard suppression too
  const noAccount = 'jane-verify@ridefinder.invalid';
  // (b) a contact linked to a real account → announcements only, NO suppression
  const withAccount = 'dusty-verify@ridefinder.invalid';
  const [someUser] = await db.select({ id: users.id }).from(users).limit(1);
  await db.update(contacts).set({ userId: someUser!.id }).where(eq(contacts.email, withAccount));

  for (const email of [noAccount, withAccount]) {
    const [row] = await db
      .select({ token: contacts.unsubscribeToken, userId: contacts.userId })
      .from(contacts)
      .where(eq(contacts.email, email));
    const res = await fetch(`http://localhost:3000/u/${row!.token}`, { method: 'POST' });
    const [c] = await db
      .select({ unsub: contacts.unsubscribedAt })
      .from(contacts)
      .where(eq(contacts.email, email));
    const [supp] = await db
      .select({ email: emailSuppressions.email })
      .from(emailSuppressions)
      .where(eq(emailSuppressions.email, email));
    console.log(
      `    ${email.padEnd(36)} http=${res.status} hasAccount=${row!.userId != null} unsubscribed=${c!.unsub != null} hardSuppressed=${supp != null}`,
    );
  }

  console.log('\n== 6. re-running a done campaign skips people already sent ==');
  const again = await startCampaign(campaignId);
  console.log(`    recipients=${again.recipients} alreadySent=${again.alreadySent}`);
  await runCampaignTick();
  await report(campaignId);
  await db.update(campaigns).set({ status: 'draft', startedAt: null, finishedAt: null }).where(eq(campaigns.id, campaignId));

  console.log('\n== 7. sendable count reflects unsubscribes ==');
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      sendable: sql<number>`count(*) FILTER (WHERE unsubscribed_at IS NULL AND excluded_at IS NULL)::int`,
    })
    .from(contacts)
    .where(inArray(contacts.email, queued.map((q) => q.email)));
  console.log(`    of the ${counts?.total} queued contacts, ${counts?.sendable} are still sendable`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
