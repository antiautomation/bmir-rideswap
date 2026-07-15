import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

// Compiled output lives at server/dist/db/migrate.js, so two levels up is server/, then into drizzle/.
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle');

const ADVISORY_LOCK_KEY = 727001;

export async function runMigrations(pool: Pool): Promise<void> {
  const lockClient = await pool.connect();
  try {
    await lockClient.query(`SELECT pg_advisory_lock(${ADVISORY_LOCK_KEY})`);

    await lockClient.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const { rows } = await lockClient.query<{ name: string }>('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.name));

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }

      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');

      try {
        await lockClient.query('BEGIN');
        await lockClient.query(sql);
        await lockClient.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await lockClient.query('COMMIT');
        console.log(`applied migration: ${file}`);
      } catch (err) {
        await lockClient.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await lockClient.query(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`);
    lockClient.release();
  }
}
