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
      listCases: vi.fn().mockResolvedValue([]),
    };
    mockSlaService = {
      getBreachedCases: vi.fn().mockResolvedValue([]),
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
      mockCaseRepo.listCases.mockResolvedValue([
        {
          createdAt: '2026-01-01T00:00:00.000Z',
          assignedAt: '2026-01-01T01:00:00.000Z',
          resolvedAt: '2026-01-02T00:00:00.000Z',
          assignedTo: 'investigator-1',
          status: FraudCaseStatus.RESOLVED,
        },
      ]);

      const metrics = await analyticsService.getDashboardMetrics();

      expect(metrics.totalCases).toBe(100);
      expect(metrics.openCases).toBe(20);
      expect(metrics.escalatedCases).toBe(10);
      expect(metrics.slaBreaches).toBe(5);
      expect(metrics.escalationRate).toBe(10); // 10 / 100 * 100
      expect(metrics.slaComplianceRate).toBe(95); // (100 - 5) / 100 * 100
      expect(metrics.averageAssignmentTime).toBe(1);
      expect(metrics.averageResolutionTime).toBe(24);
      expect(metrics).not.toHaveProperty('falsePositiveRate');
    });

    it('returns null for time metrics when there is no recorded timing data', async () => {
      mockCaseRepo.countCases.mockResolvedValue(0);
      const metrics = await analyticsService.getDashboardMetrics();

      expect(metrics.averageAssignmentTime).toBeNull();
      expect(metrics.averageResolutionTime).toBeNull();
      expect(metrics.slaComplianceRate).toBe(100);
      expect(
        Object.values(metrics)
          .filter((value) => typeof value === 'number')
          .every(Number.isFinite),
      ).toBe(true);
    });

    it('calculates averages for one valid case without dividing by zero', async () => {
      mockCaseRepo.countCases.mockImplementation((filters?: { status?: FraudCaseStatus }) =>
        Promise.resolve(!filters || filters.status === FraudCaseStatus.RESOLVED ? 1 : 0),
      );
      mockCaseRepo.listCases.mockResolvedValue([
        {
          status: FraudCaseStatus.RESOLVED,
          createdAt: '2026-01-01T00:00:00.000Z',
          assignedAt: '2026-01-01T02:00:00.000Z',
          resolvedAt: '2026-01-01T08:00:00.000Z',
        },
      ]);

      const metrics = await analyticsService.getDashboardMetrics();

      expect(metrics.totalCases).toBe(1);
      expect(metrics.averageAssignmentTime).toBe(2);
      expect(metrics.averageResolutionTime).toBe(8);
    });

    it('calculates timing and SLA metrics from realistic seeded case timestamps', async () => {
      const cases = [
        {
          status: FraudCaseStatus.RESOLVED,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          assignedAt: new Date('2026-01-01T02:00:00.000Z'),
          resolvedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
        {
          status: FraudCaseStatus.OPEN,
          createdAt: new Date('2026-01-02T00:00:00.000Z'),
          assignedAt: undefined,
          resolvedAt: undefined,
        },
      ];
      mockCaseRepo.countCases.mockImplementation((filters?: { status?: FraudCaseStatus }) => {
        if (!filters) return Promise.resolve(2);
        if (filters.status === FraudCaseStatus.RESOLVED) return Promise.resolve(1);
        if (filters.status === FraudCaseStatus.OPEN) return Promise.resolve(1);
        return Promise.resolve(0);
      });
      mockCaseRepo.listCases.mockResolvedValue(cases);
      mockSlaService.getBreachedCases.mockResolvedValue([]);

      const metrics = await analyticsService.getDashboardMetrics();

      // Expected by hand: assignment = 2h; resolution = midnight-to-next-midnight = 24h.
      expect(metrics.averageAssignmentTime).toBe(2);
      expect(metrics.averageResolutionTime).toBe(24);
      expect(metrics.totalCases).toBe(2);
      expect(metrics.resolvedCases).toBe(1);
      expect(metrics.slaBreaches).toBe(0);
      expect(metrics.slaComplianceRate).toBe(100);
    });

    it('ignores missing, invalid, and reversed timestamps instead of returning NaN', async () => {
      mockCaseRepo.listCases.mockResolvedValue([
        {
          assignedTo: 'investigator-1',
          status: FraudCaseStatus.RESOLVED,
          createdAt: 'not-a-date',
          assignedAt: '2026-01-01T01:00:00.000Z',
          resolvedAt: 'also-not-a-date',
        },
        {
          assignedTo: 'investigator-1',
          status: FraudCaseStatus.RESOLVED,
          assignedAt: '2026-01-01T01:00:00.000Z',
          resolvedAt: '2025-12-31T23:00:00.000Z',
        },
      ]);

      const dashboard = await analyticsService.getDashboardMetrics();
      const investigators = await analyticsService.getInvestigatorMetrics();

      expect(dashboard.averageAssignmentTime).toBeNull();
      expect(dashboard.averageResolutionTime).toBeNull();
      expect(investigators[0]?.resolvedCases).toBe(2);
      expect(investigators[0]?.averageResolutionTime).toBeNull();
      expect(
        Object.values(dashboard)
          .filter((value) => typeof value === 'number')
          .every(Number.isFinite),
      ).toBe(true);
    });
  });

  describe('getInvestigatorMetrics', () => {
    it('groups persisted cases by investigator and calculates measured metrics', async () => {
      mockCaseRepo.listCases.mockResolvedValue([
        {
          assignedTo: 'investigator-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          resolvedAt: '2026-01-01T08:00:00.000Z',
          status: FraudCaseStatus.RESOLVED,
        },
        {
          assignedTo: 'investigator-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          status: FraudCaseStatus.ESCALATED,
        },
        { status: FraudCaseStatus.OPEN },
      ]);

      await expect(analyticsService.getInvestigatorMetrics()).resolves.toEqual([
        {
          investigatorId: 'investigator-1',
          assignedCases: 2,
          resolvedCases: 1,
          averageResolutionTime: 8,
          escalationRate: 50,
        },
      ]);
    });

    it('keeps open cases out of resolved counts and shows no resolution time', async () => {
      mockCaseRepo.listCases.mockResolvedValue([
        {
          assignedTo: 'investigator-open',
          status: FraudCaseStatus.OPEN,
          createdAt: '2026-01-01T00:00:00.000Z',
          assignedAt: '2026-01-01T01:00:00.000Z',
        },
      ]);

      await expect(analyticsService.getInvestigatorMetrics()).resolves.toEqual([
        {
          investigatorId: 'investigator-open',
          assignedCases: 1,
          resolvedCases: 0,
          averageResolutionTime: null,
          escalationRate: 0,
        },
      ]);
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
