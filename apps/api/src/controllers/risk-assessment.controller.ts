import type { Request, Response } from 'express';
import type { RiskAssessmentRepository } from '../repositories/risk-assessment.repository';

export const createRiskAssessmentController = (deps: {
  riskAssessmentRepository: RiskAssessmentRepository;
}) => {
  const { riskAssessmentRepository } = deps;

  const getByLoanId = async (req: Request, res: Response) => {
    const loanId = req.params.loanId;
    if (!loanId) {
      return res.status(400).json({ error: 'Loan ID is required' });
    }
    const items = await riskAssessmentRepository.findByLoanApplicationId(loanId);
    // map to minimal public view
    const out = items.map((r) => ({
      riskScore: r.riskScore,
      modelVersion: r.modelVersion,
      generatedAt: r.generatedAt,
      explanation: r.explanation,
    }));
    return res.json(out);
  };

  return { getByLoanId };
};
