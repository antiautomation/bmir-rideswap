/* Quick checks for the paste/CSV contact parser. No database needed.
   Run: npx tsx server/scripts/check-contact-parse.ts */
import { parseContactText } from '../src/lib/contactParse.js';

interface Case {
  name: string;
  input: string;
  expectEmails: string[];
  expectNames?: (string | null)[];
  expectInvalid?: number;
  expectDuplicates?: number;
  expectHeader?: boolean;
}

const cases: Case[] = [
  {
    name: 'one per line',
    input: 'a@example.org\nb@example.org\n\nc@example.org',
    expectEmails: ['a@example.org', 'b@example.org', 'c@example.org'],
  },
  {
    name: 'comma separated on one line',
    input: 'a@x.org, b@x.org ,c@x.org',
    expectEmails: ['a@x.org'],
    // Only the first address on a line is taken — one contact per line by design.
  },
  {
    name: 'csv with header, name column',
    input: 'name,email\n"Dave, Wavy",wavy@x.org\nDusty Dan,dusty@x.org',
    expectEmails: ['wavy@x.org', 'dusty@x.org'],
    expectNames: ['Dave, Wavy', 'Dusty Dan'],
    expectHeader: true,
  },
  {
    name: 'csv header in other order with extra columns',
    input: 'Email Address,First Name,City\nz@x.org,Zed,Reno',
    expectEmails: ['z@x.org'],
    expectNames: ['Zed'],
    expectHeader: true,
  },
  {
    name: 'angle brackets',
    input: 'Dusty Dave <dusty@x.org>\n"Quoted Name" <q@x.org>',
    expectEmails: ['dusty@x.org', 'q@x.org'],
    expectNames: ['Dusty Dave', 'Quoted Name'],
  },
  {
    name: 'tabs and semicolons',
    input: 'Tab Person\tt@x.org\nSemi Person;s@x.org',
    expectEmails: ['t@x.org', 's@x.org'],
    expectNames: ['Tab Person', 'Semi Person'],
  },
  {
    name: 'noise: mailto, trailing punctuation, mixed case, spaces',
    input: '  MAILTO:Loud@X.ORG  \nnext@x.org,\n',
    expectEmails: ['loud@x.org', 'next@x.org'],
  },
  {
    name: 'duplicates collapse, case-insensitively',
    input: 'dup@x.org\nDUP@x.org\ndup@x.org',
    expectEmails: ['dup@x.org'],
    expectDuplicates: 2,
  },
  {
    name: 'garbage lines reported, not swallowed',
    input: 'real@x.org\nnot an email\n@nope\nfoo@\nalso real@x.org',
    expectEmails: ['real@x.org'],
    expectInvalid: 3,
    expectDuplicates: 1,
  },
  {
    name: 'comment lines skipped',
    input: '# these are camp leads\nlead@x.org',
    expectEmails: ['lead@x.org'],
  },
  {
    name: 'header-looking first row that actually contains an address is not a header',
    input: 'email@x.org\nsecond@x.org',
    expectEmails: ['email@x.org', 'second@x.org'],
    expectHeader: false,
  },
  {
    name: 'crlf line endings',
    input: 'win@x.org\r\nlose@x.org\r\n',
    expectEmails: ['win@x.org', 'lose@x.org'],
  },
];

let failures = 0;

for (const c of cases) {
  const r = parseContactText(c.input);
  const emails = r.entries.map((e) => e.email);
  const problems: string[] = [];

  if (JSON.stringify(emails) !== JSON.stringify(c.expectEmails)) {
    problems.push(`emails: got ${JSON.stringify(emails)} want ${JSON.stringify(c.expectEmails)}`);
  }
  if (c.expectNames) {
    const names = r.entries.map((e) => e.name);
    if (JSON.stringify(names) !== JSON.stringify(c.expectNames)) {
      problems.push(`names: got ${JSON.stringify(names)} want ${JSON.stringify(c.expectNames)}`);
    }
  }
  if (c.expectInvalid !== undefined && r.stats.invalid !== c.expectInvalid) {
    problems.push(`invalid: got ${r.stats.invalid} want ${c.expectInvalid}`);
  }
  if (c.expectDuplicates !== undefined && r.stats.duplicates !== c.expectDuplicates) {
    problems.push(`duplicates: got ${r.stats.duplicates} want ${c.expectDuplicates}`);
  }
  if (c.expectHeader !== undefined && r.stats.usedHeader !== c.expectHeader) {
    problems.push(`usedHeader: got ${r.stats.usedHeader} want ${c.expectHeader}`);
  }

  if (problems.length === 0) {
    console.log(`  ok   ${c.name}`);
  } else {
    failures++;
    console.log(`  FAIL ${c.name}`);
    for (const p of problems) console.log(`         ${p}`);
  }
}

console.log(failures === 0 ? `\nall ${cases.length} cases pass` : `\n${failures} of ${cases.length} cases FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
