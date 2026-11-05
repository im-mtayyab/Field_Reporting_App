import pg from 'pg';

import { env } from './env.js';

let pool: pg.Pool | null = null;

export async function getPool(): Promise<pg.Pool> {
  if (pool) {
    return pool;
  }

  if (!env.dbUrl) {
    throw new Error('Missing SUPABASE_DB_URL in .env');
  }

  pool = new pg.Pool({
    connectionString: env.dbUrl,
    ssl: { rejectUnauthorized: false },
    max: process.env.VERCEL ? 1 : 10,
    idleTimeoutMillis: process.env.VERCEL ? 5000 : 30000,
    connectionTimeoutMillis: 10_000,
  });

  return pool;
}

export async function closePool() {
  if (!pool) {
    return;
  }
  await pool.end();
  pool = null;
}

export async function withTransaction<T>(
  work: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await (await getPool()).connect();

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
