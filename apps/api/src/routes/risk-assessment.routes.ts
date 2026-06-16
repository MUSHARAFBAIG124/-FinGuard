import { Router } from 'express';
import { createRiskAssessmentController } from '../controllers/risk-assessment.controller';
import type { RiskAssessmentRepository } from '../repositories/risk-assessment.repository';

export const createRiskAssessmentRouter = (deps: {
  riskAssessmentRepository: RiskAssessmentRepository;
}) => {
  const router = Router();
  const ctrl = createRiskAssessmentController({
    riskAssessmentRepository: deps.riskAssessmentRepository,
  });

  router.get('/:loanId', ctrl.getByLoanId);

  return router;
};
