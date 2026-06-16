import { UserRole } from '@finguard/shared';
import type { Router } from 'express';
import { ModelAnalyticsController } from '../controllers/model-analytics.controller';
import { GovernanceAnalyticsService } from '../services/governance-analytics.service';
import { requireJwt } from '../middleware/jwt.middleware';
import { requireRole } from '../middleware/rbac.middleware';

export function registerModelAnalyticsRoutes(
  router: Router,
  analyticsService: GovernanceAnalyticsService,
): Router {
  const controller = new ModelAnalyticsController(analyticsService);

  router.get(
    '/api/v1/models/analytics/summary',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    (req, res) => controller.getSummary(req, res),
  );

  router.get(
    '/api/v1/models/analytics/models',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    (req, res) => controller.getModelStats(req, res),
  );

  router.get(
    '/api/v1/models/analytics/drift',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    (req, res) => controller.getDriftStats(req, res),
  );

  router.get(
    '/api/v1/models/analytics/health',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    (req, res) => controller.getHealthScore(req, res),
  );

  return router;
}
