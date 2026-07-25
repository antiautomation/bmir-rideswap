// Parses a pasted blob of addresses into contacts.
//
// Accepts whatever someone actually pastes: one address per line, comma or
// semicolon or tab separated, a CSV export with a header row, Outlook-style
// "Name <a@b.com>", or a messy mix of all of those. Junk lines are reported back
// with their line numbers rather than silently dropped, because a bulk import
// that quietly loses 40 addresses is worse than one that complains.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Same junk/typo/role filters the v1 importer uses, so both paths agree. */
const JUNK_DOMAINS = new Set([
  'asdf.com',
  'test.com',
  'testing.com',
  'example.com',
  'example.org',
  'example.net',
  'foo.com',
  'bar.com',
  'aaa.com',
  'qwerty.com',
  'mailinator.com',
  'yopmail.com',
  'guerrillamail.com',
  'sharklasers.com',
  'trashmail.com',
  '10minutemail.com',
]);

const TYPO_DOMAINS = new Set([
  'gmail.con',
  'gmail.co',
  'gmail.cm',
  'gmial.com',
  'gmai.com',
  'gnail.com',
  'hotmail.con',
  'yahoo.con',
  'yaho.com',
  'iclould.com',
  'icloud.con',
  'outlook.con',
]);

const ROLE_LOCALPARTS = new Set([
  'no-reply',
  'noreply',
  'donotreply',
  'postmaster',
  'abuse',
  'mailer-daemon',
  'bounce',
  'bounces',
  'root',
  'webmaster',
]);

const JUNK_LOCALPART_RE = /^(test|asdf|aaaa?|qwe|fake|dummy|nobody)\d*$/i;

export function excludeReasonFor(email: string): string | null {
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (JUNK_DOMAINS.has(domain)) return `junk_domain:${domain}`;
  if (TYPO_DOMAINS.has(domain)) return `likely_typo:${domain}`;
  if (ROLE_LOCALPARTS.has(local)) return `role_address:${local}`;
  if (JUNK_LOCALPART_RE.test(local)) return `junk_localpart:${local}`;
  return null;
}

export function normalizeEmail(raw: string): string | null {
  let e = raw.trim().toLowerCase();
  if (e === '') return null;
  e = e.replace(/^mailto:/, '');
  const angled = /<([^>]+)>/.exec(e);
  if (angled?.[1]) e = angled[1].trim();
  // Strip wrapping quotes and trailing punctuation left by copy-paste.
  e = e.replace(/^["']|["']$/g, '').replace(/[.,;:]+$/, '');
  return e === '' ? null : e;
}

/** Splits one CSV/TSV line, honouring double-quoted fields with "" escapes. */
function splitFields(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',' || ch === ';' || ch === '\t' || ch === '|') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

const HEADER_EMAIL_KEYS = ['email', 'e-mail', 'email address', 'emailaddress', 'mail'];
const HEADER_NAME_KEYS = ['name', 'full name', 'fullname', 'first name', 'firstname', 'display name'];

export interface ParsedContact {
  email: string;
  name: string | null;
}

export interface ParseResult {
  /** Valid, deduped, in first-seen order. */
  entries: ParsedContact[];
  /** Lines we couldn't find an address in, capped for display. */
  invalid: { line: number; text: string }[];
  stats: {
    lines: number;
    /** Lines that yielded a syntactically valid address. */
    valid: number;
    /** Valid addresses that were repeats within this paste. */
    duplicates: number;
    /** Lines with content but no usable address. */
    invalid: number;
    /** True when the first row was consumed as a CSV header. */
    usedHeader: boolean;
  };
}

const MAX_INVALID_REPORTED = 25;
export const MAX_PASTE_ENTRIES = 10_000;

export function parseContactText(text: string): ParseResult {
  const rawLines = text.split(/\r\n|\r|\n/);
  const entries: ParsedContact[] = [];
  const seen = new Set<string>();
  const invalid: { line: number; text: string }[] = [];
  let valid = 0;
  let duplicates = 0;
  let invalidCount = 0;
  let usedHeader = false;

  // Header detection: only meaningful if the first non-empty line has no address
  // in it at all (a header row can't contain one) but does name an email column.
  let emailCol: number | null = null;
  let nameCol: number | null = null;
  let startIndex = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]!.trim();
    if (line === '') continue;
    const fields = splitFields(line);
    const lower = fields.map((f) => f.toLowerCase());
    const hasAddress = fields.some((f) => {
      const n = normalizeEmail(f);
      return n !== null && EMAIL_RE.test(n);
    });
    if (!hasAddress) {
      const ec = lower.findIndex((f) => HEADER_EMAIL_KEYS.includes(f));
      if (ec >= 0) {
        emailCol = ec;
        const nc = lower.findIndex((f) => HEADER_NAME_KEYS.includes(f));
        nameCol = nc >= 0 ? nc : null;
        usedHeader = true;
        startIndex = i + 1;
      }
    }
    break;
  }

  for (let i = startIndex; i < rawLines.length; i++) {
    const raw = rawLines[i]!;
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (entries.length >= MAX_PASTE_ENTRIES) break;

    const fields = splitFields(line);

    // Angle-bracket form takes priority: "Dusty Dave <dusty@example.com>".
    let email: string | null = null;
    let name: string | null = null;

    const angled = /^(.*?)<([^>]+)>\s*$/.exec(line);
    if (angled) {
      const candidate = normalizeEmail(angled[2]!);
      if (candidate && EMAIL_RE.test(candidate)) {
        email = candidate;
        name = angled[1]!.trim().replace(/^["']|["']$/g, '') || null;
      }
    }

    if (!email && emailCol !== null && fields[emailCol] !== undefined) {
      const candidate = normalizeEmail(fields[emailCol]);
      if (candidate && EMAIL_RE.test(candidate)) {
        email = candidate;
        if (nameCol !== null) name = fields[nameCol]?.trim() || null;
      }
    }

    if (!email) {
      // Any field that looks like an address wins; the first non-address field
      // makes a reasonable name.
      const pick = (candidates: string[]): void => {
        for (const f of candidates) {
          const candidate = normalizeEmail(f);
          if (candidate && EMAIL_RE.test(candidate)) {
            email = candidate;
            break;
          }
        }
        if (!email || name !== null) return;
        const parts: string[] = [];
        for (const f of candidates) {
          const candidate = normalizeEmail(f);
          const isAddress = candidate !== null && EMAIL_RE.test(candidate);
          if (!isAddress && f.trim() !== '') parts.push(f.trim());
        }
        name = parts.length > 0 ? parts.join(' ') : null;
      };

      pick(fields);
      // Fall back to whitespace, which catches spreadsheet copy-paste like
      // "Dusty Dave dusty@example.com" with no delimiter at all.
      if (!email) pick(line.split(/\s+/));
    }

    if (!email) {
      invalidCount++;
      if (invalid.length < MAX_INVALID_REPORTED) invalid.push({ line: i + 1, text: line.slice(0, 120) });
      continue;
    }

    valid++;
    if (seen.has(email)) {
      duplicates++;
      continue;
    }
    seen.add(email);
    entries.push({ email, name: name ? name.slice(0, 100) : null });
  }

  return {
    entries,
    invalid,
    stats: { lines: rawLines.length, valid, duplicates, invalid: invalidCount, usedHeader },
  };
}
