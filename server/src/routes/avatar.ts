import { and, eq, inArray, or } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireUser } from '../auth/middleware.js';
import { db } from '../db/client.js';
import { conversations, listings, messages, users } from '../db/schema.js';
import { MAX_UPLOAD_BYTES, processAvatar } from '../lib/avatar.js';
import { allow, clientIp } from '../lib/rateLimit.js';
import { rateLimit } from '../lib/settings.js';

type UserRow = typeof users.$inferSelect;

/** You see someone's full-size photo once THEY have sent you at least one
 *  message in a shared conversation. So: message recipients see the sender at
 *  full size immediately; the sender sees the recipient only after a reply. */
async function ownerHasMessagedViewer(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const shared = await db
    .select({ id: conversations.id })
    .from(conversations)
    .innerJoin(listings, eq(conversations.listingId, listings.id))
    .where(
      or(
        and(eq(conversations.initiatorUserId, viewerId), eq(listings.userId, ownerId)),
        and(eq(conversations.initiatorUserId, ownerId), eq(listings.userId, viewerId)),
      ),
    );
  if (shared.length === 0) return false;
  const sent = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        inArray(messages.conversationId, shared.map((c) => c.id)),
        eq(messages.senderUserId, ownerId),
      ),
    )
    .limit(1);
  return sent.length > 0;
}

function imageResponse(c: Context, data: Buffer, cacheControl: string) {
  c.header('Content-Type', 'image/webp');
  c.header('Cache-Control', cacheControl);
  return c.body(new Uint8Array(data));
}

async function ownerOfListing(listingId: string): Promise<UserRow | null> {
  const rows = await db
    .select({ owner: users })
    .from(listings)
    .innerJoin(users, eq(listings.userId, users.id))
    .where(and(eq(listings.id, listingId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return row.owner;
}

async function counterpartOfConversation(conversationId: string, viewerId: string): Promise<UserRow | null> {
  const rows = await db
    .select({ conv: conversations, listingOwnerId: listings.userId })
    .from(conversations)
    .innerJoin(listings, eq(conversations.listingId, listings.id))
    .where(eq(conversations.id, conversationId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const { conv, listingOwnerId } = row;
  if (conv.initiatorUserId !== viewerId && listingOwnerId !== viewerId) {
    throw new HTTPException(403, { message: 'forbidden' });
  }
  const counterpartId = conv.initiatorUserId === viewerId ? listingOwnerId : conv.initiatorUserId;
  const u = await db.select().from(users).where(eq(users.id, counterpartId)).limit(1);
  return u[0] ?? null;
}

export const avatarRoutes = new Hono();

avatarRoutes.post('/me/avatar', async (c) => {
  const user = requireUser(c);
  if (!allow(`avatar:${clientIp(c)}`, rateLimit('avatarUploadsPerHour'), 3600_000)) {
    throw new HTTPException(429, { message: 'rate_limited' });
  }

  const contentLength = Number(c.req.header('content-length') ?? '0');
  if (contentLength > MAX_UPLOAD_BYTES + 4096) {
    throw new HTTPException(413, { message: 'too_large' });
  }

  /* Preferred path: raw image bytes as the request body. Multipart is kept for
     compatibility but Safari mangles FormData bodies on service-worker-controlled
     pages (boundary mismatch → undici parse crash), so the web client no longer
     sends it. sharp identifies the format from magic bytes; the declared
     content-type is irrelevant. */
  const contentType = c.req.header('content-type') ?? '';
  let input: Buffer;
  if (contentType.startsWith('multipart/form-data')) {
    let body: Record<string, unknown>;
    try {
      body = await c.req.parseBody();
    } catch {
      throw new HTTPException(400, { message: 'bad_form_data' });
    }
    const file = body['avatar'];
    if (!(file instanceof File)) throw new HTTPException(400, { message: 'invalid' });
    if (file.size > MAX_UPLOAD_BYTES) throw new HTTPException(413, { message: 'too_large' });
    input = Buffer.from(await file.arrayBuffer());
  } else {
    const raw = await c.req.arrayBuffer();
    if (raw.byteLength === 0) throw new HTTPException(400, { message: 'invalid' });
    if (raw.byteLength > MAX_UPLOAD_BYTES) throw new HTTPException(413, { message: 'too_large' });
    input = Buffer.from(raw);
  }

  let processed: { full: Buffer; thumb: Buffer };
  try {
    processed = await processAvatar(input);
  } catch {
    throw new HTTPException(400, { message: 'invalid_image' });
  }

  const now = new Date();
  await db
    .update(users)
    .set({ avatarFull: processed.full, avatarThumb: processed.thumb, avatarUpdatedAt: now })
    .where(eq(users.id, user.id));
  return c.json({ ok: true, avatarVersion: now.getTime() });
});

avatarRoutes.delete('/me/avatar', async (c) => {
  const user = requireUser(c);
  await db
    .update(users)
    .set({ avatarFull: null, avatarThumb: null, avatarUpdatedAt: null })
    .where(eq(users.id, user.id));
  return c.json({ ok: true });
});

/* Own-photo preview for the You page. Only ever your own session's photo —
   the listing/conversation keying that guards everyone else's stays intact. */
avatarRoutes.get('/me/avatar-thumb', async (c) => {
  const user = requireUser(c);
  if (!user.avatarThumb) throw new HTTPException(404, { message: 'not_found' });
  return imageResponse(c, user.avatarThumb, 'private, max-age=300');
});

avatarRoutes.get('/me/avatar-full', async (c) => {
  const user = requireUser(c);
  if (!user.avatarFull) throw new HTTPException(404, { message: 'not_found' });
  return imageResponse(c, user.avatarFull, 'private, max-age=300');
});

// Thumbs on public listing cards: genuinely low-res, safe to cache.
avatarRoutes.get('/listings/:id/avatar-thumb', async (c) => {
  const owner = await ownerOfListing(c.req.param('id'));
  if (!owner?.avatarThumb) throw new HTTPException(404, { message: 'not_found' });
  return imageResponse(c, owner.avatarThumb, 'public, max-age=86400, immutable');
});

// Full size on a listing: only after a mutual exchange with its owner.
avatarRoutes.get('/listings/:id/avatar', async (c) => {
  const viewer = requireUser(c);
  const owner = await ownerOfListing(c.req.param('id'));
  if (!owner?.avatarFull) throw new HTTPException(404, { message: 'not_found' });
  if (!viewer.isAdmin && !(await ownerHasMessagedViewer(viewer.id, owner.id))) {
    throw new HTTPException(403, { message: 'locked' });
  }
  return imageResponse(c, owner.avatarFull, 'private, max-age=300');
});

avatarRoutes.get('/conversations/:id/avatar-thumb', async (c) => {
  const viewer = requireUser(c);
  const counterpart = await counterpartOfConversation(c.req.param('id'), viewer.id);
  if (!counterpart?.avatarThumb) throw new HTTPException(404, { message: 'not_found' });
  return imageResponse(c, counterpart.avatarThumb, 'private, max-age=86400');
});

avatarRoutes.get('/conversations/:id/avatar', async (c) => {
  const viewer = requireUser(c);
  const counterpart = await counterpartOfConversation(c.req.param('id'), viewer.id);
  if (!counterpart?.avatarFull) throw new HTTPException(404, { message: 'not_found' });
  if (!viewer.isAdmin && !(await ownerHasMessagedViewer(viewer.id, counterpart.id))) {
    throw new HTTPException(403, { message: 'locked' });
  }
  return imageResponse(c, counterpart.avatarFull, 'private, max-age=300');
});
