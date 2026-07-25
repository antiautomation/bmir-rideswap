// One-time import of the v1 contact list out of the old Firestore project into
// `contacts` + a static contact list.
//
// The v1 board has no users collection — email addresses live denormalised on
// each listing document in two collections, `drivers` and `riders`, under
// artifacts/{appId}/public/data/. The collection name is the authoritative
// rider/driver signal (the `type`/`userType` fields exist on only some docs and
// were verified to never disagree with the collection).
//
// v1's firestore.rules were `allow read: if true`, so this needs no credentials.
// Those rules have since been locked down and the project is slated for deletion,
// so this path is expected to stop working — pass `file` with a JSON dump if the
// import ever has to be re-run.

import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { contactLists } from '../db/schema.js';
import type { ContactMeta } from '../db/schema.js';
import { addToList, upsertContacts } from './contacts.js';
import { excludeReasonFor } from './contactParse.js';

const DEFAULT_PROJECT = process.env.V1_FIRESTORE_PROJECT ?? 'bmir-rideshare';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const V1_LIST_NAME = '2025 board (v1 import)';

export interface V1Listing {
  collection: 'drivers' | 'riders';
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  location: string | null;
  /** YYYY-MM-DD travel date as typed in v1. */
  date: string | null;
  direction: string | null;
  deleted: boolean;
  timestamp: string | null;
}

export interface ContactRecord {
  email: string;
  name: string | null;
  meta: ContactMeta;
  excludeReason: string | null;
}

export interface ImportResult {
  docsScanned: number;
  driverDocs: number;
  riderDocs: number;
  softDeletedDocs: number;
  docsWithoutEmail: number;
  docsWithMalformedEmail: number;
  uniqueContacts: number;
  segments: { driver: number; rider: number; both: number };
  excluded: { total: number; byReason: Record<string, number> };
  inserted: number;
  updated: number;
  addedToList: number;
  listName: string;
  dryRun: boolean;
}

/* ---------- Firestore REST ---------- */

type FsValue = Record<string, unknown>;

function decode(field: FsValue | undefined): unknown {
  if (!field) return undefined;
  if ('stringValue' in field) return field.stringValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue;
  if ('timestampValue' in field) return field.timestampValue;
  if ('nullValue' in field) return null;
  return undefined;
}

function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // Strip control characters; v1 accepted raw form input.
  const cleaned = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return cleaned === '' ? null : cleaned;
}

function toListing(collection: 'drivers' | 'riders', doc: { name: string; fields?: Record<string, FsValue> }): V1Listing {
  const f = doc.fields ?? {};
  return {
    collection,
    id: doc.name.split('/').pop() ?? '',
    email: str(decode(f.email)),
    name: str(decode(f.name)),
    phone: str(decode(f.phone)),
    location: str(decode(f.location)),
    date: str(decode(f.date)),
    direction: str(decode(f.direction)),
    deleted: decode(f.deleted) === true,
    timestamp: str(decode(f.timestamp)),
  };
}

async function fetchCollection(project: string, collection: 'drivers' | 'riders'): Promise<V1Listing[]> {
  const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/artifacts/${project}/public/data/${collection}`;
  const out: V1Listing[] = [];
  let pageToken: string | null = null;
  do {
    const url = new URL(base);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      throw new Error(`v1 Firestore read failed for ${collection}: HTTP ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as {
      documents?: { name: string; fields?: Record<string, FsValue> }[];
      nextPageToken?: string;
    };
    for (const doc of body.documents ?? []) out.push(toListing(collection, doc));
    pageToken = body.nextPageToken ?? null;
  } while (pageToken);
  return out;
}

export async function fetchV1Listings(project = DEFAULT_PROJECT): Promise<V1Listing[]> {
  const [drivers, riders] = await Promise.all([
    fetchCollection(project, 'drivers'),
    fetchCollection(project, 'riders'),
  ]);
  return [...drivers, ...riders];
}

async function readDumpFile(path: string): Promise<V1Listing[]> {
  const parsed = JSON.parse(await readFile(path, 'utf8')) as Record<
    string,
    { name: string; fields?: Record<string, FsValue> }[]
  >;
  const out: V1Listing[] = [];
  for (const collection of ['drivers', 'riders'] as const) {
    for (const doc of parsed[collection] ?? []) out.push(toListing(collection, doc));
  }
  return out;
}

/* ---------- Normalisation ---------- */

function normalizeEmail(raw: string | null): string | null {
  if (!raw) return null;
  let e = raw.trim().toLowerCase().replace(/^mailto:/, '');
  const angled = /<([^>]+)>/.exec(e);
  if (angled?.[1]) e = angled[1].trim();
  e = e.replace(/[.,;:]+$/, '');
  return e === '' ? null : e;
}

interface Accum {
  driver: number;
  rider: number;
  live: boolean;
  hadPhone: boolean;
  toBrc: boolean;
  fromBrc: boolean;
  locations: Map<string, number>;
  /** Most recent listing's name wins. */
  nameAt: string;
  name: string | null;
  lastTravelDate: string | null;
}

export function buildContacts(rows: V1Listing[]): {
  contacts: ContactRecord[];
  docsWithoutEmail: number;
  docsWithMalformedEmail: number;
} {
  const acc = new Map<string, Accum>();
  let docsWithoutEmail = 0;
  let docsWithMalformedEmail = 0;

  for (const r of rows) {
    const email = normalizeEmail(r.email);
    if (!email) {
      docsWithoutEmail++;
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      docsWithMalformedEmail++;
      continue;
    }
    let a = acc.get(email);
    if (!a) {
      a = {
        driver: 0,
        rider: 0,
        live: false,
        hadPhone: false,
        toBrc: false,
        fromBrc: false,
        locations: new Map(),
        nameAt: '',
        name: null,
        lastTravelDate: null,
      };
      acc.set(email, a);
    }
    if (r.collection === 'drivers') a.driver++;
    else a.rider++;
    if (!r.deleted) a.live = true;
    if (r.phone) a.hadPhone = true;
    if (r.direction === 'to-brc' || r.direction === 'to_brc') a.toBrc = true;
    if (r.direction === 'from-brc' || r.direction === 'from_brc') a.fromBrc = true;
    if (r.location) a.locations.set(r.location, (a.locations.get(r.location) ?? 0) + 1);
    const stamp = r.timestamp ?? '';
    if (r.name && stamp >= a.nameAt) {
      a.name = r.name.slice(0, 100);
      a.nameAt = stamp;
    }
    // Travel dates are free-typed strings; only trust well-formed ones.
    if (r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && (!a.lastTravelDate || r.date > a.lastTravelDate)) {
      a.lastTravelDate = r.date;
    }
  }

  const out: ContactRecord[] = [];
  for (const [email, a] of acc) {
    const segment = a.driver > 0 && a.rider > 0 ? 'both' : a.driver > 0 ? 'driver' : 'rider';
    let topLocation: string | null = null;
    let topCount = 0;
    for (const [loc, n] of a.locations) {
      if (n > topCount) {
        topLocation = loc.slice(0, 120);
        topCount = n;
      }
    }
    out.push({
      email,
      name: a.name,
      meta: {
        segment,
        driverListings: a.driver,
        riderListings: a.rider,
        directions: a.toBrc && a.fromBrc ? 'both' : a.toBrc ? 'to_brc' : a.fromBrc ? 'from_brc' : null,
        topLocation,
        lastTravelDate: a.lastTravelDate,
        hadPhone: a.hadPhone,
        allDeleted: !a.live,
      },
      excludeReason: excludeReasonFor(email),
    });
  }
  out.sort((x, y) => x.email.localeCompare(y.email));
  return { contacts: out, docsWithoutEmail, docsWithMalformedEmail };
}

/* ---------- Entry point ---------- */

export interface ImportOptions {
  dryRun?: boolean;
  project?: string;
  /** Read a JSON dump instead of hitting Firestore: {drivers:[...],riders:[...]} raw REST docs. */
  file?: string;
  /** List to put the contacts on; created if missing. */
  listName?: string;
}

async function ensureList(name: string): Promise<string> {
  const [existing] = await db.select({ id: contactLists.id }).from(contactLists).where(eq(contactLists.name, name));
  if (existing) return existing.id;
  const [created] = await db
    .insert(contactLists)
    .values({
      name,
      description: 'Everyone who posted a ride on the 2025 Firebase board. One-time import; not refreshable.',
      kind: 'static',
    })
    .returning({ id: contactLists.id });
  return created!.id;
}

export async function importLegacyContacts(opts: ImportOptions = {}): Promise<ImportResult> {
  const dryRun = opts.dryRun ?? false;
  const listName = opts.listName ?? V1_LIST_NAME;
  const rows = opts.file ? await readDumpFile(opts.file) : await fetchV1Listings(opts.project);
  const { contacts: records, docsWithoutEmail, docsWithMalformedEmail } = buildContacts(rows);

  let inserted = 0;
  let updated = 0;
  let addedToList = 0;
  if (!dryRun && records.length > 0) {
    const result = await upsertContacts(
      records.map((r) => ({ email: r.email, name: r.name, meta: r.meta })),
      'v1_firestore',
    );
    inserted = result.inserted;
    updated = result.updated;
    const listId = await ensureList(listName);
    addedToList = (await addToList(listId, records.map((r) => r.email))).added;
  }

  const byReason: Record<string, number> = {};
  let excludedTotal = 0;
  for (const c of records) {
    if (!c.excludeReason) continue;
    excludedTotal++;
    const key = c.excludeReason.split(':')[0]!;
    byReason[key] = (byReason[key] ?? 0) + 1;
  }

  return {
    docsScanned: rows.length,
    driverDocs: rows.filter((r) => r.collection === 'drivers').length,
    riderDocs: rows.filter((r) => r.collection === 'riders').length,
    softDeletedDocs: rows.filter((r) => r.deleted).length,
    docsWithoutEmail,
    docsWithMalformedEmail,
    uniqueContacts: records.length,
    segments: {
      driver: records.filter((c) => c.meta.segment === 'driver').length,
      rider: records.filter((c) => c.meta.segment === 'rider').length,
      both: records.filter((c) => c.meta.segment === 'both').length,
    },
    excluded: { total: excludedTotal, byReason },
    inserted,
    updated,
    addedToList,
    listName,
    dryRun,
  };
}
