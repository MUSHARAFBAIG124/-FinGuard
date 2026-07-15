import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('RiskAssessmentController getByLoanId', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns empty array when no assessments', async () => {
    const repo: any = { findByLoanApplicationId: async () => [] };
    const loanRepo: any = { findById: async () => null };
    const controller = (
      await import('../../controllers/risk-assessment.controller')
    ).createRiskAssessmentController({
      loanRepository: loanRepo,
      riskAssessmentRepository: repo,
      isDatabaseReady: () => true,
    });

    let body: any = null;
    const res: any = {
      json: (b: any) => {
        body = b;
        return b;
      },
    };

    await controller.getByLoanId(
      { params: { loanId: 'none' }, auth: { sub: 'admin-1', role: 'ADMIN' } } as any,
      res,
    );
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  it('returns multiple assessments and preserves explanation including shapValues', async () => {
    const now = new Date();
    const assessments = [
      {
        riskScore: 10,
        approvalProbability: 0.9,
        riskCategory: 'LOW',
        modelVersion: '1.0.0',
        generatedAt: now,
        explanation: {
          summary: 'ok',
          positiveFactors: ['a'],
          negativeFactors: [],
          shapValues: [{ feature: 'age', value: 0.1 }],
        },
      },
      {
        riskScore: 20,
        approvalProbability: 0.6,
        riskCategory: 'MEDIUM',
        modelVersion: '1.0.1',
        generatedAt: now,
        explanation: {
          summary: 'other',
          positiveFactors: [],
          negativeFactors: ['x'],
          shapValues: null,
        },
      },
    ];

    const repo: any = { findByLoanApplicationId: async () => assessments };
    const loanRepo: any = { findById: async () => null };
    const controller = (
      await import('../../controllers/risk-assessment.controller')
    ).createRiskAssessmentController({
      loanRepository: loanRepo,
      riskAssessmentRepository: repo,
      isDatabaseReady: () => true,
    });

    let body: any = null;
    const res: any = {
      json: (b: any) => {
        body = b;
        return b;
      },
    };

    await controller.getByLoanId(
      { params: { loanId: 'l1' }, auth: { sub: 'admin-1', role: 'ADMIN' } } as any,
      res,
    );
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    expect(body[0]).toMatchObject({
      riskScore: 10,
      approvalProbability: 0.9,
      riskCategory: 'LOW',
      modelVersion: '1.0.0',
    });
    expect(body[0].explanation).toBeTruthy();
    expect(body[0].explanation.shapValues).toBeDefined();
    expect(body[1].explanation.shapValues).toBeNull();
  });

  it('rejects a customer who does not own the loan', async () => {
    const repo: any = { findByLoanApplicationId: async () => [] };
    const loanRepo: any = { findById: async () => ({ userId: { toString: () => 'owner-1' } }) };
    const controller = (
      await import('../../controllers/risk-assessment.controller')
    ).createRiskAssessmentController({
      loanRepository: loanRepo,
      riskAssessmentRepository: repo,
      isDatabaseReady: () => true,
    });

    await expect(
      controller.getByLoanId(
        { params: { loanId: 'l1' }, auth: { sub: 'other-1', role: 'CUSTOMER' } } as any,
        {} as any,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows a customer who owns the loan', async () => {
    const repo: any = { findByLoanApplicationId: async () => [] };
    const loanRepo: any = { findById: async () => ({ userId: { toString: () => 'owner-1' } }) };
    const controller = (
      await import('../../controllers/risk-assessment.controller')
    ).createRiskAssessmentController({
      loanRepository: loanRepo,
      riskAssessmentRepository: repo,
      isDatabaseReady: () => true,
    });

    let body: any = null;
    const res: any = {
      json: (b: any) => {
        body = b;
        return b;
      },
    };

    await controller.getByLoanId(
      { params: { loanId: 'l1' }, auth: { sub: 'owner-1', role: 'CUSTOMER' } } as any,
      res,
    );

    expect(body).toEqual([]);
  });
});
