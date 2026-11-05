import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';

import { DEFAULT_BUCKET } from '../common/constants/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '../..');

loadEnv({ path: path.join(ROOT_DIR, '.env') });

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  supabaseUrl: optional('SUPABASE_URL'),
  supabaseServiceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY'),
  supabaseAnonKey: optional('SUPABASE_ANON_KEY'),
  dbUrl: optional('SUPABASE_DB_URL'),
  storageBucket: optional('SUPABASE_STORAGE_BUCKET') ?? DEFAULT_BUCKET,
  tusEndpoint: optional('SUPABASE_TUS_ENDPOINT'),
};

export function isStorageConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export function getSupabaseConfig() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  return {
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey,
    bucket: env.storageBucket,
  };
}
