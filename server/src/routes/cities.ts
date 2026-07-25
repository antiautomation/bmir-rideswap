import { Hono } from 'hono';
import { searchCities } from '../lib/cities.js';

export const cityRoutes = new Hono();

// Public typeahead: tiny indexed query, cache-friendly, no auth needed.
cityRoutes.get('/cities', async (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return c.json({ cities: [] });
  const results = await searchCities(q);
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ cities: results });
});
