import { zValidator } from '@hono/zod-validator';
import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ensureUser, requireUser } from '../auth/middleware.js';
import { db } from '../db/client.js';
import { flags, listings, users } from '../db/schema.js';
import { allow } from '../lib/rateLimit.js';
import { rateLimit } from '../lib/settings.js';
import { normalizePhone } from '../lib/phone.js';
import { computeExpiresAt, normalizeLocation, TIME_SLOT_RE } from '../lib/listingRules.js';
import { geocodeLocation } from '../lib/cities.js';
import { recomputeMatchesForListing } from '../matching/score.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function toListingDto(
  row: typeof listings.$inferSelect,
  viewerId: string | null,
  avatarVersion: number | null = null,
) {
  return {
    id: row.id,
    type: row.type,
    direction: row.direction,
    name: row.name,
    location: row.locationRaw,
    travelDate: row.travelDate,
    timeSlot: row.timeSlot,
    details: row.details,
    campInfo: row.campInfo,
    passengerSpace: row.passengerSpace,
    cargoSpace: row.cargoSpace,
    routeDetails: row.routeDetails,
    riderStuff: row.riderStuff,
    expiresAt: row.expiresAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isMine: viewerId !== null && row.userId === viewerId,
    avatarVersion,
  };
}

const belongingsSchema = z.enum(['minimal', 'standard', 'substantial', 'extensive']);
const timeSlotSchema = z
  .string()
  .refine((s) => s === 'flexible' || TIME_SLOT_RE.test(s), { message: 'invalid_time_slot' });
const travelDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSchema = z
  .object({
    clientId: z.string().uuid(),
    type: z.enum(['driver', 'rider']),
    direction: z.enum(['to_brc', 'from_brc']),
    name: z.string().min(1).max(60),
    location: z.string().min(1).max(80),
    travelDate: travelDateSchema,
    timeSlot: timeSlotSchema,
    details: z.string().max(1000).optional(),
    campInfo: z.string().max(1000).optional(),
    passengerSpace: z.number().int().min(1).max(5).optional(),
    cargoSpace: belongingsSchema.optional(),
    routeDetails: z.string().max(1000).optional(),
    riderStuff: belongingsSchema.optional(),
    // Honeypot: humans never see this field; bots that fill it get a fake success.
    website: z.string().optional(),
    contact: z
      .object({
        email: z.string().email().max(120).optional(),
        phone: z.string().max(30).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'driver') {
      if (data.passengerSpace === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'passenger_space_required', path: ['passengerSpace'] });
      }
      if (data.cargoSpace === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'cargo_space_required', path: ['cargoSpace'] });
      }
    } else {
      if (data.riderStuff === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'rider_stuff_required', path: ['riderStuff'] });
      }
    }
  });

const updateSchema = z.object({
  direction: z.enum(['to_brc', 'from_brc']).optional(),
  name: z.string().min(1).max(60).optional(),
  location: z.string().min(1).max(80).optional(),
  travelDate: travelDateSchema.optional(),
  timeSlot: timeSlotSchema.optional(),
  details: z.string().max(1000).optional(),
  campInfo: z.string().max(1000).optional(),
  passengerSpace: z.number().int().min(1).max(5).optional(),
  cargoSpace: belongingsSchema.optional(),
  routeDetails: z.string().max(1000).optional(),
  riderStuff: belongingsSchema.optional(),
});

const flagSchema = z.object({
  reason: z.string().max(300).optional(),
});

async function avatarVersionsFor(userIds: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, at: users.avatarUpdatedAt })
    .from(users)
    .where(and(inArray(users.id, unique), isNotNull(users.avatarUpdatedAt)));
  return new Map(rows.map((r) => [r.id, r.at!.getTime()]));
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === '23505';
}

export const listingRoutes = new Hono();

listingRoutes.get('/listings', async (c) => {
  const viewerId = c.get('user')?.id ?? null;
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const rows = await db
    .select()
    .from(listings)
    .where(
      and(
        isNull(listings.deletedAt),
        isNull(listings.hiddenAt),
        isNull(listings.cancelledAt),
        gt(listings.expiresAt, cutoff),
      ),
    )
    .orderBy(asc(listings.travelDate), desc(listings.createdAt))
    .limit(500);
  const avatarVersions = await avatarVersionsFor(rows.map((r) => r.userId));
  return c.json({
    listings: rows.map((r) => toListingDto(r, viewerId, avatarVersions.get(r.userId) ?? null)),
    serverTime: new Date().toISOString(),
  });
});

listingRoutes.get('/listings/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) throw new HTTPException(404, { message: 'not_found' });

  const viewer = c.get('user');
  const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new HTTPException(404, { message: 'not_found' });

  const isOwnerOrAdmin = viewer !== null && (viewer.id === row.userId || viewer.isAdmin);
  if ((row.deletedAt || row.hiddenAt) && !isOwnerOrAdmin) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  const avatarVersions = await avatarVersionsFor([row.userId]);
  return c.json({ listing: toListingDto(row, viewer?.id ?? null, avatarVersions.get(row.userId) ?? null) });
});

listingRoutes.post(
  '/listings',
  zValidator('json', createSchema, (result, c) => {
    if (!result.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    const user = await ensureUser(c);
    const body = c.req.valid('json');

    if (body.website) {
      return c.json({ listing: null }, 201);
    }

    // Step 1: idempotency replay by clientId.
    const existingRows = await db.select().from(listings).where(eq(listings.clientId, body.clientId)).limit(1);
    const existing = existingRows[0];
    if (existing) {
      if (existing.userId === user.id) {
        return c.json({ listing: toListingDto(existing, user.id) }, 200);
      }
      throw new HTTPException(409, { message: 'conflict' });
    }

    // Step 2: contact capture.
    let currentUser = user;
    const userUpdates: Partial<typeof users.$inferInsert> = {};
    if (body.contact?.email) {
      userUpdates.email = body.contact.email.trim().toLowerCase();
    }
    if (body.contact?.phone) {
      const normalized = normalizePhone(body.contact.phone);
      if (!normalized) throw new HTTPException(400, { message: 'invalid_phone' });
      userUpdates.phone = normalized;
    }
    if (currentUser.name === null) {
      userUpdates.name = body.name;
    }
    if (Object.keys(userUpdates).length > 0) {
      const rows = await db.update(users).set(userUpdates).where(eq(users.id, currentUser.id)).returning();
      currentUser = rows[0]!;
    }
    if (!currentUser.email && !currentUser.phone) {
      throw new HTTPException(400, { message: 'contact_required' });
    }

    // Step 3: DB-backed rate limits.
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const createdTodayRows = await db
      .select({ n: count() })
      .from(listings)
      .where(and(eq(listings.userId, currentUser.id), gt(listings.createdAt, dayAgo)));
    if (createdTodayRows[0]!.n >= 5) throw new HTTPException(429, { message: 'daily_limit' });

    const activeSameDirectionRows = await db
      .select({ n: count() })
      .from(listings)
      .where(
        and(
          eq(listings.userId, currentUser.id),
          eq(listings.direction, body.direction),
          isNull(listings.cancelledAt),
          isNull(listings.deletedAt),
          gt(listings.expiresAt, new Date()),
        ),
      );
    if (activeSameDirectionRows[0]!.n >= 3) throw new HTTPException(429, { message: 'active_limit' });

    // Step 4: insert.
    const locationNorm = normalizeLocation(body.location);
    const origin = await geocodeLocation(locationNorm);
    const expiresAt = computeExpiresAt(body.travelDate, body.timeSlot);
    const isDriver = body.type === 'driver';

    const values: typeof listings.$inferInsert = {
      userId: currentUser.id,
      type: body.type,
      direction: body.direction,
      name: body.name,
      locationRaw: body.location,
      locationNorm,
      originLat: origin?.lat ?? null,
      originLng: origin?.lng ?? null,
      travelDate: body.travelDate,
      timeSlot: body.timeSlot,
      details: body.details ?? null,
      campInfo: body.campInfo ?? null,
      passengerSpace: isDriver ? (body.passengerSpace ?? null) : null,
      cargoSpace: isDriver ? (body.cargoSpace ?? null) : null,
      routeDetails: isDriver ? (body.routeDetails ?? null) : null,
      riderStuff: isDriver ? null : (body.riderStuff ?? null),
      expiresAt,
      clientId: body.clientId,
    };

    try {
      const inserted = await db.insert(listings).values(values).returning();
      await recomputeMatchesForListing(inserted[0]!);
      return c.json({ listing: toListingDto(inserted[0]!, currentUser.id) }, 201);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const rows = await db.select().from(listings).where(eq(listings.clientId, body.clientId)).limit(1);
        if (rows[0]) return c.json({ listing: toListingDto(rows[0], currentUser.id) }, 200);
      }
      throw err;
    }
  },
);

listingRoutes.patch(
  '/listings/:id',
  zValidator('json', updateSchema, (result, c) => {
    if (!result.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    const id = c.req.param('id');
    const user = requireUser(c);
    if (!isUuid(id)) throw new HTTPException(404, { message: 'not_found' });

    const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    const row = rows[0];
    if (!row || row.deletedAt) throw new HTTPException(404, { message: 'not_found' });
    if (row.userId !== user.id && !user.isAdmin) throw new HTTPException(403, { message: 'forbidden' });

    const body = c.req.valid('json');
    const mergedTravelDate = body.travelDate ?? row.travelDate;
    const mergedTimeSlot = body.timeSlot ?? row.timeSlot;
    const mergedPassengerSpace = body.passengerSpace ?? row.passengerSpace;
    const mergedCargoSpace = body.cargoSpace ?? row.cargoSpace;
    const mergedRiderStuff = body.riderStuff ?? row.riderStuff;

    if (row.type === 'driver' && (mergedPassengerSpace === null || mergedCargoSpace === null)) {
      throw new HTTPException(400, { message: 'invalid' });
    }
    if (row.type === 'rider' && mergedRiderStuff === null) {
      throw new HTTPException(400, { message: 'invalid' });
    }

    const updates: Partial<typeof listings.$inferInsert> = {
      direction: body.direction ?? row.direction,
      name: body.name ?? row.name,
      details: body.details ?? row.details,
      campInfo: body.campInfo ?? row.campInfo,
      passengerSpace: mergedPassengerSpace,
      cargoSpace: mergedCargoSpace,
      routeDetails: body.routeDetails ?? row.routeDetails,
      riderStuff: mergedRiderStuff,
      updatedAt: new Date(),
    };

    if (body.location !== undefined) {
      updates.locationRaw = body.location;
      updates.locationNorm = normalizeLocation(body.location);
      const origin = await geocodeLocation(updates.locationNorm);
      updates.originLat = origin?.lat ?? null;
      updates.originLng = origin?.lng ?? null;
    }
    if (body.travelDate !== undefined || body.timeSlot !== undefined) {
      updates.travelDate = mergedTravelDate;
      updates.timeSlot = mergedTimeSlot;
      updates.expiresAt = computeExpiresAt(mergedTravelDate, mergedTimeSlot);
    }

    const updated = await db.update(listings).set(updates).where(eq(listings.id, id)).returning();
    await recomputeMatchesForListing(updated[0]!);
    return c.json({ listing: toListingDto(updated[0]!, user.id) });
  },
);

listingRoutes.post('/listings/:id/cancel', async (c) => {
  const id = c.req.param('id');
  const user = requireUser(c);
  if (!isUuid(id)) throw new HTTPException(404, { message: 'not_found' });

  const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  const row = rows[0];
  if (!row || row.deletedAt) throw new HTTPException(404, { message: 'not_found' });
  if (row.userId !== user.id && !user.isAdmin) throw new HTTPException(403, { message: 'forbidden' });

  let result = row;
  if (!row.cancelledAt) {
    const now = new Date();
    const updated = await db
      .update(listings)
      .set({ cancelledAt: now, updatedAt: now })
      .where(eq(listings.id, id))
      .returning();
    result = updated[0]!;
    await recomputeMatchesForListing(result);
  }
  return c.json({ listing: toListingDto(result, user.id) });
});

listingRoutes.delete('/listings/:id', async (c) => {
  const id = c.req.param('id');
  const user = requireUser(c);
  if (!isUuid(id)) throw new HTTPException(404, { message: 'not_found' });

  const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  const row = rows[0];
  if (!row || row.deletedAt) throw new HTTPException(404, { message: 'not_found' });
  if (row.userId !== user.id && !user.isAdmin) throw new HTTPException(403, { message: 'forbidden' });

  const deleted = await db.update(listings).set({ deletedAt: new Date() }).where(eq(listings.id, id)).returning();
  if (deleted[0]) await recomputeMatchesForListing(deleted[0]);
  return c.body(null, 204);
});

listingRoutes.get('/my/listings', async (c) => {
  const user = requireUser(c);
  const rows = await db
    .select()
    .from(listings)
    .where(and(eq(listings.userId, user.id), isNull(listings.deletedAt)))
    .orderBy(desc(listings.createdAt))
    .limit(100);
  const myVersion = user.avatarUpdatedAt?.getTime() ?? null;
  return c.json({ listings: rows.map((r) => toListingDto(r, user.id, myVersion)) });
});

listingRoutes.post(
  '/listings/:id/flag',
  zValidator('json', flagSchema, (result, c) => {
    if (!result.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    const id = c.req.param('id');
    const user = await ensureUser(c);
    if (!isUuid(id)) throw new HTTPException(404, { message: 'not_found' });
    if (!allow(`flag:${user.id}`, rateLimit('listingFlagsPerHour'), 3600_000)) throw new HTTPException(429, { message: 'rate_limited' });

    const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    const row = rows[0];
    if (!row || row.deletedAt) throw new HTTPException(404, { message: 'not_found' });

    const body = c.req.valid('json');
    await db
      .insert(flags)
      .values({ listingId: id, flaggerId: user.id, reason: body.reason ?? null })
      .onConflictDoNothing();

    const flagCountRows = await db.select({ n: count() }).from(flags).where(eq(flags.listingId, id));
    if (flagCountRows[0]!.n >= 3 && row.hiddenAt === null) {
      await db.update(listings).set({ hiddenAt: new Date() }).where(eq(listings.id, id));
    }
    return c.json({ ok: true });
  },
);
