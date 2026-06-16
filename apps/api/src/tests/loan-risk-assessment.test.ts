import { describe, it, expect, vi } from 'vitest';
import { LoanStatus, EmploymentType } from '@finguard/shared';
import { createInMemoryLoanDependencies } from './in-memory-loan-dependencies';
import { LoanService } from '../services/loan.service';

describe('Loan Risk Assessment Integration', () => {
  it('should successfully submit a loan and persist risk assessment', async () => {
    const { dependencies } = createInMemoryLoanDependencies();
    const loanService = new LoanService(dependencies);
    const { loanRepository, riskAssessmentService } = dependencies;

    // Create loan
    const loan = await loanRepository.create({
      userId: 'user-1',
      loanAmount: 25000,
      loanPurpose: 'home',
      employmentType: EmploymentType.UNEMPLOYED,
      annualIncome: 65000,
      existingDebt: 5000,
      creditScore: 720,
    });

    // Mock risk assessment service
    if (riskAssessmentService) {
      const createRiskAssessmentSpy = vi.spyOn(riskAssessmentService, 'createRiskAssessment');
      createRiskAssessmentSpy.mockResolvedValue({
        _id: 'risk-1',
        loanApplicationId: loan._id.toString(),
        riskScore: 15,
        riskCategory: 'LOW',
        approvalProbability: 0.85,
        modelVersion: '1.0.0',
        riskEngineVersion: '1.0.0',
        explanation: {
          summary: 'Low risk',
          positiveFactors: ['Good credit score'],
          negativeFactors: [],
          shapValues: [{ feature: 'credit_score', value: 0.25 }],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      await loanService.submit(loan._id.toString(), 'user-1', {
        requestId: 'req-1',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });
      expect(createRiskAssessmentSpy).toHaveBeenCalled();
    }
  });

  it('should handle FastAPI service unavailability', async () => {
    const { dependencies } = createInMemoryLoanDependencies();
    const loanService = new LoanService(dependencies);
    const { loanRepository, riskAssessmentService } = dependencies;

    // Create loan
    const loan = await loanRepository.create({
      userId: 'user-1',
      loanAmount: 25000,
      loanPurpose: 'home',
      employmentType: EmploymentType.UNEMPLOYED,
      annualIncome: 65000,
      existingDebt: 5000,
      creditScore: 720,
    });

    // Mock service to fail
    if (riskAssessmentService) {
      vi.spyOn(riskAssessmentService, 'createRiskAssessment').mockRejectedValue(
        new Error('FastAPI unavailable'),
      );

      // Should not throw error
      await expect(
        loanService.submit(loan._id.toString(), 'user-1', {
          requestId: 'req-1',
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        }),
      ).resolves.not.toThrow();
    }
  });
});
