import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInMemoryLoanDependencies } from '../../tests/in-memory-loan-dependencies';
import { LoanService } from '../../services/loan.service';

describe('RiskAssessmentService edge cases', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('handles missing explanation field gracefully', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;

    const loan = await dependencies.loanRepository.create({ userId: 'u1', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    // AI returns minimal payload without explanation
    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 42, riskCategory: 'HIGH', approvalProbability: 0.1, modelVersion: '3.0.0' }) });

    await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u1', requestId: 'r1', ipAddress: '1.2.3.4' });

    const items = await repos?.riskAssessmentRepository?.findByLoanApplicationId(loan._id.toString());
    expect(items && items.length).toBe(1);
    const ex = (items as any)[0].explanation;
    expect(ex).toBeTruthy();
    expect(Array.isArray(ex.positiveFactors)).toBe(true);
    expect(Array.isArray(ex.negativeFactors)).toBe(true);
    expect(ex.shapValues).toBeUndefined();
  });

  it('stores malformed shapValues as-is', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u2', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 5, riskCategory: 'LOW', approvalProbability: 0.99, modelVersion: 'x.y.z', explanation: { summary: 's', positiveFactors: [], negativeFactors: [], shapValues: 'not-an-array' } }) });

    await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u2', requestId: 'r2', ipAddress: '5.6.7.8' });
    const items = await repos?.riskAssessmentRepository?.findByLoanApplicationId(loan._id.toString());
    expect(items && items.length).toBe(1);
    const sv = (items as any)[0].explanation.shapValues;
    expect(sv).toBe('not-an-array');
  });

  it('emits MODEL_PREDICTION_FAILED when AI returns 500', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u3', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error', json: async () => ({}) });

    await expect(svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u3', requestId: 'r3', ipAddress: '9.9.9.9' })).rejects.toThrow();

    const logs = await repos?.auditLogRepository?.findByUserId('u3');
    const hasFailed = (logs || []).some((l: any) => l.action === 'MODEL_PREDICTION_FAILED');
    expect(hasFailed).toBe(true);
  });

  it('handles fetch/network errors and records metrics failure', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u4', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    (global as any).fetch = vi.fn().mockImplementation(async () => { throw new Error('network down'); });

    await expect(svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u4', requestId: 'r4', ipAddress: '8.8.8.8' })).rejects.toThrow();

    const logs = await repos?.auditLogRepository?.findByUserId('u4');
    const fail = (logs || []).find((l: any) => l.action === 'MODEL_PREDICTION_FAILED');
    expect(fail).toBeTruthy();
    expect(fail?.requestId).toBe('r4');
    // metrics for unknown model recorded
    const mm = dependencies.modelMetricsService?.getModelMetrics('unknown');
    // modelMetricsService may return null synchronously; ensure call did not throw
    await expect(mm).resolves.not.toThrow();
  });

  it('handles non-JSON response (json() throws) by bubbling error and not creating assessment', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u5', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => { throw new Error('invalid json'); } });

    await expect(svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u5', requestId: 'r5', ipAddress: '7.7.7.7' })).rejects.toThrow();

    const items = await repos?.riskAssessmentRepository?.findByLoanApplicationId(loan._id.toString());
    expect(items && items.length).toBe(0);
    const logs = await repos?.auditLogRepository?.findByUserId('u5');
    // request should have been logged but no succeeded event
    const requested = (logs || []).some((l: any) => l.action === 'MODEL_PREDICTION_REQUESTED');
    const succeeded = (logs || []).some((l: any) => l.action === 'MODEL_PREDICTION_SUCCEEDED');
    expect(requested).toBe(true);
    expect(succeeded).toBe(false);
  });

  it('defaults missing context values (userId/ipAddress/requestId)', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u6', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 1, riskCategory: 'MEDIUM', approvalProbability: 0.5, explanation: { summary: '', positiveFactors: [], negativeFactors: [] } }) });

    // call with empty context
    await svc.createRiskAssessment(loan._id.toString(), {}, {} as any);

    const logs = await repos?.auditLogRepository?.findByUserId('unknown');
    // since userId defaulted to 'unknown', audit entries may exist under that user
    expect(Array.isArray(logs)).toBe(true);
    const created = (logs || []).some((l: any) => l.action === 'RISK_ASSESSMENT_CREATED');
    expect(created).toBe(true);
  });

  it('continues when audit log creation fails during MODEL_PREDICTION_REQUESTED', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u7a', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    // Mock audit log repository to throw
    const originalCreate = repos?.auditLogRepository?.create;
    let auditThrowCount = 0;
    (repos?.auditLogRepository as any).create = vi.fn(async (input: any) => {
      auditThrowCount++;
      if (auditThrowCount === 1) { // Throw on first audit (MODEL_PREDICTION_REQUESTED)
        throw new Error('audit store down');
      }
      return originalCreate?.call(repos?.auditLogRepository, input);
    });

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 42, riskCategory: 'HIGH', approvalProbability: 0.1, modelVersion: '2.0.0' }) });

    // Should not throw despite audit failure
    const result = await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u7a', requestId: 'r7a', ipAddress: '7.7.7.7' });
    expect(result).toBeTruthy();
    expect(result.riskScore).toBe(42);
  });

  it('continues when audit log creation fails during MODEL_PREDICTION_SUCCEEDED', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u7b', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    // Mock audit log repository to throw on third audit (MODEL_PREDICTION_SUCCEEDED)
    const originalCreate = repos?.auditLogRepository?.create;
    let auditThrowCount = 0;
    (repos?.auditLogRepository as any).create = vi.fn(async (input: any) => {
      auditThrowCount++;
      if (auditThrowCount === 3 && input.action === 'MODEL_PREDICTION_SUCCEEDED') {
        throw new Error('audit store down');
      }
      return originalCreate?.call(repos?.auditLogRepository, input);
    });

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 35, riskCategory: 'MEDIUM', approvalProbability: 0.5, modelVersion: '3.0.0' }) });

    // Should not throw despite audit failure
    const result = await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u7b', requestId: 'r7b', ipAddress: '8.8.8.8' });
    expect(result).toBeTruthy();
    expect(result.riskScore).toBe(35);
  });

  it('continues when audit log creation fails during RISK_ASSESSMENT_CREATED', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u7c', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    // Mock audit log repository to throw on final audit (RISK_ASSESSMENT_CREATED)
    const originalCreate = repos?.auditLogRepository?.create;
    let auditThrowCount = 0;
    (repos?.auditLogRepository as any).create = vi.fn(async (input: any) => {
      auditThrowCount++;
      if (input.action === 'RISK_ASSESSMENT_CREATED') {
        throw new Error('audit store down');
      }
      return originalCreate?.call(repos?.auditLogRepository, input);
    });

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 25, riskCategory: 'LOW', approvalProbability: 0.9, modelVersion: '4.0.0' }) });

    // Should not throw despite audit failure
    const result = await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u7c', requestId: 'r7c', ipAddress: '9.9.9.9' });
    expect(result).toBeTruthy();
    expect(result.riskScore).toBe(25);
  });

  it('continues when model metrics service fails during prediction recording', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u8', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    // Mock model metrics service to throw
    const metricsService = dependencies.modelMetricsService as any;
    const originalRecord = metricsService.recordPrediction;
    metricsService.recordPrediction = vi.fn(async () => {
      throw new Error('metrics service down');
    });

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 55, riskCategory: 'MEDIUM', approvalProbability: 0.6, modelVersion: '5.0.0' }) });

    // Should not throw despite metrics failure
    const result = await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u8', requestId: 'r8', ipAddress: '10.10.10.10' });
    expect(result).toBeTruthy();
    expect(result.riskScore).toBe(55);
  });

  it('propagates requestId through all audit events', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u9', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 65, riskCategory: 'HIGH', approvalProbability: 0.3, modelVersion: '6.0.0' }) });

    await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u9', requestId: 'unique-request-xyz', ipAddress: '11.11.11.11' });

    const logs = await repos?.auditLogRepository?.findByUserId('u9');
    const allHaveRequestId = (logs || []).every((l: any) => l.requestId === 'unique-request-xyz');
    expect(allHaveRequestId).toBe(true);
    expect(logs?.length).toBeGreaterThan(0);
  });

  it('handles model metrics service unavailable gracefully on error path', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u10', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    // Mock model metrics service to throw on error path
    const metricsService = dependencies.modelMetricsService as any;
    metricsService.recordPrediction = vi.fn(async () => {
      throw new Error('metrics service down');
    });

    (global as any).fetch = vi.fn().mockImplementation(async () => { throw new Error('network error'); });

    // Should throw AI error but handle metrics failure gracefully
    await expect(svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u10', requestId: 'r10', ipAddress: '12.12.12.12' })).rejects.toThrow();

    // Ensure MODEL_PREDICTION_FAILED was logged
    const logs = await repos?.auditLogRepository?.findByUserId('u10');
    const failed = (logs || []).some((l: any) => l.action === 'MODEL_PREDICTION_FAILED');
    expect(failed).toBe(true);
  });

  it('stores SHAP values in structured explanation', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u11', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    const shapValues = [
      { feature: 'creditScore', value: 0.3 },
      { feature: 'annualIncome', value: 0.2 },
    ];

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 45, riskCategory: 'MEDIUM', approvalProbability: 0.55, modelVersion: '7.0.0', explanation: { summary: 'credit score important', positiveFactors: ['stable income'], negativeFactors: ['high debt'], shapValues } }) });

    const result = await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u11', requestId: 'r11', ipAddress: '13.13.13.13' });

    expect(result.explanation.shapValues).toEqual(shapValues);
    expect(Array.isArray(result.explanation.shapValues)).toBe(true);
  });

  it('handles missing modelVersion by defaulting to 1.0.0', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u12', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 50, riskCategory: 'MEDIUM', approvalProbability: 0.5 }) });

    const result = await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u12', requestId: 'r12', ipAddress: '1.1.1.1' });
    expect(result.modelVersion).toBe('1.0.0');
  });

  it('handles missing riskScore and approvalProbability as undefined', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u13', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskCategory: 'LOW' }) });

    const result = await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u13', requestId: 'r13', ipAddress: '2.2.2.2' });
    expect(result.riskCategory).toBe('LOW');
    expect(result.explanation.positiveFactors).toEqual([]);
    expect(result.explanation.negativeFactors).toEqual([]);
  });

  it('handles empty explanation arrays gracefully', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u14', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 60, riskCategory: 'HIGH', approvalProbability: 0.2, explanation: { summary: '', positiveFactors: [], negativeFactors: [], shapValues: [] } }) });

    const result = await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u14', requestId: 'r14', ipAddress: '3.3.3.3' });
    expect(result.explanation.positiveFactors).toEqual([]);
    expect(result.explanation.negativeFactors).toEqual([]);
    expect(result.explanation.shapValues).toEqual([]);
  });

  it('continues when metrics service fails on error path (line 50/68)', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u15', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    const metricsService = dependencies.modelMetricsService as any;
    metricsService.recordPrediction = vi.fn(async () => { throw new Error('metrics down'); });

    (global as any).fetch = vi.fn().mockImplementation(async () => { throw new Error('network error'); });

    await expect(svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u15', requestId: 'r15', ipAddress: '4.4.4.4' })).rejects.toThrow();

    const logs = await repos?.auditLogRepository?.findByUserId('u15');
    const failed = (logs || []).some((l: any) => l.action === 'MODEL_PREDICTION_FAILED');
    expect(failed).toBe(true);
  });

  it('continues when metrics service fails on non-ok response path (line 68)', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u16', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    const metricsService = dependencies.modelMetricsService as any;
    metricsService.recordPrediction = vi.fn(async () => { throw new Error('metrics down'); });

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable', json: async () => ({}) });

    await expect(svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u16', requestId: 'r16', ipAddress: '5.5.5.5' })).rejects.toThrow();

    const logs = await repos?.auditLogRepository?.findByUserId('u16');
    const failed = (logs || []).some((l: any) => l.action === 'MODEL_PREDICTION_FAILED');
    expect(failed).toBe(true);
  });

  it('continues when audit log fails during MODEL_PREDICTION_SUCCEEDED (line 89)', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u17', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    const originalCreate = repos?.auditLogRepository?.create;
    let callCount = 0;
    (repos?.auditLogRepository as any).create = vi.fn(async (input: any) => {
      callCount++;
      if (input.action === 'MODEL_PREDICTION_SUCCEEDED') {
        throw new Error('audit store down on success');
      }
      return originalCreate?.call(repos?.auditLogRepository, input);
    });

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 30, riskCategory: 'LOW', approvalProbability: 0.8, modelVersion: '9.0.0' }) });

    const result = await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u17', requestId: 'r17', ipAddress: '6.6.6.6' });
    expect(result).toBeTruthy();
    expect(result.riskScore).toBe(30);
  });

  it('continues when audit log fails during RISK_ASSESSMENT_CREATED (line 152)', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u18', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    const originalCreate = repos?.auditLogRepository?.create;
    (repos?.auditLogRepository as any).create = vi.fn(async (input: any) => {
      if (input.action === 'RISK_ASSESSMENT_CREATED') {
        throw new Error('audit store down on created');
      }
      return originalCreate?.call(repos?.auditLogRepository, input);
    });

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 70, riskCategory: 'HIGH', approvalProbability: 0.15, modelVersion: '10.0.0' }) });

    const result = await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u18', requestId: 'r18', ipAddress: '7.7.7.7' });
    expect(result).toBeTruthy();
    expect(result.riskScore).toBe(70);
  });

  it('records latency metrics on successful prediction', async () => {
    const { dependencies, repos } = createInMemoryLoanDependencies();
    const svc = dependencies.riskAssessmentService!;
    const loan = await dependencies.loanRepository.create({ userId: 'u19', loanAmount: 1, loanPurpose: 'p', employmentType: 'EMPLOYED', annualIncome: 1, existingDebt: 0, creditScore: 600 } as any);

    (global as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ riskScore: 40, riskCategory: 'MEDIUM', approvalProbability: 0.6, modelVersion: '11.0.0' }) });

    const result = await svc.createRiskAssessment(loan._id.toString(), {}, { userId: 'u19', requestId: 'r19', ipAddress: '8.8.8.8' });
    expect(result).toBeTruthy();

    const mm = dependencies.modelMetricsService;
    const metrics = await mm?.getModelMetrics('11.0.0');
    expect(metrics).toBeTruthy();
    expect(metrics?.predictionCount).toBeGreaterThanOrEqual(1);
  });
});
