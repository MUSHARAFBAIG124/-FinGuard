import { Router } from 'express';
import type { RequestHandler } from 'express';
import { createRiskAssessmentController } from '../controllers/risk-assessment.controller';
import { asyncHandler } from '../utils/async-handler';
import { requireJwt } from '../middleware/jwt.middleware';
import type { LoanRepository } from '../repositories/loan.repository';
import type { RiskAssessmentRepository } from '../repositories/risk-assessment.repository';

export const createRiskAssessmentRouter = (deps: {
  loanRepository: LoanRepository;
  riskAssessmentRepository: RiskAssessmentRepository;
  authenticate?: RequestHandler;
}) => {
  const router = Router();
  const ctrl = createRiskAssessmentController({
    loanRepository: deps.loanRepository,
    riskAssessmentRepository: deps.riskAssessmentRepository,
  });

  router.get('/:loanId', deps.authenticate ?? requireJwt, asyncHandler(ctrl.getByLoanId));

  return router;
};
