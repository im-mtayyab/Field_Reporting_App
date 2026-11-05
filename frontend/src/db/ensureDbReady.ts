import { migrateDb } from './migrate';

let ready: Promise<void> | null = null;

/**
 * Single-flight migrate. Call before any upload-queue read/write.
 * Keeps first paint free — App should not await this.
 */
export function ensureDbReady(): Promise<void> {
  if (!ready) {
    ready = migrateDb().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
