// Demo-data seed script for RideFinder v2.
//
// Populates the board with ~16 realistic Burning Man 2026 listings (event
// window Aug 30 - Sep 7 2026, gates open Aug 30, exodus Sep 5-7) so the app
// demos well. Idempotent: re-running tears down everything it created last
// time (identified by recoveryCode LIKE 'demo-%') before seeding again.
//
// Usage: npm run seed:demo --workspace server   (reads DATABASE_URL from env)
//
// Style note: DEMO_USERS and DEMO_LISTINGS below are plain data. Edit them by
// hand to change the dataset; the code beneath just walks the arrays.

import { inArray, like, or } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import {
  authTokens,
  conversations,
  flags,
  listings,
  magicTokens,
  matches,
  messages,
  users,
} from '../src/db/schema.js';
import { computeExpiresAt, normalizeLocation } from '../src/lib/listingRules.js';
import { recomputeMatchesForListing } from '../src/matching/score.js';

type ListingType = 'driver' | 'rider';
type Direction = 'to_brc' | 'from_brc';
type Belongings = 'minimal' | 'standard' | 'substantial' | 'extensive';

interface DemoUserSeed {
  slug: string;
  name: string;
  phoneSuffix: string; // 4 digits, plugged into +1555010XXXX
}

interface DemoListingSeed {
  // Optional handle so later steps (conversations) can reference a specific
  // listing without hunting through the array by position.
  key?: string;
  userSlug: string;
  type: ListingType;
  direction: Direction;
  locationRaw: string;
  travelDate: string; // YYYY-MM-DD, playa time
  timeSlot: string; // 'flexible' or 'HH:00 - HH:00'
  details?: string;
  campInfo?: string;
  passengerSpace?: number;
  cargoSpace?: Belongings;
  riderStuff?: Belongings;
  routeDetails?: string;
}

interface DemoConversationSeed {
  listingKey: string;
  initiatorSlug: string;
  // Alternates starting with the initiator. Last entry's readAt behavior is
  // controlled by `leaveLastUnread`.
  turns: { fromInitiator: boolean; body: string }[];
  leaveLastUnread: boolean;
}

// ---------------------------------------------------------------------------
// Demo users
// ---------------------------------------------------------------------------

const DEMO_USERS: DemoUserSeed[] = [
  { slug: 'sparkle', name: 'Sparkle', phoneSuffix: '0101' },
  { slug: 'dusty-miller', name: 'Dusty Miller', phoneSuffix: '0102' },
  { slug: 'captain-neon', name: 'Captain Neon', phoneSuffix: '0103' },
  { slug: 'sarah-k', name: 'Sarah K.', phoneSuffix: '0104' },
  { slug: 'trombone-tim', name: 'Trombone Tim', phoneSuffix: '0105' },
  { slug: 'moonbeam', name: 'Moonbeam', phoneSuffix: '0106' },
  { slug: 'jake-r', name: 'Jake R.', phoneSuffix: '0107' },
  { slug: 'glitter-gus', name: 'Glitter Gus', phoneSuffix: '0108' },
  { slug: 'nova', name: 'Nova', phoneSuffix: '0109' },
  { slug: 'ranger-rick', name: 'Ranger Rick', phoneSuffix: '0110' },
  { slug: 'peaches', name: 'Peaches', phoneSuffix: '0111' },
  { slug: 'dj-dromedary', name: 'DJ Dromedary', phoneSuffix: '0112' },
  { slug: 'quiet-quinn', name: 'Quiet Quinn', phoneSuffix: '0113' },
  { slug: 'bea', name: 'Bea', phoneSuffix: '0114' },
];

// ---------------------------------------------------------------------------
// Demo listings (~16). Two users (moonbeam, jake-r) post a second listing for
// the return leg, which is how real burners actually use the board.
// ---------------------------------------------------------------------------

const DEMO_LISTINGS: DemoListingSeed[] = [
  // --- to_brc drivers (5) ---------------------------------------------------
  {
    key: 'reno_driver',
    userSlug: 'dusty-miller',
    type: 'driver',
    direction: 'to_brc',
    locationRaw: 'Reno, NV',
    travelDate: '2026-08-30',
    timeSlot: 'flexible',
    passengerSpace: 4,
    cargoSpace: 'standard',
    details: 'Truck + trailer, room for bikes. Leaving Gerlach 6am sharp.',
  },
  {
    userSlug: 'jake-r',
    type: 'driver',
    direction: 'to_brc',
    locationRaw: 'San Francisco, CA',
    travelDate: '2026-08-29',
    timeSlot: '09:00 - 12:00',
    passengerSpace: 2,
    cargoSpace: 'extensive',
    details: 'Art car support vehicle, mellow drive, gas split.',
  },
  {
    userSlug: 'ranger-rick',
    type: 'driver',
    direction: 'to_brc',
    locationRaw: 'Sacramento, CA',
    travelDate: '2026-08-28',
    timeSlot: '06:00 - 09:00',
    passengerSpace: 3,
    cargoSpace: 'substantial',
    details: 'Diesel truck, veteran burner, know all the shortcuts.',
  },
  {
    userSlug: 'moonbeam',
    type: 'driver',
    direction: 'to_brc',
    locationRaw: 'Portland, OR',
    travelDate: '2026-08-31',
    timeSlot: 'flexible',
    passengerSpace: 1,
    cargoSpace: 'minimal',
    details: 'Small car, just me plus one more + gear.',
  },
  {
    userSlug: 'glitter-gus',
    type: 'driver',
    direction: 'to_brc',
    locationRaw: 'Los Angeles, CA',
    travelDate: '2026-09-01',
    timeSlot: '12:00 - 15:00',
    passengerSpace: 4,
    cargoSpace: 'extensive',
    details: 'Sprinter van, room for shade structure + bikes.',
  },

  // --- to_brc riders (4) -----------------------------------------------------
  {
    userSlug: 'sparkle',
    type: 'rider',
    direction: 'to_brc',
    locationRaw: 'Reno, NV',
    travelDate: '2026-08-30',
    timeSlot: 'flexible',
    riderStuff: 'minimal',
    details: 'First burn! Have gas money + snacks',
  },
  {
    userSlug: 'sarah-k',
    type: 'rider',
    direction: 'to_brc',
    locationRaw: 'Oakland, CA',
    travelDate: '2026-08-29',
    timeSlot: '09:00 - 12:00',
    riderStuff: 'standard',
    details: 'Just me + a duffel and a bike',
  },
  {
    userSlug: 'trombone-tim',
    type: 'rider',
    direction: 'to_brc',
    locationRaw: 'Salt Lake City, UT',
    travelDate: '2026-08-28',
    timeSlot: '06:00 - 09:00',
    riderStuff: 'substantial',
    details: 'Bringing my trombone + camp gear, happy to split gas.',
  },
  {
    userSlug: 'nova',
    type: 'rider',
    direction: 'to_brc',
    locationRaw: 'Seattle, WA',
    travelDate: '2026-08-31',
    timeSlot: 'flexible',
    riderStuff: 'minimal',
    details: "Flying into Reno instead if that's easier - flexible either way.",
  },

  // --- from_brc drivers (4) ---------------------------------------------------
  {
    key: 'sf_exodus_driver',
    userSlug: 'peaches',
    type: 'driver',
    direction: 'from_brc',
    locationRaw: 'San Francisco, CA',
    travelDate: '2026-09-06',
    timeSlot: 'flexible',
    passengerSpace: 3,
    cargoSpace: 'standard',
    campInfo: 'Camp Comfort & Joy, 7:30 & E',
    details: 'Heading back Sunday morning, no rush.',
  },
  {
    userSlug: 'dj-dromedary',
    type: 'driver',
    direction: 'from_brc',
    locationRaw: 'Reno, NV',
    travelDate: '2026-09-05',
    timeSlot: '09:00 - 12:00',
    passengerSpace: 2,
    cargoSpace: 'substantial',
    campInfo: '4:20 & G, ask for the dome',
    details: 'Exodus day one, leaving early to beat traffic.',
  },
  {
    userSlug: 'quiet-quinn',
    type: 'driver',
    direction: 'from_brc',
    locationRaw: 'Los Angeles, CA',
    travelDate: '2026-09-07',
    timeSlot: 'flexible',
    passengerSpace: 4,
    cargoSpace: 'extensive',
    campInfo: '9:00 & Esplanade, look for the pirate ship',
    details: 'Last one out, helping strike camp first.',
  },
  {
    userSlug: 'bea',
    type: 'driver',
    direction: 'from_brc',
    locationRaw: 'Denver, CO',
    travelDate: '2026-09-06',
    timeSlot: '12:00 - 15:00',
    passengerSpace: 1,
    cargoSpace: 'minimal',
    campInfo: '6:00 & C, purple flag',
    details: 'Small car, room for one + light gear.',
  },

  // --- from_brc riders (3) ------------------------------------------------
  {
    key: 'sf_exodus_rider',
    userSlug: 'captain-neon',
    type: 'rider',
    direction: 'from_brc',
    locationRaw: 'San Francisco, CA',
    travelDate: '2026-09-06',
    timeSlot: 'flexible',
    riderStuff: 'standard',
    campInfo: '7:30 & E, near Comfort & Joy',
    details: 'Ready to go home Sunday, have bin + bike.',
  },
  {
    userSlug: 'moonbeam',
    type: 'rider',
    direction: 'from_brc',
    locationRaw: 'Portland, OR',
    travelDate: '2026-09-05',
    timeSlot: 'flexible',
    riderStuff: 'minimal',
    campInfo: '3:00 & F, blue dome',
    details: 'Heading north, minimal gear, easy rider.',
  },
  {
    userSlug: 'jake-r',
    type: 'rider',
    direction: 'from_brc',
    locationRaw: 'Las Vegas, NV',
    travelDate: '2026-09-06',
    timeSlot: '09:00 - 12:00',
    riderStuff: 'minimal',
    campInfo: '5:15 & H',
    details: "Detouring through Vegas for a few days, just need a ride that far.",
  },
];

// ---------------------------------------------------------------------------
// Demo conversations (2), 2-3 messages each. One is left with an unread
// message for its listing owner; the other is fully read.
// ---------------------------------------------------------------------------

const DEMO_CONVERSATIONS: DemoConversationSeed[] = [
  {
    listingKey: 'reno_driver',
    initiatorSlug: 'sparkle',
    turns: [
      { fromInitiator: true, body: 'Hey! Still have room Sunday?' },
      { fromInitiator: false, body: 'Yep - one seat left. You have gear?' },
      { fromInitiator: true, body: 'Just a backpack and a cooler, see you at 6am!' },
    ],
    leaveLastUnread: true,
  },
  {
    listingKey: 'sf_exodus_driver',
    initiatorSlug: 'captain-neon',
    turns: [
      { fromInitiator: true, body: "Hey! Ready to head back Sunday, still have space?" },
      { fromInitiator: false, body: 'Yep! Meet at Comfort & Joy 7:30 & E around 9am.' },
    ],
    leaveLastUnread: false,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDigits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String(randomInt(0, 9));
  return out;
}

function recentCreatedAt(): Date {
  // Spread over the past 3 days so timestamps look organic.
  const maxAgeMs = 3 * 24 * 3600 * 1000;
  return new Date(Date.now() - randomInt(0, maxAgeMs));
}

type UserRow = typeof users.$inferSelect;
type ListingRow = typeof listings.$inferSelect;

// ---------------------------------------------------------------------------
// Teardown: remove everything from a previous run of this script, in FK order.
// ---------------------------------------------------------------------------

async function teardown(): Promise<number> {
  const demoUserRows = await db.select({ id: users.id }).from(users).where(like(users.recoveryCode, 'demo-%'));
  const demoUserIds = demoUserRows.map((r) => r.id);
  if (demoUserIds.length === 0) return 0;

  const demoListingRows = await db
    .select({ id: listings.id })
    .from(listings)
    .where(inArray(listings.userId, demoUserIds));
  const demoListingIds = demoListingRows.map((r) => r.id);

  // flags: listingId cascades on listing delete, but flaggerId does not
  // cascade on user delete, so it must be cleared explicitly either way.
  if (demoListingIds.length > 0) {
    await db
      .delete(flags)
      .where(or(inArray(flags.listingId, demoListingIds), inArray(flags.flaggerId, demoUserIds)));
  } else {
    await db.delete(flags).where(inArray(flags.flaggerId, demoUserIds));
  }

  // matches: cascades on listing delete, but clear explicitly for a clean,
  // idempotent teardown regardless of insertion order below.
  if (demoListingIds.length > 0) {
    await db
      .delete(matches)
      .where(or(inArray(matches.driverListingId, demoListingIds), inArray(matches.riderListingId, demoListingIds)));
  }

  // conversations touching demo listings, OR initiated by a demo user on any
  // listing (in case a demo user messaged about a non-demo listing).
  const conversationWhere =
    demoListingIds.length > 0
      ? or(inArray(conversations.initiatorUserId, demoUserIds), inArray(conversations.listingId, demoListingIds))
      : inArray(conversations.initiatorUserId, demoUserIds);
  const demoConversationRows = await db.select({ id: conversations.id }).from(conversations).where(conversationWhere);
  const demoConversationIds = demoConversationRows.map((r) => r.id);

  // messages in those conversations, OR sent by a demo user in any conversation.
  if (demoConversationIds.length > 0) {
    await db
      .delete(messages)
      .where(or(inArray(messages.conversationId, demoConversationIds), inArray(messages.senderUserId, demoUserIds)));
  } else {
    await db.delete(messages).where(inArray(messages.senderUserId, demoUserIds));
  }

  if (demoConversationIds.length > 0) {
    await db.delete(conversations).where(inArray(conversations.id, demoConversationIds));
  }

  if (demoListingIds.length > 0) {
    await db.delete(listings).where(inArray(listings.id, demoListingIds));
  }

  await db.delete(authTokens).where(inArray(authTokens.userId, demoUserIds));
  await db.delete(magicTokens).where(inArray(magicTokens.userId, demoUserIds));
  await db.delete(users).where(inArray(users.id, demoUserIds));

  return demoUserIds.length;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function createUsers(): Promise<{ bySlug: Map<string, UserRow>; byId: Map<string, UserRow> }> {
  const bySlug = new Map<string, UserRow>();
  const byId = new Map<string, UserRow>();
  for (const seed of DEMO_USERS) {
    const recoveryCode = `demo-${seed.slug}-${randomDigits(4)}`;
    const [row] = await db
      .insert(users)
      .values({
        recoveryCode,
        name: seed.name,
        email: `${seed.slug}@example.com`,
        phone: `+1555010${seed.phoneSuffix}`,
        // CRITICAL: seed users must never receive digest emails once real
        // sending is on.
        digestFrequency: 'off',
      })
      .returning();
    bySlug.set(seed.slug, row!);
    byId.set(row!.id, row!);
  }
  return { bySlug, byId };
}

async function createListings(usersBySlug: Map<string, UserRow>): Promise<{
  byKey: Map<string, ListingRow>;
  all: ListingRow[];
}> {
  const byKey = new Map<string, ListingRow>();
  const all: ListingRow[] = [];

  for (const seed of DEMO_LISTINGS) {
    const user = usersBySlug.get(seed.userSlug);
    if (!user) throw new Error(`Unknown demo user slug in DEMO_LISTINGS: ${seed.userSlug}`);

    const createdAt = recentCreatedAt();
    const values: typeof listings.$inferInsert = {
      userId: user.id,
      type: seed.type,
      direction: seed.direction,
      name: user.name ?? seed.userSlug,
      locationRaw: seed.locationRaw,
      locationNorm: normalizeLocation(seed.locationRaw),
      travelDate: seed.travelDate,
      timeSlot: seed.timeSlot,
      details: seed.details ?? null,
      campInfo: seed.campInfo ?? null,
      passengerSpace: seed.type === 'driver' ? (seed.passengerSpace ?? null) : null,
      cargoSpace: seed.type === 'driver' ? (seed.cargoSpace ?? null) : null,
      routeDetails: seed.type === 'driver' ? (seed.routeDetails ?? null) : null,
      riderStuff: seed.type === 'rider' ? (seed.riderStuff ?? null) : null,
      expiresAt: computeExpiresAt(seed.travelDate, seed.timeSlot),
      clientId: null,
      createdAt,
      updatedAt: createdAt,
    };

    const [row] = await db.insert(listings).values(values).returning();
    await recomputeMatchesForListing(row!);

    all.push(row!);
    if (seed.key) byKey.set(seed.key, row!);
  }

  return { byKey, all };
}

async function createConversations(
  usersBySlug: Map<string, UserRow>,
  usersById: Map<string, UserRow>,
  listingsByKey: Map<string, ListingRow>,
): Promise<number> {
  let created = 0;
  for (const seed of DEMO_CONVERSATIONS) {
    const listing = listingsByKey.get(seed.listingKey);
    const initiator = usersBySlug.get(seed.initiatorSlug);
    if (!listing || !initiator) {
      throw new Error(`Unknown listingKey/initiatorSlug in DEMO_CONVERSATIONS: ${seed.listingKey}/${seed.initiatorSlug}`);
    }
    const listingOwner = usersById.get(listing.userId);
    if (!listingOwner) throw new Error(`No demo user found for listing owner ${listing.userId}`);

    const [conversation] = await db
      .insert(conversations)
      .values({ listingId: listing.id, initiatorUserId: initiator.id })
      .returning();

    const now = new Date();
    const lastIndex = seed.turns.length - 1;
    for (let i = 0; i < seed.turns.length; i++) {
      const turn = seed.turns[i]!;
      const senderId = turn.fromInitiator ? initiator.id : listingOwner.id;
      const isLast = i === lastIndex;
      const unread = seed.leaveLastUnread && isLast;
      await db.insert(messages).values({
        conversationId: conversation!.id,
        senderUserId: senderId,
        body: turn.body,
        emailedAt: now, // never digested
        readAt: unread ? null : now,
      });
    }
    created += 1;
  }
  return created;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const removed = await teardown();
  console.log(`Teardown: removed ${removed} previous demo user(s) and their data.`);

  try {
    const { bySlug: usersBySlug, byId: usersById } = await createUsers();
    const { byKey: listingsByKey, all: allListings } = await createListings(usersBySlug);
    const conversationCount = await createConversations(usersBySlug, usersById, listingsByKey);

    const listingIds = allListings.map((l) => l.id);
    const matchRows =
      listingIds.length > 0
        ? await db
            .select({ driverListingId: matches.driverListingId, riderListingId: matches.riderListingId })
            .from(matches)
            .where(or(inArray(matches.driverListingId, listingIds), inArray(matches.riderListingId, listingIds)))
        : [];

    const byDirection = (direction: Direction, type: ListingType) =>
      allListings.filter((l) => l.direction === direction && l.type === type).length;

    console.log('');
    console.log('=== Demo seed summary ===');
    console.log(`Users created: ${usersBySlug.size}`);
    console.log(`Listings created: ${allListings.length}`);
    console.log(`  to_brc   drivers: ${byDirection('to_brc', 'driver')}, riders: ${byDirection('to_brc', 'rider')}`);
    console.log(`  from_brc drivers: ${byDirection('from_brc', 'driver')}, riders: ${byDirection('from_brc', 'rider')}`);
    console.log(`Matches computed (involving demo listings): ${matchRows.length}`);
    console.log(`Conversations created: ${conversationCount}`);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }

  // pg pool keeps the process alive otherwise.
  process.exit(0);
}

void main();
