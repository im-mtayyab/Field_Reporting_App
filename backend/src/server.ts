import { createApp } from './app.js';
import { env, isStorageConfigured } from './config/env.js';

async function main() {
  const app = createApp();

  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
    console.log(`Database: ${env.dbUrl ? 'configured' : 'not configured'}`);
    console.log(
      `Storage: ${isStorageConfigured() ? env.storageBucket : 'not configured'}`,
    );
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
