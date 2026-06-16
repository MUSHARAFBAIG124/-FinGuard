import { Router } from 'express';

import { API_PREFIX } from '@finguard/shared';

import { createAuthServiceDependencies } from '../services/auth.dependencies';
import { createLoanServiceDependencies } from '../services/loan.dependencies';
import { createModelDependencies } from '../services/model.dependencies';
import { createFraudDependencies } from '../services/fraud.dependencies';
import type { AuthRouterDependencies } from './auth.routes';
import { createAuthRouter } from './auth.routes';
import type { LoanRouterDependencies } from './loan.routes';
import { createCustomerLoanRouter, createReviewRouter } from './loan.routes';
import { createModelRouter } from './model.routes';
import { registerModelAnalyticsRoutes } from './model-analytics.routes';
import { registerModelGovernanceRoutes } from './model-governance.routes';
import { createRiskAssessmentRouter } from './risk-assessment.routes';
import { createFraudRouter } from './fraud.routes';
import { createFraudCaseRouter } from './fraud-case.routes';
import { MongooseRiskAssessmentRepository } from '../repositories/mongoose-risk-assessment.repository';
import { healthRouter } from './health.routes';

export interface ApiRouterOptions {
  readonly authDependencies?: AuthRouterDependencies;
  readonly loanDependencies?: LoanRouterDependencies;
}

export const createApiRouter = (options: ApiRouterOptions = {}): Router => {
  const router = Router();
  const loanDependencies = options.loanDependencies ?? createLoanServiceDependencies();
  const modelDependencies = createModelDependencies();
  const fraudDependencies = createFraudDependencies();

  router.use('/health', healthRouter);
  router.use(
    '/auth',
    createAuthRouter(options.authDependencies ?? createAuthServiceDependencies()),
  );
  router.use('/loans', createCustomerLoanRouter(loanDependencies));
  router.use('/review', createReviewRouter(loanDependencies));
  router.use('/model', createModelRouter(modelDependencies));
  router.use(
    '/models/analytics',
    registerModelAnalyticsRoutes(router, modelDependencies.analyticsService),
  );
  registerModelGovernanceRoutes(router, {
    governanceService: modelDependencies.governanceService,
    driftService: modelDependencies.driftService,
    analyticsService: modelDependencies.analyticsService,
  });
  router.use('/fraud', createFraudRouter(fraudDependencies.fraudController));
  router.use('/fraud', createFraudCaseRouter(fraudDependencies.fraudCaseController));
  // risk assessments history
  router.use(
    '/risk-assessments',
    createRiskAssessmentRouter({
      riskAssessmentRepository: new MongooseRiskAssessmentRepository(),
    }),
  );

  return router;
};

export const apiRouter = createApiRouter();

export { API_PREFIX };
