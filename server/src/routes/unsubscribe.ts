// Public unsubscribe endpoint for bulk mail: GET /u/:token shows a confirmation
// page, POST /u/:token performs it.
//
// The token is a single-purpose capability minted per contact. It grants no
// session and reveals nothing except the address it belongs to (which the holder
// of the email already knows). GET is deliberately side-effect-free so mail
// scanners and link prefetchers can't unsubscribe anybody; the RFC 8058 One-Click
// POST is honoured for real unsubscribe buttons in Gmail/Apple Mail.
//
// Two tiers, and the distinction matters:
//   contacts.unsubscribed_at  — stops every campaign. Always set.
//   email_suppressions        — stops ALL mail including digests. Only added for
//                               contacts with no v2 account, because a real user
//                               opting out of announcements must still hear that
//                               someone messaged them about their ride. Users get
//                               pointed at their profile for digest control.
//
// Rendered server-side rather than in the SPA: someone who wants out should not
// have to boot a React app to get out.

import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client.js';
import { contacts, emailSuppressions } from '../db/schema.js';
import { allow, clientIp } from '../lib/rateLimit.js';
import { BRAND, CARD_BORDER, esc, FONT_STACK, INK, INK_DIM, INK_FAINT, PAGE_BG } from '../email/layout.js';

export const unsubscribeRoutes = new Hono();

function page(bodyHtml: string, title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · RideFinder</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:${PAGE_BG}; font-family:${FONT_STACK}; color:${INK}; }
  .wrap { max-width:520px; margin:0 auto; padding:48px 16px; }
  .card { background:#fff; border:1px solid ${CARD_BORDER}; border-radius:12px; padding:24px; }
  h1 { font-size:20px; margin:0 0 12px; }
  p { font-size:15px; line-height:1.55; color:${INK_DIM}; margin:0 0 14px; }
  .mail { font-weight:bold; color:${INK}; overflow-wrap:anywhere; }
  button { font:inherit; font-size:15px; font-weight:bold; padding:12px 20px; min-height:44px;
           border:none; border-radius:10px; background:${BRAND}; color:#fff; cursor:pointer; }
  button:focus-visible { outline:3px solid ${BRAND}; outline-offset:2px; }
  .brand { font-size:20px; font-weight:bold; color:${BRAND}; margin-bottom:20px; }
  .foot { font-size:13px; color:${INK_FAINT}; margin-top:18px; line-height:1.6; }
  a { color:${BRAND}; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand">RideFinder</div>
    <div class="card">${bodyHtml}</div>
    <div class="foot">RideFinder · <a href="/">ridefinder.site</a> · part of the BMIR 94.5 FM family</div>
  </div>
</body>
</html>`;
}

const NOT_FOUND_HTML = `
  <h1>That link has expired</h1>
  <p>We couldn't match this unsubscribe link to an address. It may already have been used.</p>
  <p>If you're still getting mail you don't want, reply to any RideFinder email and it'll be handled by a human.</p>`;

unsubscribeRoutes.get('/u/:token', async (c) => {
  const rows = await db
    .select({ email: contacts.email, unsubscribedAt: contacts.unsubscribedAt, userId: contacts.userId })
    .from(contacts)
    .where(eq(contacts.unsubscribeToken, c.req.param('token')))
    .limit(1);
  const row = rows[0];
  if (!row) return c.html(page(NOT_FOUND_HTML, 'Link expired'), 404);

  if (row.unsubscribedAt) {
    return c.html(
      page(
        `
      <h1>You're unsubscribed</h1>
      <p><span class="mail">${esc(row.email)}</span> is already off the RideFinder announcement list. Nothing further to do.</p>
      <p>The ride board itself is still open to anyone: <a href="/">ridefinder.site</a>.</p>`,
        'Already unsubscribed',
      ),
    );
  }

  const userNote = row.userId
    ? `<p style="font-size:13px;">You have a RideFinder account on this address. This only stops announcements —
       you'll still get told when someone messages you about a ride. To change those too, use the email settings on
       <a href="/me">your profile</a>.</p>`
    : '';

  return c.html(
    page(
      `
      <h1>Unsubscribe from RideFinder?</h1>
      <p>We'll stop sending announcements to <span class="mail">${esc(row.email)}</span>.</p>
      <form method="post" action="/u/${esc(c.req.param('token'))}">
        <button type="submit">Yes, unsubscribe me</button>
      </form>
      ${userNote}
      <p style="margin-top:16px;font-size:13px;">Changed your mind? Just close this tab — nothing has happened yet.
      You can always use the board without email at <a href="/">ridefinder.site</a>.</p>`,
      'Unsubscribe',
    ),
  );
});

unsubscribeRoutes.post('/u/:token', async (c) => {
  if (!allow(`unsub:${clientIp(c)}`, 30, 3600_000)) {
    return c.html(page(NOT_FOUND_HTML, 'Try again later'), 429);
  }

  const token = c.req.param('token');
  const updated = await db
    .update(contacts)
    .set({ unsubscribedAt: sql`COALESCE(${contacts.unsubscribedAt}, now())`, updatedAt: new Date() })
    .where(eq(contacts.unsubscribeToken, token))
    .returning({ email: contacts.email, userId: contacts.userId });

  const row = updated[0];
  if (!row) return c.html(page(NOT_FOUND_HTML, 'Link expired'), 404);

  // Only hard-suppress people with no account. For users, contacts.unsubscribed_at
  // already blocks every campaign, and suppressing them outright would also kill
  // "someone messaged you about your ride" — which they did not ask to lose.
  if (!row.userId) {
    await db.insert(emailSuppressions).values({ email: row.email, reason: 'unsubscribe' }).onConflictDoNothing();
  }
  console.warn(`unsubscribe: ${row.email}${row.userId ? ' (account holder — announcements only)' : ''}`);

  const userNote = row.userId
    ? `<p>Because you have an account, you'll still get told when someone messages you about a ride. Turn those off
       too — or switch to a daily digest — in the email settings on <a href="/me">your profile</a>.</p>`
    : '';

  return c.html(
    page(
      `
      <h1>Done — you're off the list</h1>
      <p>We won't send announcements to <span class="mail">${esc(row.email)}</span> again.</p>
      ${userNote}
      <p>No hard feelings. The ride board stays open to anyone who wants it, no email required:
      <a href="/">ridefinder.site</a>. Have a good burn. 🔥</p>`,
      'Unsubscribed',
    ),
  );
});
