import { Router } from 'express';

import {
  getAiHealth,
  getDatabaseHealth,
  getLiveness,
  getReadiness,
} from '../controllers/health.controller';

export const healthRouter = Router();

healthRouter.get('/live', getLiveness);
healthRouter.get('/ready', getReadiness);
healthRouter.get('/db', getDatabaseHealth);
healthRouter.get('/ai', getAiHealth);
