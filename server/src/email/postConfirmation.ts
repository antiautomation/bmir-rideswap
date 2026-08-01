// One-time "your post is live" email, sent when a listing is created. Carries
// the poster's magic sign-in link — their way back in from any device — plus
// the promise we make on the post form: this one email, then only the
// message/match updates they asked for, with one-click unsubscribe.

import { button, buttonGhost, card, esc, INK, INK_DIM, listingTypeLabel, shell } from './layout.js';

export interface PostConfirmationInput {
  appOrigin: string;
  recipientName: string | null;
  listingId: string;
  listingType: 'driver' | 'rider';
  /** Seats offered/needed; 0 makes this a cargo-only post. */
  passengerSpace: number;
  travelDate: string;
  /** Raw ml_… token. This email goes only to the verified poster. */
  magicToken: string;
  recoveryCode: string;
  /** How long the magic-link buttons stay valid (appConfig magicLinkDays). */
  magicLinkDays: number;
}

export function renderPostConfirmation(input: PostConfirmationInput): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    appOrigin,
    recipientName,
    listingId,
    listingType,
    passengerSpace,
    travelDate,
    magicToken,
    recoveryCode,
    magicLinkDays,
  } = input;
  const name = recipientName?.trim() || 'burner';
  const signIn = (next: string): string => `${appOrigin}/a/${magicToken}?next=${encodeURIComponent(next)}`;
  const subject = 'Your RideFinder post is live — save this email';

  const bodyHtml = `
          <tr>
            <td style="padding:8px 24px 0;">
              <div style="font-size:15px;color:${INK};margin-bottom:10px;">Hey ${esc(name)} &mdash;</div>
              <div style="font-size:19px;font-weight:bold;color:${INK};line-height:1.3;margin-bottom:12px;">Your ${esc(listingTypeLabel(listingType, passengerSpace))} post for ${esc(travelDate)} is live 🔥</div>
              <div style="font-size:14px;color:${INK_DIM};line-height:1.55;margin-bottom:12px;">
                People can message you on the board now &mdash; replies land in your RideFinder inbox and
                we&rsquo;ll email you about them on the schedule you picked.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 24px 0;">
              ${card(`
              <div style="font-size:15px;font-weight:bold;color:${INK};margin-bottom:6px;">Save this email &mdash; it&rsquo;s your key</div>
              <div style="font-size:14px;color:${INK_DIM};line-height:1.55;">
                The buttons below sign you straight in on any device. Your session code
                <code style="font-family:ui-monospace,Menlo,monospace;background:#f3ece3;padding:1px 5px;border-radius:4px;">${esc(recoveryCode)}</code>
                does the same thing typed by hand.
              </div>
              ${button(signIn(`/listing/${listingId}`), 'View your post →')}
              ${buttonGhost(signIn('/matches'), 'See your matches →')}`)}
              <div style="font-size:13px;color:${INK_DIM};line-height:1.5;margin:4px 0 16px;">
                The buttons above work for the next ${magicLinkDays} days; your session code works forever &mdash;
                that one line is your real key. Beyond confirmations like this one, we only email the
                message and match updates you asked for (instant, hourly, daily, or off &mdash; changeable
                anytime from the You page) plus the rare service announcement, all with one-click unsubscribe.
              </div>
            </td>
          </tr>`;

  const footerHtml = `
                <div>
                  Sent once because you posted on ridefinder.site. Message &amp; match updates follow
                  your own settings &mdash; change them or turn everything off from the
                  <a href="${esc(signIn('/me'))}" style="color:#e4622f;">You page</a>.
                </div>`;

  const text = `Hey ${name} —

Your ${listingTypeLabel(listingType, passengerSpace)} post for ${travelDate} is live on RideFinder. People can message you on the board now — we'll email you about replies on the schedule you picked.

SAVE THIS EMAIL — IT'S YOUR KEY
View your post (signs you in): ${signIn(`/listing/${listingId}`)}
See your matches: ${signIn('/matches')}
Or type your session code on any device: ${recoveryCode}

The links above work for the next ${magicLinkDays} days; your session code works forever — that one line is your real key. Beyond confirmations like this one, we only email the message and match updates you asked for (instant, hourly, daily, or off — changeable anytime from the You page) plus the rare service announcement, all with one-click unsubscribe.

— RideFinder · rides to & from Black Rock City`;

  return { subject, html: shell({ title: subject, preheader: 'Your post is live — this email signs you back in anytime.', bodyHtml, footerHtml }), text };
}
