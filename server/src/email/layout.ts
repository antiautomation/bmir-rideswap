// Shared primitives for every RideFinder email.
//
// Old-school email HTML: a single 600px-max centered table, inline styles only,
// light background with #e4622f accents. Note the ember here is DELIBERATELY the
// email-safe #e4622f, not the app's dark-mode --ember (#ff6b35) — the app is
// dark-first, mail clients are not.
//
// Every user-provided string must go through esc()/escBody() before it lands in
// HTML. Extracted from templates.ts so the invite and the digest can't drift.

export const BRAND = '#e4622f';
export const PAGE_BG = '#faf6f0';
export const CARD_BORDER = '#eee0d5';
export const INK = '#2a2a2a';
export const INK_DIM = '#555';
export const INK_FAINT = '#999';
export const FONT_STACK = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escBody(s: string): string {
  return esc(s).replace(/\n/g, '<br>');
}

export function formatTimestamp(d: Date): string {
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

export function button(href: string, label: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0 4px;">
      <tr>
        <td align="center" bgcolor="${BRAND}" style="border-radius:10px;">
          <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:10px 18px;font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(label)}</a>
        </td>
      </tr>
    </table>`;
}

/** Outlined secondary button — for the second CTA in a card, so the ember stays singular. */
export function buttonGhost(href: string, label: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0 4px;">
      <tr>
        <td align="center" style="border-radius:10px;border:1px solid ${BRAND};">
          <a href="${esc(href)}" target="_blank" style="display:inline-block;padding:9px 17px;font-family:${FONT_STACK};font-size:14px;font-weight:bold;color:${BRAND};text-decoration:none;border-radius:10px;">${esc(label)}</a>
        </td>
      </tr>
    </table>`;
}

export function card(innerHtml: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid ${CARD_BORDER};border-radius:10px;margin:0 0 16px;">
      <tr>
        <td style="padding:16px;">
          ${innerHtml}
        </td>
      </tr>
    </table>`;
}

export function listingTypeLabel(listingType: 'driver' | 'rider'): string {
  return listingType === 'driver' ? '🚗 ride offer' : '🎒 ride request';
}

export interface ShellInput {
  /** Used as <title>; not shown in the body. */
  title: string;
  /** Hidden preview text mail clients show next to the subject. */
  preheader?: string;
  /** Everything between the header and the footer rule. */
  bodyHtml: string;
  /** Small print under the rule. Already-escaped HTML. */
  footerHtml: string;
}

/** The one page chrome: header wordmark, body slot, footer rule. */
export function shell(input: ShellInput): string {
  const { title, preheader, bodyHtml, footerHtml } = input;
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:${PAGE_BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(preheader)}</div>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body { margin:0; padding:0; background:${PAGE_BG}; }
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT_STACK};">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${PAGE_BG};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 24px 8px;">
              <div style="font-size:22px;font-weight:bold;color:${BRAND};">RideFinder</div>
              <div style="font-size:13px;color:${INK_FAINT};margin-top:2px;">rides to &amp; from Black Rock City</div>
            </td>
          </tr>
          ${bodyHtml}
          <tr>
            <td style="padding:8px 24px 24px;">
              <hr style="border:none;border-top:1px solid ${CARD_BORDER};margin:8px 0 16px;">
              <div style="font-size:12px;color:${INK_FAINT};line-height:1.6;">
                ${footerHtml}
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
}
