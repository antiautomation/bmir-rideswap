// Launch-invite email for people who posted on the v1 (2025) ride board.
//
// HARD RULE: this email contains NO magic links and no tokens that grant a
// session. Invites get forwarded to camps and group chats, and a forwarded login
// link would hand the recipient's account to a stranger. Every link here is a
// plain public URL. The one token present is the unsubscribe capability, which
// can only suppress the address it was minted for.

import { BRAND, button, buttonGhost, card, esc, escBody, INK, INK_DIM, INK_FAINT, shell } from './layout.js';

export type InviteSegment = 'driver' | 'rider' | 'both';

export interface InviteInput {
  /** e.g. https://ridefinder.site — no trailing slash. */
  appOrigin: string;
  /** Display name from their v1 listing, if we have one. */
  recipientName: string | null;
  /** Which side of the board they posted on last year — drives the CTA copy. */
  segment: InviteSegment;
  /** Raw unsubscribe token for this contact. Suppression-only capability. */
  unsubscribeToken: string;
  /** Admin-editable subject line. */
  subject: string;
  /** Admin-editable headline; falls back to DEFAULT_HEADLINE. */
  headline?: string | null;
  /** Admin-editable opening paragraphs (plain text, blank-line separated). */
  intro?: string | null;
}

export const DEFAULT_SUBJECT = 'RideFinder got rebuilt — post your ride for Black Rock City';

export const DEFAULT_HEADLINE = 'RideFinder got rebuilt from scratch';

export const DEFAULT_INTRO = `You posted on the RideFinder board for last year's burn — thank you for being part of it.

This year the whole thing got rebuilt from scratch: same free community ride board, from the same BMIR 94.5 FM family, now with private messaging and matching that does the searching for you. If you're heading back to the dust, it's ready when you are.`;

interface Feature {
  heading: string;
  bullets: string[];
}

const FEATURES: Feature[] = [
  {
    heading: '🔒 Private by design',
    bullets: [
      '<strong>Your contact info stays private.</strong> No email addresses or phone numbers on the public board — people reach you through messages, and you share your details only if and when you choose.',
      '<strong>Private messaging built in.</strong> You talk to people inside RideFinder, and you decide message by message whether to hand over your number.',
      '<strong>Photos unlock, not broadcast.</strong> Your profile photo is only visible to someone you are actually in a conversation with.',
      '<strong>Report button on every post</strong>, with a real human reviewing what gets flagged.',
      '<strong>No trackers.</strong> No Google Analytics, no ad pixels, no third-party scripts. Where you are going is nobody else&rsquo;s business.',
      '<strong>Spam traps and rate limits</strong> so the board stays rides and not junk.',
    ],
  },
  {
    heading: '✨ Matching that actually finds people',
    bullets: [
      '<strong>Every post gets scored</strong> against the other side of the board — date, direction, city, seats, how much stuff you are hauling — and you get a ranked list instead of a wall of text.',
      '<strong>&ldquo;On the way&rdquo; matching.</strong> A driver leaving Tucson now sees a rider in Phoenix, because it is a zero-mile detour on the way to the gate.',
      '<strong>City typeahead</strong>, so &ldquo;SF&rdquo;, &ldquo;sf bay area&rdquo; and &ldquo;San Francisco, CA&rdquo; all land in the same place instead of three.',
      '<strong>Email on your schedule</strong> — instant, hourly, daily, or off completely. Your call, changeable any time.',
    ],
  },
  {
    heading: '📱 Built for a phone in the dust',
    bullets: [
      '<strong>Posting takes about a minute.</strong>',
      '<strong>Install it to your home screen</strong> and it opens with no signal at all — write your post in the middle of nowhere and it syncs itself when you get a bar back.',
      '<strong>A recovery code instead of a password.</strong> Save one line like <code style="font-family:ui-monospace,Menlo,monospace;">dusty-camel-8214</code> and get back in from any device.',
      '<strong>Dark by default</strong>, because you are going to be reading this at 2am.',
    ],
  },
];

function segmentCopy(segment: InviteSegment): { line: string; primary: string; primaryPath: string } {
  if (segment === 'driver') {
    return {
      line: 'You offered seats last year. If you are driving again, it takes a minute to put them back up.',
      primary: 'Post your free seats →',
      primaryPath: '/post?type=driver',
    };
  }
  if (segment === 'rider') {
    return {
      line: 'You were looking for a ride last year. Get your request up early — drivers fill seats in the order they find them.',
      primary: 'Post your ride request →',
      primaryPath: '/post?type=rider',
    };
  }
  return {
    line: 'You have been on both sides of this board. Whichever you are this year, it takes a minute to post.',
    primary: 'Post a ride →',
    primaryPath: '/post',
  };
}

export function renderInvite(input: InviteInput): { subject: string; html: string; text: string } {
  const { appOrigin, recipientName, segment, unsubscribeToken, subject } = input;
  const headline = (input.headline ?? '').trim() || DEFAULT_HEADLINE;
  const intro = (input.intro ?? '').trim() || DEFAULT_INTRO;

  const url = (path = ''): string => `${appOrigin}${path}`;
  const unsubUrl = `${appOrigin}/u/${unsubscribeToken}`;
  const seg = segmentCopy(segment);
  const greetingName = recipientName?.trim() || 'burner';

  // ---- HTML ----

  const introHtml = intro
    .split(/\n{2,}/)
    .map((p) => `<div style="font-size:14px;color:${INK_DIM};line-height:1.55;margin-bottom:12px;">${escBody(p.trim())}</div>`)
    .join('');

  const featureCardsHtml = FEATURES.map((f) =>
    card(`
              <div style="font-size:15px;font-weight:bold;color:${INK};margin-bottom:10px;">${f.heading}</div>
              ${f.bullets
                .map(
                  (b) =>
                    `<div style="font-size:14px;color:${INK_DIM};line-height:1.5;margin-bottom:8px;">&middot; ${b}</div>`,
                )
                .join('')}`),
  ).join('');

  const ctaHtml = card(`
              <div style="font-size:15px;font-weight:bold;color:${INK};margin-bottom:6px;">Your turn</div>
              <div style="font-size:14px;color:${INK_DIM};line-height:1.55;">${esc(seg.line)}</div>
              ${button(url(seg.primaryPath), seg.primary)}
              ${buttonGhost(url('/'), 'See who is already going →')}`);

  const shareHtml = card(`
              <div style="font-size:15px;font-weight:bold;color:${INK};margin-bottom:6px;">🔥 Pass it on</div>
              <div style="font-size:14px;color:${INK_DIM};line-height:1.55;">
                A ride board only works if it is full. Forward this to your camp, drop it in the group chat,
                put it on your regional page. Every person who finds a ride is one less car idling in Gate
                traffic &mdash; and one less person who has to bail on the burn because they could not get there.
              </div>
              <div style="font-size:14px;color:${INK_DIM};line-height:1.55;margin-top:10px;">
                Send them here: <a href="${esc(url('/'))}" style="color:${BRAND};font-weight:bold;">ridefinder.site</a>
              </div>`);

  const trustHtml = `
              <div style="background:#fff7ed;border-left:3px solid ${BRAND};padding:10px 12px;margin:0 0 16px;font-size:13px;color:#444;line-height:1.5;">
                Note the links above are plain public links, not login links. RideFinder will never email you a
                one-tap way into your account &mdash; so forwarding this message to a friend is completely safe.
              </div>`;

  const bodyHtml = `
          <tr>
            <td style="padding:8px 24px 0;">
              <div style="font-size:15px;color:${INK};margin-bottom:10px;">Hi ${esc(greetingName)} &mdash;</div>
              <div style="font-size:19px;font-weight:bold;color:${INK};line-height:1.3;margin-bottom:12px;">${esc(headline)}</div>
              ${introHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 24px 0;">
              ${featureCardsHtml}
              ${ctaHtml}
              ${shareHtml}
              ${trustHtml}
            </td>
          </tr>`;

  const footerHtml = `
                <div>
                  <a href="${esc(url('/help'))}" style="color:${BRAND};">How it works</a>
                  &middot;
                  <a href="${esc(url('/about'))}" style="color:${BRAND};">Why I built this</a>
                  &middot;
                  <a href="${esc(url('/privacy'))}" style="color:${BRAND};">Privacy</a>
                </div>
                <div style="margin-top:10px;">
                  You are getting this one message because you posted a ride on ridefinder.site for Burning Man 2025.
                  Your old post did <strong>not</strong> carry over &mdash; the new site starts clean, so nothing you
                  wrote back then is still sitting out there.
                </div>
                <div style="margin-top:10px;">
                  Rather not hear from RideFinder?
                  <a href="${esc(unsubUrl)}" style="color:${BRAND};">Unsubscribe</a> &mdash; one tap, no account needed.
                </div>
                <div style="margin-top:10px;color:${INK_FAINT};">
                  RideFinder is a free volunteer project, part of the
                  <a href="https://bmir.org" style="color:${BRAND};">BMIR 94.5 FM</a> family. Not affiliated with
                  Burning Man Project. We never sell tickets or vehicle passes.
                </div>`;

  const html = shell({
    title: subject,
    preheader: 'Private messaging, real matching, works offline — and nothing public anymore.',
    bodyHtml,
    footerHtml,
  });

  // ---- TEXT ----

  const stripTags = (s: string): string =>
    s
      .replace(/<[^>]+>/g, '')
      .replace(/&rsquo;/g, "'")
      .replace(/&ldquo;|&rdquo;/g, '"')
      .replace(/&mdash;/g, '—')
      .replace(/&middot;/g, '·')
      .replace(/&amp;/g, '&')
      .trim();

  const text = [
    `Hi ${greetingName} —`,
    '',
    headline.toUpperCase(),
    '',
    intro,
    '',
    ...FEATURES.flatMap((f) => [stripTags(f.heading), ...f.bullets.map((b) => `  - ${stripTags(b)}`), '']),
    'YOUR TURN',
    seg.line,
    `${seg.primary.replace(' →', '')}: ${url(seg.primaryPath)}`,
    `See who is already going: ${url('/')}`,
    '',
    'PASS IT ON',
    'A ride board only works if it is full. Forward this to your camp, drop it in the group chat, put it on your regional page.',
    `Send them here: ${url('/')}`,
    '',
    'The links above are plain public links, not login links. RideFinder will never email you a one-tap way into your account — so forwarding this message is completely safe.',
    '',
    `How it works: ${url('/help')}`,
    `Why I built this: ${url('/about')}`,
    `Privacy: ${url('/privacy')}`,
    '',
    'You are getting this one message because you posted a ride on ridefinder.site for Burning Man 2025. Your old post did NOT carry over — the new site starts clean.',
    `Unsubscribe: ${unsubUrl}`,
    '',
    'RideFinder is a free volunteer project, part of the BMIR 94.5 FM family. Not affiliated with Burning Man Project. We never sell tickets or vehicle passes.',
    'RideFinder · matching@ridefinder.site',
  ].join('\n');

  return { subject, html, text };
}
