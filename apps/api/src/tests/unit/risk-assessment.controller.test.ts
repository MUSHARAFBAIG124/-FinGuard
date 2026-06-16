import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('RiskAssessmentController getByLoanId', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns empty array when no assessments', async () => {
    const repo: any = { findByLoanApplicationId: async () => [] };
    const controller = (await import('../../controllers/risk-assessment.controller')).createRiskAssessmentController({ riskAssessmentRepository: repo });

    let body: any = null;
    const res: any = { json: (b: any) => { body = b; return b; } };

    await controller.getByLoanId({ params: { loanId: 'none' } } as any, res as any);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(0);
  });

  it('returns multiple assessments and preserves explanation including shapValues', async () => {
    const now = new Date();
    const assessments = [
      { riskScore: 10, modelVersion: '1.0.0', generatedAt: now, explanation: { summary: 'ok', positiveFactors: ['a'], negativeFactors: [], shapValues: [{ feature: 'age', value: 0.1 }] } },
      { riskScore: 20, modelVersion: '1.0.1', generatedAt: now, explanation: { summary: 'other', positiveFactors: [], negativeFactors: ['x'], shapValues: null } },
    ];

    const repo: any = { findByLoanApplicationId: async () => assessments };
    const controller = (await import('../../controllers/risk-assessment.controller')).createRiskAssessmentController({ riskAssessmentRepository: repo });

    let body: any = null;
    const res: any = { json: (b: any) => { body = b; return b; } };

    await controller.getByLoanId({ params: { loanId: 'l1' } } as any, res as any);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
    expect(body[0].explanation).toBeTruthy();
    expect(body[0].explanation.shapValues).toBeDefined();
    expect(body[1].explanation.shapValues).toBeNull();
  });
});
