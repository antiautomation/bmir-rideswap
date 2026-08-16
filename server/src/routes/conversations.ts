import { zValidator } from '@hono/zod-validator';
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ensureUser, requireUser } from '../auth/middleware.js';
import type { SessionUser } from '../auth/tokens.js';
import { db } from '../db/client.js';
import { conversations, listings, messagePhotos, messages, users } from '../db/schema.js';
import { isUniqueViolation } from '../lib/pg.js';
import { allow } from '../lib/rateLimit.js';
import { rateLimit } from '../lib/settings.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}


// Messaging is a front door into the app just like posting: a cookie-less visitor
// gets a fresh anonymous account from ensureUser(), and without this guard could
// message anyone with no name and no reachable address. Recipients need to know
// who is writing, and replies have to be emailable back to the sender.
function requireContactComplete(user: SessionUser): void {
  if (!user.name?.trim()) throw new HTTPException(400, { message: 'name_required' });
  if (!user.email) throw new HTTPException(400, { message: 'email_required' });
}

const sendSchema = z
  .object({
    clientId: z.string().uuid(),
    // Empty is allowed only alongside a photo — see the refinement below. The
    // photo is uploaded first and referenced by id, because the offline outbox
    // that carries this body is JSON in localStorage and cannot hold bytes.
    body: z.string().max(2000),
    photoId: z.string().uuid().optional(),
    share: z
      .object({
        email: z.boolean().optional(),
        phone: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((data) => data.body.trim().length > 0 || data.photoId !== undefined, {
    message: 'empty_message',
    path: ['body'],
  });

type ConversationRow = typeof conversations.$inferSelect;
type ListingRow = typeof listings.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

function snapshotShare(
  user: SessionUser,
  share?: { email?: boolean; phone?: boolean },
): { sharedEmail: string | null; sharedPhone: string | null } {
  return {
    sharedEmail: share?.email && user.email ? user.email : null,
    sharedPhone: share?.phone && user.phone ? user.phone : null,
  };
}

/** Dimensions travel with the message so the client can reserve the image's box
 *  before the bytes arrive — the thread auto-scrolls on new messages, and a late
 *  image would otherwise push the conversation out from under the reader. */
interface PhotoMeta {
  id: string;
  width: number;
  height: number;
}

function toMessageDto(row: MessageRow, viewerId: string, photo: PhotoMeta | null = null) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    isMine: row.senderUserId === viewerId,
    body: row.body,
    photoId: row.photoId,
    photoWidth: photo?.width ?? null,
    photoHeight: photo?.height ?? null,
    sharedEmail: row.sharedEmail,
    sharedPhone: row.sharedPhone,
    createdAt: row.createdAt.toISOString(),
  };
}

function toConversationListingDto(row: ListingRow) {
  return {
    id: row.id,
    type: row.type,
    direction: row.direction,
    name: row.name,
    travelDate: row.travelDate,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}

// Returns whether `user` may see/act on this conversation: the initiator, the listing
// owner, or an admin. Callers throw the 403 themselves so the error site is explicit.
function assertParticipant(conversation: ConversationRow, listing: ListingRow, user: SessionUser): boolean {
  return conversation.initiatorUserId === user.id || listing.userId === user.id || user.isAdmin;
}

async function findConversation(listingId: string, initiatorUserId: string): Promise<ConversationRow | undefined> {
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.listingId, listingId), eq(conversations.initiatorUserId, initiatorUserId)))
    .limit(1);
  return rows[0];
}

async function findMessageByClientId(clientId: string): Promise<MessageRow | undefined> {
  const rows = await db.select().from(messages).where(eq(messages.clientId, clientId)).limit(1);
  return rows[0];
}

/** A photo id is a bearer token, so attaching one must prove the uploader is
 *  the sender — that ownership check is the whole gate against a guessed id
 *  being pulled into someone else's conversation. A photo MAY be attached to
 *  more than one message by its owner: that is the "reuse last message" flow,
 *  which re-sends the same stored bytes instead of forcing a re-upload, and it
 *  costs nothing — every serving route resolves the photo through its own
 *  message's participant check, and the orphan sweep only collects photos with
 *  no message at all. */
async function claimPhoto(photoId: string | undefined, senderId: string): Promise<PhotoMeta | null> {
  if (photoId === undefined) return null;
  const rows = await db
    .select({ id: messagePhotos.id, width: messagePhotos.width, height: messagePhotos.height })
    .from(messagePhotos)
    .where(and(eq(messagePhotos.id, photoId), eq(messagePhotos.ownerUserId, senderId)))
    .limit(1);
  const photo = rows[0];
  if (!photo) throw new HTTPException(400, { message: 'invalid_photo' });
  return photo;
}

// Total unread across every conversation the user participates in (as initiator or as
// the owner of the listing being discussed). Used for the /me unread badge.
export async function unreadCountFor(userId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(listings, eq(conversations.listingId, listings.id))
    .where(
      and(
        isNull(messages.readAt),
        ne(messages.senderUserId, userId),
        or(eq(conversations.initiatorUserId, userId), eq(listings.userId, userId)),
      ),
    );
  return rows[0]?.n ?? 0;
}

export const conversationRoutes = new Hono();

// Start (or continue) a conversation about a listing by sending its first message.
conversationRoutes.post(
  '/listings/:id/conversations',
  zValidator('json', sendSchema, (result, c) => {
    if (!result.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    const listingId = c.req.param('id');
    if (!isUuid(listingId)) throw new HTTPException(404, { message: 'not_found' });

    const user = await ensureUser(c);
    requireContactComplete(user);
    const body = c.req.valid('json');

    // Idempotency replay: a message with this clientId already made it in.
    const existingMsg = await findMessageByClientId(body.clientId);
    if (existingMsg) {
      if (existingMsg.senderUserId !== user.id) throw new HTTPException(409, { message: 'conflict' });
      return c.json(
        { conversation: { id: existingMsg.conversationId }, message: toMessageDto(existingMsg, user.id) },
        200,
      );
    }

    const listingRows = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    const listing = listingRows[0];
    if (!listing || listing.deletedAt || listing.hiddenAt) throw new HTTPException(404, { message: 'not_found' });
    if (listing.userId === user.id) throw new HTTPException(400, { message: 'own_listing' });

    if (!allow(`msg:${user.id}`, rateLimit('messagesPerHour'), 3600_000)) throw new HTTPException(429, { message: 'rate_limited' });
    if (!allow(`msgburst:${user.id}`, 1, 5_000)) throw new HTTPException(429, { message: 'slow_down' });

    let conversation = await findConversation(listingId, user.id);

    if (!conversation) {
      const hourAgo = new Date(Date.now() - 3600_000);
      const capRows = await db
        .select({ n: count() })
        .from(conversations)
        .where(and(eq(conversations.initiatorUserId, user.id), gt(conversations.createdAt, hourAgo)));
      if (capRows[0]!.n >= rateLimit('newConversationsPerHour')) throw new HTTPException(429, { message: 'conversation_limit' });

      try {
        const inserted = await db
          .insert(conversations)
          .values({ listingId, initiatorUserId: user.id })
          .onConflictDoNothing()
          .returning();
        conversation = inserted[0];
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
      if (!conversation) {
        conversation = await findConversation(listingId, user.id);
      }
    }
    if (!conversation) throw new HTTPException(500, { message: 'internal' });

    const shareSnap = snapshotShare(user, body.share);
    const photo = await claimPhoto(body.photoId, user.id);
    try {
      const inserted = await db
        .insert(messages)
        .values({
          conversationId: conversation.id,
          senderUserId: user.id,
          body: body.body,
          photoId: photo?.id ?? null,
          sharedEmail: shareSnap.sharedEmail,
          sharedPhone: shareSnap.sharedPhone,
          clientId: body.clientId,
        })
        .returning();
      return c.json(
        { conversation: { id: conversation.id }, message: toMessageDto(inserted[0]!, user.id, photo) },
        201,
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        const replay = await findMessageByClientId(body.clientId);
        if (replay) return c.json({ conversation: { id: conversation.id }, message: toMessageDto(replay, user.id) }, 200);
      }
      throw err;
    }
  },
);

/* The "reuse last message" prefill: people blasting the same intro to many
 * listings were copy/pasting text and re-uploading the same photo every time.
 * This returns the most recent message the caller sent, shaped for rebuilding
 * composer state — body, the photo by reference (with the thumb URL, which is
 * keyed by MESSAGE id, not photo id), and whether contact info was shared
 * (booleans only; the composer re-snapshots the actual values at send). */
conversationRoutes.get('/me/last-sent-message', async (c) => {
  const user = requireUser(c);
  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      photoId: messages.photoId,
      photoWidth: messagePhotos.width,
      photoHeight: messagePhotos.height,
      sharedEmail: messages.sharedEmail,
      sharedPhone: messages.sharedPhone,
    })
    .from(messages)
    .leftJoin(messagePhotos, eq(messages.photoId, messagePhotos.id))
    .where(eq(messages.senderUserId, user.id))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  const m = rows[0];
  if (!m) return c.json({ message: null });
  return c.json({
    message: {
      body: m.body,
      photoId: m.photoId,
      photoWidth: m.photoWidth,
      photoHeight: m.photoHeight,
      photoThumbUrl: m.photoId ? `/api/messages/${m.id}/photo-thumb` : null,
      sharedEmail: m.sharedEmail !== null,
      sharedPhone: m.sharedPhone !== null,
    },
  });
});

conversationRoutes.get('/conversations', async (c) => {
  const user = requireUser(c);

  const rows = await db
    .select({ conversation: conversations, listing: listings })
    .from(conversations)
    .innerJoin(listings, eq(conversations.listingId, listings.id))
    .where(or(eq(conversations.initiatorUserId, user.id), eq(listings.userId, user.id)))
    .orderBy(desc(conversations.createdAt))
    .limit(200);

  if (rows.length === 0) return c.json({ conversations: [] });

  const convIds = rows.map((r) => r.conversation.id);

  // Batch-load every message across these conversations once, newest first, then reduce
  // in memory: first hit per conversation is the last message, and we tally unread as we go.
  const messageRows = await db
    .select({
      conversationId: messages.conversationId,
      body: messages.body,
      photoId: messages.photoId,
      createdAt: messages.createdAt,
      senderUserId: messages.senderUserId,
      readAt: messages.readAt,
    })
    .from(messages)
    .where(inArray(messages.conversationId, convIds))
    .orderBy(desc(messages.createdAt));

  const lastMessageByConv = new Map<
    string,
    { body: string; hasPhoto: boolean; createdAt: Date; isMine: boolean }
  >();
  const unreadByConv = new Map<string, number>();
  for (const m of messageRows) {
    if (!lastMessageByConv.has(m.conversationId)) {
      lastMessageByConv.set(m.conversationId, {
        body: m.body,
        // The inbox shows a preview line; a photo with no caption has no text
        // to preview, so the row says so rather than rendering blank.
        hasPhoto: m.photoId !== null,
        createdAt: m.createdAt,
        isMine: m.senderUserId === user.id,
      });
    }
    if (m.senderUserId !== user.id && m.readAt === null) {
      unreadByConv.set(m.conversationId, (unreadByConv.get(m.conversationId) ?? 0) + 1);
    }
  }

  const counterpartUserIds = rows.map((r) =>
    r.conversation.initiatorUserId === user.id ? r.listing.userId : r.conversation.initiatorUserId,
  );
  const counterpartRows =
    counterpartUserIds.length > 0
      ? await db.select({ id: users.id, name: users.name, avatarAt: users.avatarUpdatedAt }).from(users).where(inArray(users.id, counterpartUserIds))
      : [];
  const counterpartNameById = new Map(counterpartRows.map((u) => [u.id, u.name]));
  const counterpartAvatarById = new Map(counterpartRows.map((u) => [u.id, u.avatarAt?.getTime() ?? null]));

  const summaries = rows
    .map((r) => {
      const iAmInitiator = r.conversation.initiatorUserId === user.id;
      const counterpartUserId = iAmInitiator ? r.listing.userId : r.conversation.initiatorUserId;
      const counterpartName = counterpartNameById.get(counterpartUserId) ?? (iAmInitiator ? r.listing.name : null) ?? 'Burner';
      const last = lastMessageByConv.get(r.conversation.id) ?? null;
      const sortKey = (last?.createdAt ?? r.conversation.createdAt).getTime();
      return {
        sortKey,
        summary: {
          id: r.conversation.id,
          listing: toConversationListingDto(r.listing),
          iAmInitiator,
          counterpartName,
          counterpartAvatarVersion: counterpartAvatarById.get(counterpartUserId) ?? null,
          lastMessage: last
            ? {
                body: last.body,
                hasPhoto: last.hasPhoto,
                createdAt: last.createdAt.toISOString(),
                isMine: last.isMine,
              }
            : null,
          unreadCount: unreadByConv.get(r.conversation.id) ?? 0,
          createdAt: r.conversation.createdAt.toISOString(),
        },
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey)
    .map((x) => x.summary);

  return c.json({ conversations: summaries });
});

conversationRoutes.get('/conversations/:id', async (c) => {
  const id = c.req.param('id');
  if (!isUuid(id)) throw new HTTPException(404, { message: 'not_found' });
  const user = requireUser(c);

  const convRows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  const conversation = convRows[0];
  if (!conversation) throw new HTTPException(404, { message: 'not_found' });

  const listingRows = await db.select().from(listings).where(eq(listings.id, conversation.listingId)).limit(1);
  const listing = listingRows[0];
  if (!listing) throw new HTTPException(404, { message: 'not_found' });

  if (!assertParticipant(conversation, listing, user)) throw new HTTPException(403, { message: 'forbidden' });

  // Reading marks messages read — but only for actual participants. An admin
  // peeking at a thread must not eat the recipient's unread state (or their
  // digest email, which skips already-read messages).
  const isParticipant = conversation.initiatorUserId === user.id || listing.userId === user.id;
  if (isParticipant) {
    await db
      .update(messages)
      .set({ readAt: new Date() })
      .where(and(eq(messages.conversationId, id), ne(messages.senderUserId, user.id), isNull(messages.readAt)));
  }

  // Newest window, oldest-first for display — an .orderBy(asc).limit(500)
  // would pin long threads to their oldest 500 and hide every new message.
  // Left-joined for the photo's dimensions only — never its bytes, which would
  // put megabytes of bytea through every thread poll.
  const messageRows = (
    await db
      .select({
        message: messages,
        photoWidth: messagePhotos.width,
        photoHeight: messagePhotos.height,
      })
      .from(messages)
      .leftJoin(messagePhotos, eq(messages.photoId, messagePhotos.id))
      .where(eq(messages.conversationId, id))
      .orderBy(desc(messages.createdAt))
      .limit(500)
  ).reverse();

  const iAmInitiator = conversation.initiatorUserId === user.id;
  const counterpartUserId = iAmInitiator ? listing.userId : conversation.initiatorUserId;
  const counterpartRows = await db
    .select({ id: users.id, name: users.name, avatarAt: users.avatarUpdatedAt, phonePref: users.phoneContactPref })
    .from(users)
    .where(eq(users.id, counterpartUserId))
    .limit(1);
  const counterpartName = counterpartRows[0]?.name ?? (iAmInitiator ? listing.name : null) ?? 'Burner';
  const counterpartAvatarVersion = counterpartRows[0]?.avatarAt?.getTime() ?? null;
  const counterpartPhonePref = counterpartRows[0]?.phonePref === 'whatsapp' ? 'whatsapp' : 'sms';

  return c.json({
    conversation: { id: conversation.id },
    listing: toConversationListingDto(listing),
    counterpartName,
    counterpartAvatarVersion,
    counterpartPhonePref,
    messages: messageRows.map((r) =>
      toMessageDto(
        r.message,
        user.id,
        r.message.photoId !== null && r.photoWidth !== null && r.photoHeight !== null
          ? { id: r.message.photoId, width: r.photoWidth, height: r.photoHeight }
          : null,
      ),
    ),
  });
});

conversationRoutes.post(
  '/conversations/:id/messages',
  zValidator('json', sendSchema, (result, c) => {
    if (!result.success) return c.json({ error: 'invalid' }, 400);
  }),
  async (c) => {
    const id = c.req.param('id');
    if (!isUuid(id)) throw new HTTPException(404, { message: 'not_found' });
    const user = requireUser(c);
    // Legacy anonymous accounts predate the guard above — they must complete
    // their profile before sending anything further.
    requireContactComplete(user);
    const body = c.req.valid('json');

    const convRows = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    const conversation = convRows[0];
    if (!conversation) throw new HTTPException(404, { message: 'not_found' });

    const listingRows = await db.select().from(listings).where(eq(listings.id, conversation.listingId)).limit(1);
    const listing = listingRows[0];
    if (!listing) throw new HTTPException(404, { message: 'not_found' });

    if (!assertParticipant(conversation, listing, user)) throw new HTTPException(403, { message: 'forbidden' });

    // Idempotency replay.
    const existing = await findMessageByClientId(body.clientId);
    if (existing) {
      if (existing.conversationId !== conversation.id || existing.senderUserId !== user.id) {
        throw new HTTPException(409, { message: 'conflict' });
      }
      return c.json({ message: toMessageDto(existing, user.id) }, 200);
    }

    if (!allow(`msg:${user.id}`, rateLimit('messagesPerHour'), 3600_000)) throw new HTTPException(429, { message: 'rate_limited' });
    if (!allow(`msgburst:${user.id}`, 1, 5_000)) throw new HTTPException(429, { message: 'slow_down' });

    const shareSnap = snapshotShare(user, body.share);
    const photo = await claimPhoto(body.photoId, user.id);
    try {
      const inserted = await db
        .insert(messages)
        .values({
          conversationId: conversation.id,
          senderUserId: user.id,
          body: body.body,
          photoId: photo?.id ?? null,
          sharedEmail: shareSnap.sharedEmail,
          sharedPhone: shareSnap.sharedPhone,
          clientId: body.clientId,
        })
        .returning();
      return c.json({ message: toMessageDto(inserted[0]!, user.id, photo) }, 201);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const replay = await findMessageByClientId(body.clientId);
        if (replay) return c.json({ message: toMessageDto(replay, user.id) }, 200);
      }
      throw err;
    }
  },
);
