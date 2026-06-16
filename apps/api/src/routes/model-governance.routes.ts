import type { Router } from 'express';
import type { ModelGovernanceService } from '../services/model-governance.service';
import type { DriftDetectionService } from '../services/drift-detection.service';
import type { GovernanceAnalyticsService } from '../services/governance-analytics.service';
import { ModelGovernanceController } from '../controllers/model-governance.controller';
import { UserRole } from '@finguard/shared';
import { requireJwt } from '../middleware/jwt.middleware';
import { requireRole } from '../middleware/rbac.middleware';

export interface ModelGovernanceDependencies {
  governanceService: ModelGovernanceService;
  driftService: DriftDetectionService;
  analyticsService: GovernanceAnalyticsService;
}

export function registerModelGovernanceRoutes(
  router: Router,
  deps: ModelGovernanceDependencies,
): Router {
  const controller = new ModelGovernanceController(
    deps.governanceService,
    deps.driftService,
    deps.analyticsService,
  );

  router.post(
    '/api/v1/models',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    (req, res) => controller.registerModel(req, res),
  );

  router.get(
    '/api/v1/models',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    (req, res) => controller.listModels(req, res),
  );

  router.get(
    '/api/v1/models/:version',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    (req, res) => controller.getModelDetails(req, res),
  );

  router.post(
    '/api/v1/models/:version/approve',
    requireJwt,
    requireRole(UserRole.ADMIN),
    (req, res) => controller.approveModel(req, res),
  );

  router.post(
    '/api/v1/models/:version/reject',
    requireJwt,
    requireRole(UserRole.ADMIN),
    (req, res) => controller.rejectModel(req, res),
  );

  router.post(
    '/api/v1/models/:version/retire',
    requireJwt,
    requireRole(UserRole.ADMIN),
    (req, res) => controller.retireModel(req, res),
  );

  router.post(
    '/api/v1/models/drift/check',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    (req, res) => controller.checkDrift(req, res),
  );

  router.get(
    '/api/v1/models/drift',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    (req, res) => controller.listDriftRecords(req, res),
  );

  router.get(
    '/api/v1/models/drift/critical',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    (req, res) => controller.listCriticalDrift(req, res),
  );

  router.get(
    '/api/v1/models/analytics',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    (req, res) => controller.getAnalytics(req, res),
  );

  return router;
}
