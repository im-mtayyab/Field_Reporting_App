import { createClient } from '@supabase/supabase-js';

import {
  env,
  getSupabaseConfig,
  isStorageConfigured,
} from '../../config/env.js';
import type { UploadSession } from './reports.model.js';

const SIGNED_URL_TTL_SEC = 60 * 60;

function getUploadEndpoint(): string {
  if (env.tusEndpoint) {
    return env.tusEndpoint.replace(/\/$/, '');
  }

  const { url } = getSupabaseConfig();
  const match = url.match(/^https:\/\/([^.]+)\.supabase\.co\/?$/i);
  if (match) {
    return `https://${match[1]}.storage.supabase.co/storage/v1/upload/resumable`;
  }

  return `${url.replace(/\/$/, '')}/storage/v1/upload/resumable`;
}

export async function createUploadSession(input: {
  objectPath: string;
  contentType: string;
  sizeBytes: number;
}): Promise<UploadSession> {
  const { bucket, serviceRoleKey } = getSupabaseConfig();
  const key = env.supabaseAnonKey ?? serviceRoleKey;

  return {
    bucket,
    objectPath: input.objectPath,
    uploadEndpoint: getUploadEndpoint(),
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    accessToken: key,
    apikey: key,
    resumable: true,
  };
}

export async function createSignedDownloadUrls(
  objectPaths: string[],
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const unique = [...new Set(objectPaths.filter(Boolean))];
  if (unique.length === 0 || !isStorageConfigured()) {
    return urls;
  }

  const { url, serviceRoleKey, bucket } = getSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(unique, SIGNED_URL_TTL_SEC);

  if (error || !data) {
    return urls;
  }

  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) {
      urls.set(item.path, item.signedUrl);
    }
  }

  return urls;
}
