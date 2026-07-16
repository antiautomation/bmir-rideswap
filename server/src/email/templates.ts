// Digest-email renderer for RideFinder.
//
// Old-school email HTML: a single 600px-max centered table, inline styles
// only, light background with #e4622f accents. Every user-provided string
// is HTML-escaped. All in-app links go through a magic-link token so the
// reader lands logged-in on the right page.

export interface DigestConversation {
  conversationId: string;
  counterpartName: string;
  listingName: string;
  listingType: 'driver' | 'rider';
  messages: {
    senderName: string;
    body: string;
    sharedEmail: string | null;
    sharedPhone: string | null;
    createdAt: Date;
  }[];
}

export interface DigestMatch {
  listingId: string;
  myListingName: string;
  theirName: string;
  theirType: 'driver' | 'rider';
  travelDate: string; // YYYY-MM-DD
  location: string;
  score: number;
}

export interface DigestInput {
  appOrigin: string; // e.g. https://ridefinder.site — no trailing slash
  magicToken: string; // raw ml_… token; ALL links in this email use it
  recipientName: string | null;
  conversations: DigestConversation[];
  totalNewMessages: number;
  newMatches: DigestMatch[];
  activeListings: { id: string; name: string }[];
}

const BRAND = '#e4622f';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escBody(s: string): string {
  return esc(s).replace(/\n/g, '<br>');
}

function formatTimestamp(d: Date): string {
  return (
    d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Los_Angeles',
    }) + ' PT'
  );
}

function button(href: string, label: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0 4px;">
      <tr>
        <td align="center" bgcolor="${BRAND}" style="border-radius:10px;">
          <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:10px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)}</a>
        </td>
      </tr>
    </table>`;
}

function card(innerHtml: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #eee0d5;border-radius:10px;margin:0 0 16px;">
      <tr>
        <td style="padding:16px;">
          ${innerHtml}
        </td>
      </tr>
    </table>`;
}

function listingTypeLabel(listingType: 'driver' | 'rider'): string {
  return listingType === 'driver' ? '🚗 ride offer' : '🎒 ride request';
}

export function renderDigest(input: DigestInput): { subject: string; html: string; text: string } {
  const { appOrigin, magicToken, recipientName, conversations, totalNewMessages, newMatches, activeListings } =
    input;

  const link = (path: string): string => `${appOrigin}/a/${magicToken}?next=${encodeURIComponent(path)}`;

  const plural = totalNewMessages === 1 ? '' : 's';
  const matchPlural = newMatches.length === 1 ? '' : 'es';
  let subject: string;
  if (totalNewMessages === 0) {
    subject = `${newMatches.length} new ride match${matchPlural} on RideFinder`;
  } else {
    subject = `${totalNewMessages} new message${plural} on RideFinder`;
    if (conversations.length === 1) {
      subject += ` from ${conversations[0].counterpartName}`;
    }
    if (newMatches.length > 0) {
      subject += ` · ${newMatches.length} new match${matchPlural}`;
    }
  }

  const greetingName = recipientName ?? 'burner';
  const messageWord = totalNewMessages === 1 ? 'message' : 'messages';
  const summaryLine =
    totalNewMessages > 0 && newMatches.length > 0
      ? `You have ${totalNewMessages} new ${messageWord} and ${newMatches.length} new potential match${matchPlural} waiting.`
      : totalNewMessages > 0
        ? `You have ${totalNewMessages} new ${messageWord} waiting.`
        : `You have ${newMatches.length} new potential ride match${matchPlural}.`;

  // ---- HTML ----

  const conversationCardsHtml = conversations
    .map((conv) => {
      const headerHtml = `
        <div style="font-size:15px;font-weight:bold;color:#2a2a2a;margin-bottom:10px;">
          ${esc(conv.counterpartName)} &middot; about &quot;${esc(conv.listingName)}&quot; (${listingTypeLabel(conv.listingType)})
        </div>`;

      const messagesHtml = conv.messages
        .map((m) => {
          const contactHtml =
            m.sharedEmail || m.sharedPhone
              ? `
              <div style="background:#fff7ed;border-left:3px solid ${BRAND};padding:8px 10px;margin:6px 0 10px;font-size:13px;color:#444;">
                📇 ${esc(m.senderName)} shared contact info:
                ${
                  m.sharedEmail
                    ? `<br><a href="mailto:${esc(m.sharedEmail)}" style="color:${BRAND};">${esc(m.sharedEmail)}</a>`
                    : ''
                }
                ${
                  m.sharedPhone
                    ? `<br><a href="sms:${esc(m.sharedPhone)}" style="color:${BRAND};">Text</a> &middot; <a href="tel:${esc(m.sharedPhone)}" style="color:${BRAND};">Call</a> &middot; ${esc(m.sharedPhone)}`
                    : ''
                }
              </div>`
              : '';

          return `
          <div style="margin-bottom:10px;">
            <div style="font-weight:bold;font-size:14px;color:#2a2a2a;">${esc(m.senderName)}</div>
            <div style="font-size:14px;color:#333;line-height:1.4;">${escBody(m.body)}</div>
            <div style="font-size:12px;color:#999;margin-top:2px;">${esc(formatTimestamp(m.createdAt))}</div>
            ${contactHtml}
          </div>`;
        })
        .join('');

      const replyButtonHtml = button(link(`/messages/${conv.conversationId}`), 'Reply in RideFinder →');

      return card(headerHtml + messagesHtml + replyButtonHtml);
    })
    .join('');

  const matchDate = (d: string): string => {
    const [y, mo, day] = d.split('-').map(Number);
    return new Date(y!, mo! - 1, day!).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const matchesSectionHtml =
    newMatches.length === 0
      ? ''
      : `
        <div style="font-size:15px;font-weight:bold;color:#2a2a2a;margin:4px 0 10px;">✨ New potential matches</div>
        ${newMatches
          .map((m) =>
            card(`
              <div style="font-size:14px;font-weight:bold;color:#2a2a2a;">${esc(m.theirName)} &middot; ${listingTypeLabel(m.theirType)}</div>
              <div style="font-size:13px;color:#555;margin-top:2px;">${esc(matchDate(m.travelDate))} &middot; ${esc(m.location)} &middot; matches your &quot;${esc(m.myListingName)}&quot; listing</div>
              <div style="font-size:12px;color:#999;margin-top:2px;">Match strength ${m.score}/100</div>
              ${button(link(`/listing/${m.listingId}`), 'View & message →')}
            `),
          )
          .join('')}`;

  const cancelListingsHtml = activeListings
    .map(
      (l) =>
        `<div>Cancel listing &quot;${esc(l.name)}&quot; &mdash; <a href="${esc(link(`/listing/${l.id}`))}" style="color:${BRAND};">Manage listing</a> (opens the listing — tap Cancel there)</div>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body { margin:0; padding:0; background:#faf6f0; }
</style>
</head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#faf6f0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 24px 8px;">
              <div style="font-size:22px;font-weight:bold;color:${BRAND};">RideFinder</div>
              <div style="font-size:13px;color:#999;margin-top:2px;">rides to &amp; from Black Rock City</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 0;">
              <div style="font-size:15px;color:#2a2a2a;margin-bottom:4px;">Hi ${esc(greetingName)} &mdash;</div>
              <div style="font-size:14px;color:#555;margin-bottom:18px;">${esc(summaryLine)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px;">
              ${conversationCardsHtml}
              ${matchesSectionHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 24px;">
              <hr style="border:none;border-top:1px solid #eee0d5;margin:8px 0 16px;">
              <div style="font-size:12px;color:#999;line-height:1.6;">
                <div>
                  <a href="${esc(link('/messages'))}" style="color:${BRAND};">See all messages</a>
                  &middot;
                  <a href="${esc(link('/me'))}" style="color:${BRAND};">View my profile</a>
                </div>
                ${cancelListingsHtml}
                <div style="margin-top:10px;">You're getting this because you posted on RideFinder. Change email frequency or unsubscribe from your profile: <a href="${esc(link('/me'))}" style="color:${BRAND};">Email settings</a>.</div>
                <div style="margin-top:10px;">RideFinder &middot; matching@ridefinder.site</div>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ---- TEXT ----

  const conversationsText = conversations
    .map((conv) => {
      const lines: string[] = [];
      lines.push(`── ${conv.counterpartName} · about "${conv.listingName}" (${listingTypeLabel(conv.listingType)})`);
      for (const m of conv.messages) {
        lines.push(`${m.senderName}: ${m.body}`);
        lines.push(`  (${formatTimestamp(m.createdAt)})`);
        if (m.sharedEmail || m.sharedPhone) {
          const parts: string[] = [];
          if (m.sharedEmail) parts.push(m.sharedEmail);
          if (m.sharedPhone) parts.push(m.sharedPhone);
          lines.push(`  Contact shared: ${parts.join(' / ')}`);
        }
      }
      lines.push(`Reply: ${link(`/messages/${conv.conversationId}`)}`);
      lines.push('');
      return lines.join('\n');
    })
    .join('\n');

  const cancelListingsText = activeListings
    .map((l) => `Cancel listing "${l.name}": ${link(`/listing/${l.id}`)} (opens the listing — tap Cancel there)`)
    .join('\n');

  const matchesText =
    newMatches.length === 0
      ? ''
      : ['✨ New potential matches:']
          .concat(
            newMatches.map(
              (m) =>
                `── ${m.theirName} · ${listingTypeLabel(m.theirType)} · ${matchDate(m.travelDate)} · ${m.location} (matches "${m.myListingName}", strength ${m.score}/100)\n   View & message: ${link(`/listing/${m.listingId}`)}`,
            ),
          )
          .join('\n') + '\n';

  const text = [
    `Hi ${greetingName} —`,
    summaryLine,
    '',
    conversationsText,
    matchesText,
    `See all messages: ${link('/messages')}`,
    `View my profile: ${link('/me')}`,
    cancelListingsText,
    '',
    "You're getting this because you posted on RideFinder. Change email frequency or unsubscribe from your profile:",
    `Email settings: ${link('/me')}`,
    '',
    'RideFinder · matching@ridefinder.site',
  ]
    .filter((line) => line !== '')
    .join('\n');

  return { subject, html, text };
}
