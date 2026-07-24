import {
  boolean,
  customType,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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
