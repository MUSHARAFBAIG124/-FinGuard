import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GovernanceAnalyticsService } from '../../services/governance-analytics.service';
import { ModelAnalyticsController } from '../../controllers/model-analytics.controller';
import { ModelStatus, DriftLevel } from '@finguard/shared';

describe('GovernanceAnalyticsService', () => {
  let service: GovernanceAnalyticsService;
  let registryRepo: any;
  let driftRepo: any;
  let auditRepo: any;

  beforeEach(() => {
    registryRepo = {
      listAll: vi.fn(),
      findByStatus: vi.fn(),
    };
    driftRepo = {
      listRecent: vi.fn().mockResolvedValue([]),
      countSince: vi.fn().mockResolvedValue(0),
      countByDriftLevel: vi.fn(),
    };
    auditRepo = {
      create: vi.fn(),
    };
    service = new GovernanceAnalyticsService(registryRepo, driftRepo, auditRepo);
  });

  it('should calculate model statistics correctly', async () => {
    registryRepo.listAll.mockResolvedValue([
      { status: ModelStatus.APPROVED },
      { status: ModelStatus.APPROVED },
      { status: ModelStatus.REJECTED },
      { status: ModelStatus.RETIRED },
    ]);

    const stats = await service.getModelStatistics();
    expect(stats).toEqual({
      totalModels: 4,
      approvedModels: 2,
      rejectedModels: 1,
      retiredModels: 1,
      activeModels: 2,
    });
  });

  it('should calculate performance analytics for approved models', async () => {
    registryRepo.findByStatus.mockResolvedValue([
      { accuracy: 0.8, precision: 0.7, recall: 0.9, f1Score: 0.8, rocAuc: 0.85 },
      { accuracy: 0.9, precision: 0.8, recall: 0.8, f1Score: 0.85, rocAuc: 0.95 },
    ]);

    const perf = await service.getPerformanceAnalytics();
    expect(perf.averageAccuracy).toBe(0.85);
    expect(perf.averageF1).toBe(0.825);
  });

  it('should calculate drift statistics and identify top drifted features', async () => {
    driftRepo.listRecent.mockResolvedValue([
      { featureName: 'age', driftLevel: DriftLevel.CRITICAL },
      { featureName: 'age', driftLevel: DriftLevel.CRITICAL },
      { featureName: 'income', driftLevel: DriftLevel.CRITICAL },
      { featureName: 'income', driftLevel: DriftLevel.LOW },
      { featureName: 'loanAmount', driftLevel: DriftLevel.HIGH },
    ]);

    const stats = await service.getDriftStatistics();
    expect(stats.criticalDriftEvents).toBe(3);
    expect(stats.highDriftEvents).toBe(1);
    expect(stats.lowDriftEvents).toBe(1);
    expect(stats.topDriftedFeatures[0]).toEqual({ feature: 'age', criticalEvents: 2 });
  });

  it('should calculate drift trends for various windows', async () => {
    driftRepo.countSince
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(100);

    const trends = await service.getTrendAnalytics();
    expect(trends.last7Days).toBe(10);
    expect(trends.last30Days).toBe(40);
    expect(trends.last90Days).toBe(100);
  });

  it('should calculate governance health score based on penalties', async () => {
    registryRepo.listAll.mockResolvedValue([
      { status: ModelStatus.REJECTED },
      { status: ModelStatus.REJECTED }, // -10
    ]);
    driftRepo.listRecent.mockResolvedValue([
      { driftLevel: DriftLevel.CRITICAL }, // -10
      { driftLevel: DriftLevel.CRITICAL }, // -10
      { driftLevel: DriftLevel.HIGH },     // -2
    ]);

    const health = await service.calculateGovernanceHealthScore();
    // 100 - 10 (rejected) - 20 (critical) - 2 (high) = 68
    expect(health.governanceHealthScore).toBe(68);
  });

  it('should clamp health score between 0 and 100', async () => {
    registryRepo.listAll.mockResolvedValue(new Array(30).fill({ status: ModelStatus.REJECTED }));
    const health = await service.calculateGovernanceHealthScore();
    expect(health.governanceHealthScore).toBe(0);
  });
});

describe('ModelAnalyticsController', () => {
  let controller: ModelAnalyticsController;
  let service: GovernanceAnalyticsService;

  beforeEach(() => {
    service = {
      getGovernanceSummary: vi.fn(),
      getModelStatistics: vi.fn(),
      getDriftStatistics: vi.fn(),
      calculateGovernanceHealthScore: vi.fn(),
      logAnalyticsView: vi.fn(),
    } as unknown as GovernanceAnalyticsService;
    controller = new ModelAnalyticsController(service);
  });

  it('should return summary and log view', async () => {
    const mockReq = { user: { id: 'admin1' }, headers: { 'x-request-id': 'req1' } };
    const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    
    vi.mocked(service.getGovernanceSummary).mockResolvedValue({} as any);

    await controller.getSummary(mockReq as any, mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(service.logAnalyticsView).toHaveBeenCalledWith('admin1', '/analytics/summary', 'req1');
  });
});
