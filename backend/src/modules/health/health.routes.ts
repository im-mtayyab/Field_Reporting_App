import { Router } from 'express';

import * as healthController from './health.controller.js';

export const healthRoutes = Router();

healthRoutes.get('/', healthController.check);
