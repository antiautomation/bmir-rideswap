// Digest-email renderer for RideFinder.
//
// Page chrome and primitives live in ./layout.ts. Every user-provided string is
// HTML-escaped. All in-app links go through a magic-link token so the reader
// lands logged-in on the right page — unlike the invite email, which carries no
// tokens at all because invites get forwarded to friends.

import {
  BRAND,
  button,
  card,
  directionLabel,
  esc,
  escBody,
  formatTimestamp,
  listingTypeLabel,
  shell,
} from './layout.js';

export interface DigestConversation {
  conversationId: string;
  counterpartName: string;
  /** Prebuilt, e.g. 'your 🚗 ride offer · Sun, Aug 30' or "Alice's 🎒 ride request · Sat, Aug 29". */
  context: string;
  messages: {
    senderName: string;
    /** '' when the message is nothing but a photo. */
    body: string;
    hasPhoto: boolean;
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
  /** Seats offered/needed; 0 makes this a cargo-only post. */
  theirPassengerSpace: number;
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
  /** Unnotified matches beyond the ones rendered — shown as a "+N more" line. */
  extraMatchCount: number;
  /** Identified by direction, not name — every listing carries the poster's own name. */
  activeListings: { id: string; direction: 'to_brc' | 'from_brc' }[];
}

export function renderDigest(input: DigestInput): { subject: string; html: string; text: string } {
  const {
    appOrigin,
    magicToken,
    recipientName,
    conversations,
    totalNewMessages,
    newMatches,
    extraMatchCount,
    activeListings,
  } = input;

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
          ${esc(conv.counterpartName)} &middot; about ${esc(conv.context)}
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
            <div style="font-size:14px;color:#333;line-height:1.4;">${m.body ? escBody(m.body) : ''}${
              m.hasPhoto
                ? `${m.body ? '<br>' : ''}<span style="color:#666;">📷 Photo &mdash; open the thread to see it</span>`
                : ''
            }</div>
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
              <div style="font-size:14px;font-weight:bold;color:#2a2a2a;">${esc(m.theirName)} &middot; ${listingTypeLabel(m.theirType, m.theirPassengerSpace)}</div>
              <div style="font-size:13px;color:#555;margin-top:2px;">${esc(matchDate(m.travelDate))} &middot; ${esc(m.location)} &middot; matches your &quot;${esc(m.myListingName)}&quot; listing</div>
              <div style="font-size:12px;color:#999;margin-top:2px;">Match strength ${m.score}/100</div>
              ${button(link(`/listing/${m.listingId}`), 'View & message →')}
            `),
          )
          .join('')}${
          extraMatchCount > 0
            ? `<div style="font-size:13px;color:#555;margin:2px 0 14px;">…and ${extraMatchCount} more — <a href="${esc(link('/matches'))}" style="color:${BRAND};">see all your matches</a>.</div>`
            : ''
        }`;

  const deactivateListingsHtml = activeListings
    .map(
      (l) =>
        `<div>Deactivate listing ${esc(directionLabel(l.direction))} &mdash; <a href="${esc(link(`/listing/${l.id}`))}" style="color:${BRAND};">Manage listing</a> (opens the listing — tap Deactivate there)</div>`,
    )
    .join('');

  const html = shell({
    title: subject,
    bodyHtml: `
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
          </tr>`,
    footerHtml: `
                <div>
                  <a href="${esc(link('/messages'))}" style="color:${BRAND};">See all messages</a>
                  &middot;
                  <a href="${esc(link('/me'))}" style="color:${BRAND};">View my profile</a>
                </div>
                ${deactivateListingsHtml}
                <div style="margin-top:10px;">You're getting this because you posted on RideFinder. Change email frequency or unsubscribe from your profile: <a href="${esc(link('/me'))}" style="color:${BRAND};">Email settings</a>.</div>`,
  });

  // ---- TEXT ----

  const conversationsText = conversations
    .map((conv) => {
      const lines: string[] = [];
      lines.push(`── ${conv.counterpartName} · about ${conv.context}`);
      for (const m of conv.messages) {
        // No image is embedded — there's no attachment/CID path in the SES
        // sender, so a photo-only message points at the thread instead.
        const photoNote = m.hasPhoto ? `${m.body ? ' ' : ''}[📷 Photo — open the thread to see it]` : '';
        lines.push(`${m.senderName}: ${m.body}${photoNote}`);
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

  const deactivateListingsText = activeListings
    .map(
      (l) =>
        `Deactivate listing ${directionLabel(l.direction)}: ${link(`/listing/${l.id}`)} (opens the listing — tap Deactivate there)`,
    )
    .join('\n');

  const matchesText =
    newMatches.length === 0
      ? ''
      : ['✨ New potential matches:']
          .concat(
            newMatches.map(
              (m) =>
                `── ${m.theirName} · ${listingTypeLabel(m.theirType, m.theirPassengerSpace)} · ${matchDate(m.travelDate)} · ${m.location} (matches "${m.myListingName}", strength ${m.score}/100)\n   View & message: ${link(`/listing/${m.listingId}`)}`,
            ),
          )
          .concat(extraMatchCount > 0 ? [`…and ${extraMatchCount} more: ${link('/matches')}`] : [])
          .join('\n');

  // Sections that exist keep a blank line after them; absent sections vanish
  // entirely — no global ''-filter, which would eat the deliberate spacers.
  const text = [
    `Hi ${greetingName} —`,
    summaryLine,
    '',
    ...(conversationsText ? [conversationsText] : []),
    ...(matchesText ? [matchesText, ''] : []),
    `See all messages: ${link('/messages')}`,
    `View my profile: ${link('/me')}`,
    ...(deactivateListingsText ? [deactivateListingsText] : []),
    '',
    "You're getting this because you posted on RideFinder. Change email frequency or unsubscribe from your profile:",
    `Email settings: ${link('/me')}`,
    '',
    'RideFinder · matching@ridefinder.site',
  ].join('\n');

  return { subject, html, text };
}
