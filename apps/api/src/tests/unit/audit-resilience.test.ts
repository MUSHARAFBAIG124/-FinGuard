import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInMemoryLoanDependencies } from '../../tests/in-memory-loan-dependencies';

describe('Audit resilience - service continues when dependencies fail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('continues when audit repository is unavailable during prediction request', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({
      userId: 'audit-res-1',
      loanAmount: 1,
      loanPurpose: 'p',
      employmentType: 'EMPLOYED',
      annualIncome: 1,
      existingDebt: 0,
      creditScore: 600,
    } as any);

    // Make audit repository throw on all calls
    (repos?.auditLogRepository as any).create = vi.fn(async () => {
      throw new Error('audit repository unavailable');
    });

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        riskScore: 55,
        riskCategory: 'MEDIUM',
        approvalProbability: 0.6,
        modelVersion: '1.0.0',
      }),
    });

    // Should complete despite audit failures
    const result = await svc.createRiskAssessment(
      loan._id.toString(),
      {},
      {
        userId: 'audit-res-1',
        requestId: 'req-1',
        ipAddress: '10.0.0.1',
      },
    );
    expect(result).toBeTruthy();
    expect(result.riskScore).toBe(55);
  });

  it('continues when database write failure occurs during audit creation', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({
      userId: 'audit-res-2',
      loanAmount: 1,
      loanPurpose: 'p',
      employmentType: 'EMPLOYED',
      annualIncome: 1,
      existingDebt: 0,
      creditScore: 600,
    } as any);

    // Simulate database write failure
    const originalCreate = repos?.auditLogRepository?.create;
    (repos?.auditLogRepository as any).create = vi.fn(async (input: any) => {
      if (
        input.action?.includes('MODEL_PREDICTION') ||
        input.action === 'RISK_ASSESSMENT_CREATED'
      ) {
        throw new Error('E11000 duplicate key error');
      }
      return originalCreate?.call(repos?.auditLogRepository, input);
    });

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        riskScore: 65,
        riskCategory: 'HIGH',
        approvalProbability: 0.25,
        modelVersion: '2.0.0',
      }),
    });

    const result = await svc.createRiskAssessment(
      loan._id.toString(),
      {},
      {
        userId: 'audit-res-2',
        requestId: 'req-2',
        ipAddress: '10.0.0.2',
      },
    );
    expect(result).toBeTruthy();
    expect(result.riskScore).toBe(65);
  });

  it('continues when model metrics service is unavailable', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({
      userId: 'audit-res-3',
      loanAmount: 1,
      loanPurpose: 'p',
      employmentType: 'EMPLOYED',
      annualIncome: 1,
      existingDebt: 0,
      creditScore: 600,
    } as any);

    // Make metrics service throw
    const metricsService = dependencies.modelMetricsService as any;
    metricsService.recordPrediction = vi.fn(async () => {
      throw new Error('metrics service unavailable');
    });

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        riskScore: 35,
        riskCategory: 'LOW',
        approvalProbability: 0.85,
        modelVersion: '3.0.0',
      }),
    });

    // Should complete despite metrics failure
    const result = await svc.createRiskAssessment(
      loan._id.toString(),
      {},
      {
        userId: 'audit-res-3',
        requestId: 'req-3',
        ipAddress: '10.0.0.3',
      },
    );
    expect(result).toBeTruthy();
    expect(result.riskScore).toBe(35);
  });

  it('continues when both audit and metrics services fail', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({
      userId: 'audit-res-4',
      loanAmount: 1,
      loanPurpose: 'p',
      employmentType: 'EMPLOYED',
      annualIncome: 1,
      existingDebt: 0,
      creditScore: 600,
    } as any);

    // Both services fail
    (repos?.auditLogRepository as any).create = vi.fn(async () => {
      throw new Error('audit down');
    });
    const metricsService = dependencies.modelMetricsService as any;
    metricsService.recordPrediction = vi.fn(async () => {
      throw new Error('metrics down');
    });

    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        riskScore: 45,
        riskCategory: 'MEDIUM',
        approvalProbability: 0.55,
        modelVersion: '4.0.0',
      }),
    });

    const result = await svc.createRiskAssessment(
      loan._id.toString(),
      {},
      {
        userId: 'audit-res-4',
        requestId: 'req-4',
        ipAddress: '10.0.0.4',
      },
    );
    expect(result).toBeTruthy();
    expect(result.riskScore).toBe(45);
  });

  it('continues when AI service error path has audit and metrics failures', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({
      userId: 'audit-res-5',
      loanAmount: 1,
      loanPurpose: 'p',
      employmentType: 'EMPLOYED',
      annualIncome: 1,
      existingDebt: 0,
      creditScore: 600,
    } as any);

    // Audit and metrics fail
    (repos?.auditLogRepository as any).create = vi.fn(async () => {
      throw new Error('audit down');
    });
    const metricsService = dependencies.modelMetricsService as any;
    metricsService.recordPrediction = vi.fn(async () => {
      throw new Error('metrics down');
    });

    // AI service returns error
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({}),
    });

    await expect(
      svc.createRiskAssessment(
        loan._id.toString(),
        {},
        {
          userId: 'audit-res-5',
          requestId: 'req-5',
          ipAddress: '10.0.0.5',
        },
      ),
    ).rejects.toThrow();
  });
});
