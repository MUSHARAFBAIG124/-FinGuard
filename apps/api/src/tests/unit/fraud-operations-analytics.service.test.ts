import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FraudOperationsAnalyticsService } from '../../services/fraud-operations-analytics.service';
import { FraudCaseStatus } from '@finguard/shared';

describe('FraudOperationsAnalyticsService', () => {
  let analyticsService: FraudOperationsAnalyticsService;
  let mockCaseRepo: any;
  let mockSlaService: any;

  beforeEach(() => {
    mockCaseRepo = {
      countCases: vi.fn(),
      getMetrics: vi.fn(),
    };
    mockSlaService = {
      getBreachedCases: vi.fn(),
    };

    analyticsService = new FraudOperationsAnalyticsService(mockCaseRepo, mockSlaService);
  });

  describe('getDashboardMetrics', () => {
    it('should aggregate metrics from repositories', async () => {
      mockCaseRepo.countCases.mockImplementation((filters: any) => {
        if (!filters) return 100; // total
        if (filters.status === FraudCaseStatus.OPEN) return 20;
        if (filters.status === FraudCaseStatus.ASSIGNED) return 30;
        if (filters.status === FraudCaseStatus.ESCALATED) return 10;
        if (filters.status === FraudCaseStatus.RESOLVED) return 25;
        if (filters.status === FraudCaseStatus.CLOSED) return 15;
        return 0;
      });

      mockSlaService.getBreachedCases.mockResolvedValue([{}, {}, {}, {}, {}]); // 5 breached

      const metrics = await analyticsService.getDashboardMetrics();

      expect(metrics.totalCases).toBe(100);
      expect(metrics.openCases).toBe(20);
      expect(metrics.escalatedCases).toBe(10);
      expect(metrics.slaBreaches).toBe(5);
      expect(metrics.escalationRate).toBe(10); // 10 / 100 * 100
      expect(metrics.slaComplianceRate).toBe(95); // (100 - 5) / 100 * 100
    });
  });

  describe('getPriorityDistribution', () => {
    it('should calculate priority distribution', async () => {
      mockCaseRepo.getMetrics.mockResolvedValue([
        {
          priorities: [
            { _id: 'LOW', count: 50 },
            { _id: 'MEDIUM', count: 30 },
            { _id: 'HIGH', count: 15 },
            { _id: 'CRITICAL', count: 5 },
          ],
        },
      ]);

      const dist = await analyticsService.getPriorityDistribution();
      expect(dist).toEqual({
        low: 50,
        medium: 30,
        high: 15,
        critical: 5,
      });
    });
  });
});
