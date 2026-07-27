import {
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const citext = customType<{ data: string }>({
  dataType: () => 'citext',
});

export const bytea = customType<{ data: Buffer }>({
  dataType: () => 'bytea',
});

export const listingTypeEnum = pgEnum('listing_type', ['driver', 'rider']);
export const directionEnum = pgEnum('direction', ['to_brc', 'from_brc']);
export const belongingsEnum = pgEnum('belongings', ['minimal', 'standard', 'substantial', 'extensive']);
export const digestFreqEnum = pgEnum('digest_freq', ['instant', 'hourly', 'daily', 'off']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  recoveryCode: text('recovery_code').notNull().unique(),
  name: text('name'),
  email: citext('email'),
  phone: text('phone'),
  digestFrequency: digestFreqEnum('digest_frequency').notNull().default('hourly'),
  phoneContactPref: text('phone_contact_pref').notNull().default('sms'),
  prefs: jsonb('prefs').notNull().default({}),
  lastDigestAt: timestamp('last_digest_at', { withTimezone: true }),
  isAdmin: boolean('is_admin').notNull().default(false),
  bannedAt: timestamp('banned_at', { withTimezone: true }),
  avatarFull: bytea('avatar_full'),
  avatarThumb: bytea('avatar_thumb'),
  avatarUpdatedAt: timestamp('avatar_updated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authTokens = pgTable('auth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const magicTokens = pgTable('magic_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const listings = pgTable('listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  type: listingTypeEnum('type').notNull(),
  direction: directionEnum('direction').notNull(),
  name: text('name').notNull(),
  locationRaw: text('location_raw').notNull(),
  locationNorm: text('location_norm').notNull(),
  travelDate: date('travel_date').notNull(),
  timeSlot: text('time_slot').notNull().default('flexible'),
  details: text('details'),
  campInfo: text('camp_info'),
  passengerSpace: smallint('passenger_space'),
  cargoSpace: belongingsEnum('cargo_space'),
  routeDetails: text('route_details'),
  riderStuff: belongingsEnum('rider_stuff'),
  originLat: doublePrecision('origin_lat'),
  originLng: doublePrecision('origin_lng'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  hiddenAt: timestamp('hidden_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  clientId: uuid('client_id'),
});

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id),
    initiatorUserId: uuid('initiator_user_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.listingId, table.initiatorUserId)],
);

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id),
  senderUserId: uuid('sender_user_id')
    .notNull()
    .references(() => users.id),
  body: text('body').notNull(),
  sharedEmail: citext('shared_email'),
  sharedPhone: text('shared_phone'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
  emailedAt: timestamp('emailed_at', { withTimezone: true }),
  clientId: uuid('client_id'),
});

export const matches = pgTable(
  'matches',
  {
    driverListingId: uuid('driver_listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    riderListingId: uuid('rider_listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    reasons: jsonb('reasons').notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
    notifiedDriverAt: timestamp('notified_driver_at', { withTimezone: true }),
    notifiedRiderAt: timestamp('notified_rider_at', { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.driverListingId, table.riderListingId] })],
);

export const flags = pgTable(
  'flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    flaggerId: uuid('flagger_id')
      .notNull()
      .references(() => users.id),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.listingId, table.flaggerId)],
);

export const emailLog = pgTable('email_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  toEmail: citext('to_email').notNull(),
  kind: text('kind').notNull(),
  subject: text('subject').notNull(),
  sesMessageId: text('ses_message_id'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emailSuppressions = pgTable('email_suppressions', {
  email: citext('email').primaryKey(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Server-side usage metrics. IPs are stored only as salted hashes; geo lives in
// a separate cache keyed by the same hash so raw addresses never touch disk.
export const visits = pgTable('visits', {
  id: uuid('id').primaryKey().defaultRandom(),
  day: date('day').notNull(),
  ipHash: text('ip_hash').notNull(),
  path: text('path').notNull().default('/'),
  referrerHost: text('referrer_host'),
  hadSession: boolean('had_session').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ipGeo = pgTable('ip_geo', {
  ipHash: text('ip_hash').primaryKey(),
  region: text('region'),
  country: text('country'),
  lookedUpAt: timestamp('looked_up_at', { withTimezone: true }).notNull().defaultNow(),
});

// GeoNames US+CA cities (pop >15k) — typeahead + listing geocoding.
export const cities = pgTable('cities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  state: text('state').notNull(),
  country: text('country').notNull(),
  nameNorm: text('name_norm').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  population: integer('population').notNull(),
});

export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ---------- Outreach: contacts, lists, campaigns ---------- */

/** Provenance facts a source knew about a contact. Free-form by design. */
export interface ContactMeta {
  /** v1 import: which side of the 2025 board they posted on. */
  segment?: 'driver' | 'rider' | 'both';
  driverListings?: number;
  riderListings?: number;
  /** 'to_brc' | 'from_brc' | 'both' */
  directions?: string | null;
  topLocation?: string | null;
  lastTravelDate?: string | null;
  hadPhone?: boolean;
  /** v1 import: every listing for this address was soft-deleted by its owner. */
  allDeleted?: boolean;
}

// Any address we might send bulk mail to, whatever its origin. Deliberately NOT
// users: being on a list grants no account. Unsubscribe state lives here rather
// than per-list, so opting out is global in one action.
export const contacts = pgTable(
  'contacts',
  {
    email: citext('email').primaryKey(),
    name: text('name'),
    /** Set when this address belongs to a v2 account. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** 'v1_firestore' | 'paste' | 'users' | 'manual' */
    source: text('source').notNull().default('manual'),
    meta: jsonb('meta').$type<ContactMeta>().notNull().default({}),
    /** Single-purpose capability: stops bulk mail to this address. No session. */
    unsubscribeToken: text('unsubscribe_token').notNull().unique(),
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    excludedAt: timestamp('excluded_at', { withTimezone: true }),
    excludeReason: text('exclude_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('contacts_user_idx').on(table.userId)],
);

export const contactLists = pgTable('contact_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  /** 'static' — membership as imported; 'dynamic' — recomputed from `query`. */
  kind: text('kind').notNull().default('static'),
  /** Dynamic lists only: a key in lib/audiences.ts. */
  query: text('query'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  refreshedAt: timestamp('refreshed_at', { withTimezone: true }),
});

export const contactListMembers = pgTable(
  'contact_list_members',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => contactLists.id, { onDelete: 'cascade' }),
    email: citext('email')
      .notNull()
      .references(() => contacts.email, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.listId, table.email] })],
);

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  subject: text('subject').notNull(),
  listId: uuid('list_id')
    .notNull()
    .references(() => contactLists.id, { onDelete: 'restrict' }),
  /** 'invite' | 'announcement' */
  template: text('template').notNull().default('announcement'),
  headline: text('headline'),
  intro: text('intro'),
  ctaLabel: text('cta_label'),
  ctaPath: text('cta_path'),
  /** 'draft' | 'sending' | 'paused' | 'done' | 'cancelled' */
  status: text('status').notNull().default('draft'),
  throttlePerMinute: integer('throttle_per_minute').notNull().default(20),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

// One row per (campaign, recipient), materialised when the campaign starts. The
// sender only ever touches rows still marked 'pending', so a mid-send restart
// never double-mails anyone.
export const campaignSends = pgTable(
  'campaign_sends',
  {
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    email: citext('email').notNull(),
    /** 'pending' | 'sent' | 'suppressed' | 'unsubscribed' | 'failed' */
    status: text('status').notNull().default('pending'),
    sesMessageId: text('ses_message_id'),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.email] })],
);
