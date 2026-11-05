import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { closePool, getPool } from '../config/db.js';
import { ROOT_DIR, env } from '../config/env.js';

const MIGRATIONS_DIR = path.join(ROOT_DIR, 'supabase', 'migrations');

async function ensureMigrationsTable() {
  const db = await getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS public._migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

function listMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function appliedIds(): Promise<Set<string>> {
  const db = await getPool();
  const result = await db.query<{ id: string }>(
    'SELECT id FROM public._migrations ORDER BY id ASC',
  );
  return new Set(result.rows.map((row) => row.id));
}

export async function runMigrations(): Promise<{
  applied: string[];
  skipped: string[];
  host: string;
}> {
  if (!env.dbUrl) {
    throw new Error(
      'SUPABASE_DB_URL is required. Add it to .env then run npm run migrate.',
    );
  }

  const host = new URL(env.dbUrl).hostname;
  await ensureMigrationsTable();

  const files = listMigrationFiles();
  const done = await appliedIds();
  const applied: string[] = [];
  const skipped: string[] = [];
  const db = await getPool();

  for (const file of files) {
    const id = file.replace(/\.sql$/i, '');
    if (done.has(id)) {
      skipped.push(id);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO public._migrations (id, applied_at) VALUES ($1, NOW())',
        [id],
      );
      await client.query('COMMIT');
      applied.push(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return { applied, skipped, host };
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  runMigrations()
    .then(async (result) => {
      console.log(`Database host: ${result.host}`);
      if (result.applied.length === 0) {
        console.log('Migrations: already up to date');
      } else {
        console.log(`Migrations applied: ${result.applied.join(', ')}`);
      }
      if (result.skipped.length > 0) {
        console.log(`Skipped: ${result.skipped.join(', ')}`);
      }
      await closePool();
    })
    .catch(async (error) => {
      console.error(error instanceof Error ? error.message : error);
      await closePool();
      process.exit(1);
    });
}
