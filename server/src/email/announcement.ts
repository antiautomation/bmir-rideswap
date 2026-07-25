// The general-purpose campaign template: an admin writes the whole body, this
// puts it inside the RideFinder chrome with one optional call-to-action button.
//
// Same hard rule as the invite: NO magic links, no session-granting tokens. Bulk
// mail gets forwarded, and a login link in a forwarded email hands over the
// recipient's account. The only token is the unsubscribe capability.

import { BRAND, button, esc, INK, INK_DIM, INK_FAINT, shell } from './layout.js';

export interface AnnouncementInput {
  /** e.g. https://ridefinder.site — no trailing slash. */
  appOrigin: string;
  recipientName: string | null;
  unsubscribeToken: string;
  subject: string;
  headline?: string | null;
  /** The body. Plain text with light markup — see renderBody(). */
  intro?: string | null;
  ctaLabel?: string | null;
  ctaPath?: string | null;
  /** True when the recipient has a v2 account, which changes the footer wording. */
  isUser?: boolean;
}

/**
 * Turns admin-authored plain text into email HTML.
 *
 * Deliberately tiny, and escaping happens FIRST so no admin typo can inject
 * markup: `## heading`, `- bullet`, `**bold**`, blank line = new paragraph.
 */
function renderBody(text: string): string {
  const blocks = text.split(/\n{2,}/);
  const out: string[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter((l) => l !== '');
    if (lines.length === 0) continue;

    const inline = (s: string): string => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      out.push(
        lines
          .map(
            (l) =>
              `<div style="font-size:14px;color:${INK_DIM};line-height:1.5;margin:0 0 8px;">&middot; ${inline(l.replace(/^[-*]\s+/, ''))}</div>`,
          )
          .join(''),
      );
      continue;
    }

    if (lines.length === 1 && /^##\s+/.test(lines[0]!)) {
      out.push(
        `<div style="font-size:16px;font-weight:bold;color:${INK};margin:18px 0 8px;">${inline(lines[0]!.replace(/^##\s+/, ''))}</div>`,
      );
      continue;
    }

    out.push(
      `<div style="font-size:14px;color:${INK_DIM};line-height:1.55;margin:0 0 14px;">${lines.map(inline).join('<br>')}</div>`,
    );
  }

  return out.join('');
}

/** Plain-text twin of renderBody: strip the markup, keep the shape. */
function bodyToText(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (/^##\s+/.test(t)) return t.replace(/^##\s+/, '').toUpperCase();
      if (/^[-*]\s+/.test(t)) return `  - ${t.replace(/^[-*]\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1')}`;
      return t.replace(/\*\*(.+?)\*\*/g, '$1');
    })
    .join('\n');
}

/** Absolute http(s) links pass through; anything else is treated as a site path. */
function resolveCta(appOrigin: string, ctaPath: string): string {
  if (/^https?:\/\//i.test(ctaPath)) return ctaPath;
  return `${appOrigin}${ctaPath.startsWith('/') ? '' : '/'}${ctaPath}`;
}

export const DEFAULT_ANNOUNCEMENT_HEADLINE = 'A quick update from RideFinder';

export const DEFAULT_ANNOUNCEMENT_INTRO = `Write your message here.

Blank lines start a new paragraph. A line beginning with **##** becomes a heading, lines beginning with **-** become a bullet list, and **double asterisks** make text bold.

Use {{name}} anywhere to drop in the recipient's name (it falls back to "burner" when we don't have one).`;

export function renderAnnouncement(input: AnnouncementInput): { subject: string; html: string; text: string } {
  const { appOrigin, recipientName, unsubscribeToken, subject } = input;
  const greetingName = recipientName?.trim() || 'burner';

  // Personalisation tokens are substituted before escaping happens in renderBody,
  // so a name containing markup characters is still escaped downstream.
  const fill = (s: string): string => s.replace(/\{\{\s*name\s*\}\}/gi, greetingName);

  const headline = fill((input.headline ?? '').trim() || DEFAULT_ANNOUNCEMENT_HEADLINE);
  const body = fill((input.intro ?? '').trim());
  const ctaLabel = (input.ctaLabel ?? '').trim();
  const ctaPath = (input.ctaPath ?? '').trim();
  const ctaHref = ctaLabel && ctaPath ? resolveCta(appOrigin, ctaPath) : null;

  const url = (path = ''): string => `${appOrigin}${path}`;
  const unsubUrl = `${appOrigin}/u/${unsubscribeToken}`;

  const bodyHtml = `
          <tr>
            <td style="padding:8px 24px 0;">
              <div style="font-size:15px;color:${INK};margin-bottom:10px;">Hi ${esc(greetingName)} &mdash;</div>
              <div style="font-size:19px;font-weight:bold;color:${INK};line-height:1.3;margin-bottom:14px;">${esc(headline)}</div>
              ${renderBody(body)}
              ${ctaHref ? button(ctaHref, ctaLabel) : ''}
            </td>
          </tr>`;

  const settingsLine = input.isUser
    ? `<div style="margin-top:10px;">Want fewer emails but still want match and message alerts? Change your email frequency on <a href="${esc(url('/me'))}" style="color:${BRAND};">your profile</a>.</div>`
    : '';

  const footerHtml = `
                <div>
                  <a href="${esc(url('/'))}" style="color:${BRAND};">The board</a>
                  &middot;
                  <a href="${esc(url('/help'))}" style="color:${BRAND};">How it works</a>
                  &middot;
                  <a href="${esc(url('/privacy'))}" style="color:${BRAND};">Privacy</a>
                </div>
                ${settingsLine}
                <div style="margin-top:10px;">
                  Don't want announcements like this?
                  <a href="${esc(unsubUrl)}" style="color:${BRAND};">Unsubscribe</a> &mdash; one tap, no account needed.
                </div>
                <div style="margin-top:10px;color:${INK_FAINT};">
                  RideFinder is a free volunteer project, part of the
                  <a href="https://bmir.org" style="color:${BRAND};">BMIR 94.5 FM</a> family. Not affiliated with
                  Burning Man Project. We never sell tickets or vehicle passes.
                </div>`;

  const html = shell({ title: subject, preheader: headline, bodyHtml, footerHtml });

  const text = [
    `Hi ${greetingName} —`,
    '',
    headline.toUpperCase(),
    '',
    bodyToText(body),
    '',
    ...(ctaHref ? [`${ctaLabel.replace(/\s*→\s*$/, '')}: ${ctaHref}`, ''] : []),
    `The board: ${url('/')}`,
    `How it works: ${url('/help')}`,
    `Privacy: ${url('/privacy')}`,
    '',
    ...(input.isUser
      ? [`Change your email frequency on your profile: ${url('/me')}`]
      : []),
    `Don't want announcements like this? Unsubscribe: ${unsubUrl}`,
    '',
    'RideFinder is a free volunteer project, part of the BMIR 94.5 FM family. Not affiliated with Burning Man Project. We never sell tickets or vehicle passes.',
    'RideFinder · matching@ridefinder.site',
  ].join('\n');

  return { subject, html, text };
}
