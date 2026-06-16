import { Router } from 'express';

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

export const createCustomerLoanRouter = (dependencies: LoanServiceDependencies): Router => {
  const router = Router();
  const loanService = new LoanService(dependencies);
  const controller = new LoanController(loanService);

  // Customer endpoints
  router.post('/', requireJwt, validateRequest({ body: createLoanSchema }), controller.create);
  router.get('/', requireJwt, controller.listOwn);
  router.get(
    '/:id',
    requireJwt,
    validateRequest({ params: loanIdParamSchema }),
    controller.getById,
  );
  router.patch(
    '/:id',
    requireJwt,
    validateRequest({ params: loanIdParamSchema, body: updateLoanSchema }),
    controller.update,
  );
  router.post(
    '/:id/submit',
    requireJwt,
    validateRequest({ params: loanIdParamSchema }),
    controller.submit,
  );

  return router;
};

export const createReviewRouter = (dependencies: LoanServiceDependencies): Router => {
  const router = Router();
  const loanService = new LoanService(dependencies);
  const controller = new LoanController(loanService);

  // Loan officer endpoints
  router.get(
    '/queue',
    requireJwt,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    controller.getReviewQueue,
  );
  router.post(
    '/:id/start',
    requireJwt,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    validateRequest({ params: loanIdParamSchema }),
    controller.startReview,
  );
  router.post(
    '/:id/request-info',
    requireJwt,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    validateRequest({ params: loanIdParamSchema }),
    controller.requestMoreInfo,
  );
  router.post(
    '/:id/approve',
    requireJwt,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    validateRequest({ params: loanIdParamSchema }),
    controller.approve,
  );
  router.post(
    '/:id/reject',
    requireJwt,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    validateRequest({ params: loanIdParamSchema }),
    controller.reject,
  );

  return router;
};
