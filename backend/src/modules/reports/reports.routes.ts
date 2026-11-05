import { Router } from 'express';

import * as reportsController from './reports.controller.js';

export const reportsRoutes = Router();

reportsRoutes.get('/', reportsController.list);
reportsRoutes.get('/:reportId', reportsController.getById);
reportsRoutes.post('/', reportsController.create);

reportsRoutes.post(
  '/:reportId/attachments/:attachmentId/upload-session',
  reportsController.createUploadSession,
);
reportsRoutes.post(
  '/:reportId/attachments/:attachmentId/complete',
  reportsController.completeAttachment,
);
reportsRoutes.post(
  '/:reportId/attachments/:attachmentId/fail',
  reportsController.failAttachment,
);
reportsRoutes.get(
  '/:reportId/attachments/:attachmentId/status',
  reportsController.attachmentStatus,
);

reportsRoutes.delete('/', reportsController.resetAll);
reportsRoutes.delete('/:reportId', reportsController.deleteById);
