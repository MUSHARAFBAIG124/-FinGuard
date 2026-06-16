import { Router } from 'express';
import { createModelController } from '../controllers/model.controller';
import type { ModelDependencies } from '../services/model.dependencies';

export const createModelRouter = (deps: ModelDependencies) => {
  const router = Router();
  const controller = createModelController({ modelMetricsService: deps.modelMetricsService });

  router.get('/metrics', controller.getMetrics);
  router.get('/info', controller.getInfo);

  return router;
};
