import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserRole } from '@finguard/shared';
import { AppError } from '../errors/app-error';
import { isDatabaseReady } from '../config/database';
import type { LoanRepository } from '../repositories/loan.repository';
import type { RiskAssessmentRepository } from '../repositories/risk-assessment.repository';

export const createRiskAssessmentController = (deps: {
  loanRepository: LoanRepository;
  riskAssessmentRepository: RiskAssessmentRepository;
  isDatabaseReady?: () => boolean;
}) => {
  const { loanRepository, riskAssessmentRepository } = deps;
  const databaseReady = deps.isDatabaseReady ?? isDatabaseReady;

  const assertDatabaseReady = (): void => {
    if (!databaseReady()) {
      throw new AppError({
        code: 'DATABASE_UNAVAILABLE',
        message: 'Risk assessments are unavailable until the database connection is ready',
        statusCode: StatusCodes.SERVICE_UNAVAILABLE,
      });
    }
  };

  const assertCanReadLoanRisk = async (req: Request, loanId: string): Promise<void> => {
    if (!req.auth) {
      throw new AppError({
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required',
        statusCode: StatusCodes.UNAUTHORIZED,
      });
    }

    if ([UserRole.ADMIN, UserRole.RISK_ANALYST, UserRole.LOAN_OFFICER].includes(req.auth.role)) {
      assertDatabaseReady();
      return;
    }

    assertDatabaseReady();

    const loan = await loanRepository.findById(loanId);
    if (!loan) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    if (loan.userId.toString() !== req.auth.sub) {
      throw new AppError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this risk assessment',
        statusCode: StatusCodes.FORBIDDEN,
      });
    }
  };

  const getByLoanId = async (req: Request, res: Response) => {
    const loanId = req.params.loanId;
    if (!loanId) {
      res.status(400).json({ error: 'Loan ID is required' });
      return;
    }

    await assertCanReadLoanRisk(req, loanId);

    const items = await riskAssessmentRepository.findByLoanApplicationId(loanId);
    // map to minimal public view
    const out = items.map((r) => ({
      riskScore: r.riskScore,
      approvalProbability: r.approvalProbability,
      riskCategory: r.riskCategory,
      modelVersion: r.modelVersion,
      generatedAt: r.generatedAt,
      explanation: r.explanation,
    }));
    res.json(out);
  };

  return { getByLoanId };
};
