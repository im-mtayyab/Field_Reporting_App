import cors from 'cors';
import express, { type Express } from 'express';

import { errorHandler } from '../common/middleware/errorHandler.js';

export function loadExpress(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(errorHandler);

  return app;
}
