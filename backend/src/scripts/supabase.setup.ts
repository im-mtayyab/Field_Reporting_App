import fs from 'node:fs';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { closePool, getPool } from '../config/db.js';
import {
  ROOT_DIR,
  env,
  getSupabaseConfig,
  isStorageConfigured,
} from '../config/env.js';
import { runMigrations } from './migrations.run.js';

const TEMPLATE_PATH = path.join(ROOT_DIR, 'supabase', 'storage_policies.sql');

function renderPoliciesSql(bucket: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(bucket)) {
    throw new Error(`Unsafe bucket name "${bucket}"`);
  }
  return fs.readFileSync(TEMPLATE_PATH, 'utf8').replaceAll('{{BUCKET}}', bucket);
}

function jwtRole(token: string): string | undefined {
  try {
    const payload = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!payload) {
      return undefined;
    }
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return (JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      role?: string;
    }).role;
  } catch {
    return undefined;
  }
}

async function ensureBucket(bucket: string) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Could not list buckets: ${listError.message}`);
  }

  if (buckets?.some((item) => item.name === bucket)) {
    console.log(`Bucket exists: ${bucket}`);
    return;
  }

  const { error } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ],
  });

  if (error) {
    console.warn(`API createBucket skipped: ${error.message}`);
    return;
  }

  console.log(`Created private bucket: ${bucket}`);
}

async function main() {
  if (!isStorageConfigured() || !env.dbUrl) {
    console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_DB_URL');
    process.exit(1);
  }

  const { bucket, serviceRoleKey } = getSupabaseConfig();
  const role = jwtRole(serviceRoleKey);

  console.log(`Supabase setup for bucket "${bucket}"`);
  if (role && role !== 'service_role') {
    console.warn(`Key role is "${role}" (want service_role)`);
  }

  await ensureBucket(bucket);

  const db = await getPool();
  await db.query(renderPoliciesSql(bucket));
  console.log(`Storage policies applied via ${new URL(env.dbUrl).hostname}`);

  const migrations = await runMigrations();
  console.log(
    migrations.applied.length > 0
      ? `Table migrations applied: ${migrations.applied.join(', ')}`
      : 'Table migrations: already up to date',
  );

  await closePool();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  console.log(
    'Fallback: run supabase/storage_policies.sql and supabase/migrations/*.sql in the SQL Editor.',
  );
  await closePool();
  process.exit(1);
});
