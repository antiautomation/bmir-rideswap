import { Hono } from 'hono';
import { mintMagicToken, resolveMagicToken, sanitizeNextPath } from '../auth/magic.js';
import { issueSessionCookie } from '../auth/tokens.js';
import { requireAdmin } from '../auth/middleware.js';
import { allow, clientIp } from '../lib/rateLimit.js';

export const magicRoutes = new Hono();

// Magic-link exchange. Deliberately side-effect-free beyond issuing a session
// cookie: email prefetchers hitting this URL cause no state changes.
magicRoutes.get('/a/:token', async (c) => {
  if (!allow(`magic:${clientIp(c)}`, 30, 3600_000)) {
    return c.redirect('/?link=expired', 302);
  }
  const user = await resolveMagicToken(c.req.param('token'));
  const next = sanitizeNextPath(c.req.query('next'));
  if (!user || user.bannedAt) {
    return c.redirect('/?link=expired', 302);
  }
  await issueSessionCookie(c, user.id);
  return c.redirect(next, 302);
});

// Admin/testing helper: mint a magic link for the CURRENT session (lets us
// verify the exchange flow end-to-end without waiting for a digest email).
magicRoutes.post('/api/dev/magic-link', async (c) => {
  const user = requireAdmin(c);
  const token = await mintMagicToken(user.id);
  return c.json({ path: `/a/${token}` });
});
