import { Router, type RequestHandler } from 'express';

import { UserRole } from '@finguard/shared';

import { LoanController } from '../controllers/loan.controller';
import { requireJwt } from '../middleware/jwt.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { LoanService } from '../services/loan.service';
import type { LoanServiceDependencies } from '../services/loan.service';
import {
  createLoanSchema,
  loanIdParamSchema,
  updateLoanSchema,
} from '../validators/loan.validators';

export type LoanRouterDependencies = LoanServiceDependencies;

export const createCustomerLoanRouter = (
  dependencies: LoanServiceDependencies,
  authenticate: RequestHandler = requireJwt,
): Router => {
  const router = Router();
  const loanService = new LoanService(dependencies);
  const controller = new LoanController(loanService);

  // Admin / officer / analyst — see all loans
  router.get(
    '/all',
    authenticate,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN, UserRole.RISK_ANALYST),
    controller.listAll,
  );

  // Customer endpoints
  router.post('/', authenticate, validateRequest({ body: createLoanSchema }), controller.create);
  router.get('/', authenticate, controller.listOwn);
  router.get(
    '/:id',
    authenticate,
    validateRequest({ params: loanIdParamSchema }),
    controller.getById,
  );
  router.patch(
    '/:id',
    authenticate,
    validateRequest({ params: loanIdParamSchema, body: updateLoanSchema }),
    controller.update,
  );
  router.post(
    '/:id/submit',
    authenticate,
    validateRequest({ params: loanIdParamSchema }),
    controller.submit,
  );

  return router;
};

export const createReviewRouter = (
  dependencies: LoanServiceDependencies,
  authenticate: RequestHandler = requireJwt,
): Router => {
  const router = Router();
  const loanService = new LoanService(dependencies);
  const controller = new LoanController(loanService);

  // Loan officer endpoints
  router.get(
    '/queue',
    authenticate,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    controller.getReviewQueue,
  );
  router.post(
    '/:id/start',
    authenticate,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    validateRequest({ params: loanIdParamSchema }),
    controller.startReview,
  );
  router.post(
    '/:id/request-info',
    authenticate,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    validateRequest({ params: loanIdParamSchema }),
    controller.requestMoreInfo,
  );
  router.post(
    '/:id/approve',
    authenticate,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    validateRequest({ params: loanIdParamSchema }),
    controller.approve,
  );
  router.post(
    '/:id/reject',
    authenticate,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    validateRequest({ params: loanIdParamSchema }),
    controller.reject,
  );

  return router;
};
