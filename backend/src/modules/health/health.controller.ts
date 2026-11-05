import type { Request, Response } from 'express';

import { env, isStorageConfigured } from '../../config/env.js';

export function check(_req: Request, res: Response) {
  res.json({
    ok: true,
    databaseConfigured: Boolean(env.dbUrl),
    storageConfigured: isStorageConfigured(),
    bucket: env.storageBucket,
  });
}
