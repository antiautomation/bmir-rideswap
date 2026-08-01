// Photo attachments for messages. Deliberately modelled on routes/avatar.ts:
// same raw-bytes upload, same three-layer size guard, same bytea storage. The
// two places it diverges are called out below.

import { and, eq, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ensureUser, requireUser } from '../auth/middleware.js';
import { db } from '../db/client.js';
import { conversations, listings, messagePhotos, messages } from '../db/schema.js';
import { MAX_UPLOAD_BYTES, processMessagePhoto } from '../lib/avatar.js';
import { allow, clientIp } from '../lib/rateLimit.js';
import { rateLimit } from '../lib/settings.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A sent photo never changes, and its URL is keyed by the message id, so it can
 *  be cached hard. Private because the participant check below is the only thing
 *  standing between it and the rest of the internet — shared caches must not
 *  keep a copy. */
const IMMUTABLE = 'private, max-age=31536000, immutable';

function imageResponse(c: Context, data: Buffer) {
  c.header('Content-Type', 'image/webp');
  c.header('Cache-Control', IMMUTABLE);
  return c.body(new Uint8Array(data));
}

/** Unlike avatars, there is no "unlock once they've written to you" gate here.
 *  Inside a conversation both people are already participants, and a photo is
 *  sent deliberately to the person on the other end — making them wait for a
 *  reply to see what was just sent them would be nonsense. Reuses the same
 *  initiator-or-listing-owner rule the rest of messaging enforces. */
async function photoForViewer(
  messageId: string,
  viewerId: string,
  isAdmin: boolean,
): Promise<typeof messagePhotos.$inferSelect> {
  if (!UUID_RE.test(messageId)) throw new HTTPException(404, { message: 'not_found' });

  const rows = await db
    .select({ photo: messagePhotos, conversation: conversations, listing: listings })
    .from(messages)
    .innerJoin(messagePhotos, eq(messages.photoId, messagePhotos.id))
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(listings, eq(conversations.listingId, listings.id))
    .where(eq(messages.id, messageId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new HTTPException(404, { message: 'not_found' });

  const participant =
    row.conversation.initiatorUserId === viewerId || row.listing.userId === viewerId || isAdmin;
  if (!participant) throw new HTTPException(403, { message: 'forbidden' });

  return row.photo;
}

export const messagePhotoRoutes = new Hono();

/* Raw image bytes as the request body — NOT FormData. Safari corrupts multipart
   bodies sent from a service-worker-controlled page, which this app is (see the
   same note in routes/avatar.ts). sharp reads the real format from magic bytes,
   so the declared content-type is only a hint. */
messagePhotoRoutes.post('/messages/photo', async (c) => {
  // ensureUser, not requireUser: a first-time visitor can open the composer on a
  // listing and attach a photo before they have any session, exactly as they can
  // start typing — the send route mints the account either way. Gating the upload
  // on an existing session 401s them mid-compose for no reason. The name/email
  // requirement still bites at send time, which is where it belongs.
  const user = await ensureUser(c);
  if (!allow(`msgphoto:${clientIp(c)}`, rateLimit('messagePhotosPerHour'), 3600_000)) {
    throw new HTTPException(429, { message: 'rate_limited' });
  }

  const contentLength = Number(c.req.header('content-length') ?? '0');
  if (contentLength > MAX_UPLOAD_BYTES + 4096) throw new HTTPException(413, { message: 'too_large' });

  const raw = await c.req.arrayBuffer();
  if (raw.byteLength === 0) throw new HTTPException(400, { message: 'invalid' });
  if (raw.byteLength > MAX_UPLOAD_BYTES) throw new HTTPException(413, { message: 'too_large' });

  let processed: Awaited<ReturnType<typeof processMessagePhoto>>;
  try {
    processed = await processMessagePhoto(Buffer.from(raw));
  } catch {
    throw new HTTPException(400, { message: 'invalid_image' });
  }

  const inserted = await db
    .insert(messagePhotos)
    .values({
      ownerUserId: user.id,
      full: processed.full,
      thumb: processed.thumb,
      width: processed.width,
      height: processed.height,
    })
    .returning({ id: messagePhotos.id });

  // The photo is stored but attached to nothing yet; the send that follows binds
  // it. If that send never happens, the nightly sweep collects it.
  return c.json(
    { photoId: inserted[0]!.id, width: processed.width, height: processed.height },
    201,
  );
});

messagePhotoRoutes.get('/messages/:id/photo-thumb', async (c) => {
  const user = requireUser(c);
  const photo = await photoForViewer(c.req.param('id'), user.id, user.isAdmin);
  return imageResponse(c, photo.thumb);
});

messagePhotoRoutes.get('/messages/:id/photo', async (c) => {
  const user = requireUser(c);
  const photo = await photoForViewer(c.req.param('id'), user.id, user.isAdmin);
  return imageResponse(c, photo.full);
});

/** Photos uploaded but never sent — someone picked an image and then closed the
 *  tab. Nothing will ever reference these, and unlike a stray row they hold real
 *  bytes, so they get swept. Anything younger than a day is left alone in case a
 *  composer is still sitting open on it. */
export async function sweepOrphanPhotos(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 3600_000);
  const unattached = db
    .select({ one: sql`1` })
    .from(messages)
    .where(eq(messages.photoId, messagePhotos.id));

  await db
    .delete(messagePhotos)
    .where(and(lt(messagePhotos.createdAt, cutoff), sql`NOT EXISTS ${unattached}`));
}
