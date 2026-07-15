import { Router } from 'express';
import type { FraudController } from '../controllers/fraud.controller';
import { requireJwt } from '../middleware/jwt.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { UserRole } from '@finguard/shared';

export function createFraudRouter(fraudController: FraudController): Router {
  const router = Router();

  router.post('/check', requireJwt, fraudController.check.bind(fraudController));

  router.get(
    '/alerts',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    fraudController.getAlerts.bind(fraudController),
  );
  router.get(
    '/alerts/open',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    fraudController.getOpenAlerts.bind(fraudController),
  );
  router.get(
    '/alerts/critical',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    fraudController.getCriticalAlerts.bind(fraudController),
  );
  router.get(
    '/alerts/:id',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    fraudController.getAlertById.bind(fraudController),
  );

  router.post(
    '/alerts/:id/review',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    fraudController.startReview.bind(fraudController),
  );
  router.post(
    '/alerts/:id/confirm',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    fraudController.confirmFraud.bind(fraudController),
  );
  router.post(
    '/alerts/:id/false-positive',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    fraudController.markFalsePositive.bind(fraudController),
  );
  router.post(
    '/alerts/:id/resolve',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    fraudController.resolveAlert.bind(fraudController),
  );

  router.get(
    '/analytics',
    requireJwt,
    requireRole(UserRole.ADMIN, UserRole.RISK_ANALYST),
    fraudController.getAnalytics.bind(fraudController),
  );

  return router;
}
