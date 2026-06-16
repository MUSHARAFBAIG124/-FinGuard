import { Router } from 'express';
import { requireJwt } from '../middleware/jwt.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { UserRole } from '@finguard/shared';
import { asyncHandler } from '../utils/async-handler';
import { FraudCaseController } from '../controllers/fraud-case.controller';

export const createFraudCaseRouter = (fraudCaseController: FraudCaseController): Router => {
  const router = Router();

  // All routes require authentication and authorization
  router.use(requireJwt);
  router.use(requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST));

  // Dashboard routes
  router.get(
    '/dashboard',
    asyncHandler(fraudCaseController.getDashboardMetrics.bind(fraudCaseController)),
  );

  router.get(
    '/dashboard/investigators',
    asyncHandler(fraudCaseController.getInvestigatorMetrics.bind(fraudCaseController)),
  );

  router.get(
    '/dashboard/sla',
    asyncHandler(fraudCaseController.getSlaMetrics.bind(fraudCaseController)),
  );

  // Case management routes
  router.post(
    '/cases',
    asyncHandler(fraudCaseController.createCase.bind(fraudCaseController)),
  );

  router.get(
    '/cases',
    asyncHandler(fraudCaseController.listCases.bind(fraudCaseController)),
  );

  router.get(
    '/cases/:id',
    asyncHandler(fraudCaseController.getCaseDetails.bind(fraudCaseController)),
  );

  router.post(
    '/cases/:id/assign',
    asyncHandler(fraudCaseController.assignCase.bind(fraudCaseController)),
  );

  router.post(
    '/cases/:id/reassign',
    asyncHandler(fraudCaseController.reassignCase.bind(fraudCaseController)),
  );

  router.post(
    '/cases/:id/escalate',
    asyncHandler(fraudCaseController.escalateCase.bind(fraudCaseController)),
  );

  router.post(
    '/cases/:id/resolve',
    asyncHandler(fraudCaseController.resolveCase.bind(fraudCaseController)),
  );

  router.post(
    '/cases/:id/close',
    asyncHandler(fraudCaseController.closeCase.bind(fraudCaseController)),
  );

  return router;
};
