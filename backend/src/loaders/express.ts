import cors from 'cors';
import express, { type Express } from 'express';

import { errorHandler } from '../common/middleware/errorHandler.js';
import { simulateFailures } from '../common/middleware/simulate.js';
import { healthRoutes } from '../modules/health/health.routes.js';
import { reportsRoutes } from '../modules/reports/reports.routes.js';

export function loadExpress(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRoutes);
  app.use('/api/reports', simulateFailures, reportsRoutes);
  app.use('/reports', simulateFailures, reportsRoutes);

  app.use(errorHandler);

  return app;
}
