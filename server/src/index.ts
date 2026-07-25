import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { sessionMiddleware } from './auth/middleware.js';
import { pool } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { startJobs } from './jobs/index.js';
import { clientIp } from './lib/rateLimit.js';
import { recordVisit, startGeoWorker } from './lib/visits.js';
import { ensureCitiesLoaded } from './lib/cities.js';
import { cityRoutes } from './routes/cities.js';
import { conversationRoutes } from './routes/conversations.js';
import { listingRoutes } from './routes/listings.js';
import { adminRoutes, webhookRoutes } from './routes/admin.js';
import { adminOutreachRoutes } from './routes/adminOutreach.js';
import { avatarRoutes } from './routes/avatar.js';
import { magicRoutes } from './routes/magic.js';
import { matchRoutes } from './routes/matches.js';
import { sessionRoutes } from './routes/session.js';
import { unsubscribeRoutes } from './routes/unsubscribe.js';

const WEB_DIST_ROOT = './web/dist';
const WEB_INDEX_HTML = `${WEB_DIST_ROOT}/index.html`;
const PLACEHOLDER_HTML = '<!doctype html><html><body>RideFinder v2 — frontend not built</body></html>';

async function loadIndexHtml(): Promise<string> {
  if (!existsSync(WEB_INDEX_HTML)) {
    return PLACEHOLDER_HTML;
  }
  return readFile(WEB_INDEX_HTML, 'utf8');
}

async function main(): Promise<void> {
  try {
    await runMigrations(pool);
  } catch (err) {
    console.error('migration failed', err);
    process.exit(1);
  }

  try {
    await ensureCitiesLoaded();
  } catch (err) {
    // Typeahead/corridor matching degrade gracefully without cities; don't block boot.
    console.error('city load failed', err);
  }

  const indexHtml = await loadIndexHtml();

  const app = new Hono();

  app.get('/healthz', (c) => c.json({ ok: true, version: 2 }));

  // Pageview capture: SPA document GETs only (not API, assets, magic links, or
  // health checks). Fire-and-forget; never blocks or fails the request.
  app.use('*', async (c, next) => {
    if (c.req.method === 'GET') {
      const path = c.req.path;
      const isDoc =
        !path.startsWith('/api') &&
        !path.startsWith('/a/') &&
        !path.startsWith('/u/') &&
        !path.startsWith('/assets') &&
        path !== '/healthz' &&
        !path.includes('.') &&
        (c.req.header('accept') ?? '').includes('text/html');
      if (isDoc) {
        let ownHost: string | null = null;
        try {
          ownHost = new URL(c.req.url).hostname.toLowerCase();
        } catch {
          /* leave null */
        }
        recordVisit({
          ip: clientIp(c),
          path,
          referrer: c.req.header('referer') ?? null,
          hadSession: (c.req.header('cookie') ?? '').includes('rs_session='),
          ownHost,
        }).catch(() => {});
      }
    }
    await next();
  });

  app.use('/api/*', sessionMiddleware);
  app.route('/api', cityRoutes);
  app.route('/api', sessionRoutes);
  app.route('/api', listingRoutes);
  app.route('/api', conversationRoutes);
  app.route('/api', matchRoutes);
  app.route('/api', avatarRoutes);
  app.route('/api', adminRoutes);
  app.route('/api', adminOutreachRoutes);
  app.route('/api', webhookRoutes);
  app.route('', magicRoutes);
  app.route('', unsubscribeRoutes);

  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

  app.use('*', serveStatic({ root: WEB_DIST_ROOT }));

  app.get('*', (c) => c.html(indexHtml));

  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: 'internal' }, 500);
  });

  const port = Number(process.env.PORT ?? 3000);

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`listening on port ${info.port}`);
  });

  startJobs();
  startGeoWorker();
}

main();
