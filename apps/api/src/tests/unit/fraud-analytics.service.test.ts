import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FraudAnalyticsService } from '../../services/fraud-analytics.service';
import { FraudAlertStatus, FraudSeverity } from '@finguard/shared';

describe('FraudAnalyticsService', () => {
  let service: FraudAnalyticsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAlertRepo: any;

  beforeEach(() => {
    mockAlertRepo = {
      listRecent: vi.fn(),
      create: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findOpenAlerts: vi.fn(),
      findCriticalAlerts: vi.fn(),
      updateStatus: vi.fn(),
    };
    service = new FraudAnalyticsService(mockAlertRepo);
  });

  const createAlert = (
    status: FraudAlertStatus,
    severity: FraudSeverity,
    fraudScore: number,
    ruleTriggers: string[] = [],
  ) => ({ status, severity, fraudScore, ruleTriggers }) as any;

  describe('Empty dataset', () => {
    it('should return all zeros and empty rules for empty dataset', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([]);
      const result = await service.getFraudAnalytics();
      expect(result.metrics).toEqual({
        totalAlerts: 0,
        openAlerts: 0,
        criticalAlerts: 0,
        confirmedFraud: 0,
        falsePositives: 0,
        averageFraudScore: 0,
      });
      expect(result.topTriggeredRules).toEqual([]);
    });
  });

  describe('Single severity datasets', () => {
    it('should calculate metrics for only LOW severity alerts', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 10, ['RULE_A']),
        createAlert(FraudAlertStatus.RESOLVED, FraudSeverity.LOW, 20, ['RULE_B']),
      ]);
      const result = await service.getFraudAnalytics();
      expect(result.metrics).toEqual({
        totalAlerts: 2,
        openAlerts: 1,
        criticalAlerts: 0,
        confirmedFraud: 0,
        falsePositives: 0,
        averageFraudScore: 15,
      });
    });

    it('should calculate metrics for only CRITICAL severity alerts', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.CRITICAL, 80),
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.CRITICAL, 90),
        createAlert(FraudAlertStatus.CONFIRMED_FRAUD, FraudSeverity.CRITICAL, 100),
      ]);
      const result = await service.getFraudAnalytics();
      expect(result.metrics).toEqual({
        totalAlerts: 3,
        openAlerts: 2,
        criticalAlerts: 3,
        confirmedFraud: 1,
        falsePositives: 0,
        averageFraudScore: 90,
      });
    });

    it('should count UNDER_REVIEW alerts in total but not as open', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([
        createAlert(FraudAlertStatus.UNDER_REVIEW, FraudSeverity.HIGH, 60),
      ]);
      const result = await service.getFraudAnalytics();
      expect(result.metrics.totalAlerts).toBe(1);
      expect(result.metrics.openAlerts).toBe(0);
    });
  });

  describe('Mixed severity alerts', () => {
    it('should calculate metrics correctly for mixed severity alerts', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 10),
        createAlert(FraudAlertStatus.UNDER_REVIEW, FraudSeverity.MEDIUM, 40),
        createAlert(FraudAlertStatus.CONFIRMED_FRAUD, FraudSeverity.HIGH, 70),
        createAlert(FraudAlertStatus.FALSE_POSITIVE, FraudSeverity.CRITICAL, 90),
      ]);
      const result = await service.getFraudAnalytics();
      expect(result.metrics).toEqual({
        totalAlerts: 4,
        openAlerts: 1,
        criticalAlerts: 1,
        confirmedFraud: 1,
        falsePositives: 1,
        averageFraudScore: 52.5,
      });
    });

    it('should correctly count multiple false positives and confirmed frauds', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([
        createAlert(FraudAlertStatus.CONFIRMED_FRAUD, FraudSeverity.HIGH, 70),
        createAlert(FraudAlertStatus.CONFIRMED_FRAUD, FraudSeverity.CRITICAL, 90),
        createAlert(FraudAlertStatus.FALSE_POSITIVE, FraudSeverity.LOW, 20),
        createAlert(FraudAlertStatus.FALSE_POSITIVE, FraudSeverity.MEDIUM, 40),
        createAlert(FraudAlertStatus.FALSE_POSITIVE, FraudSeverity.LOW, 15),
      ]);
      const result = await service.getFraudAnalytics();
      expect(result.metrics.confirmedFraud).toBe(2);
      expect(result.metrics.falsePositives).toBe(3);
    });

    it('averageFraudScore rounds to 2 decimal places', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 10),
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 20),
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 33),
      ]);
      const result = await service.getFraudAnalytics();
      expect(result.metrics.averageFraudScore).toBe(21); // 63/3 = 21
    });
  });

  describe('Top triggered rules', () => {
    it('should aggregate rule counts correctly', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 10, ['RULE_A']),
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.MEDIUM, 30, ['RULE_A', 'RULE_B']),
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.HIGH, 60, ['RULE_B', 'RULE_C']),
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.CRITICAL, 90, [
          'RULE_A',
          'RULE_C',
          'RULE_D',
        ]),
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.CRITICAL, 90, ['RULE_A']),
      ]);
      const result = await service.getFraudAnalytics();
      expect(result.topTriggeredRules).toEqual([
        { rule: 'RULE_A', count: 4 },
        { rule: 'RULE_B', count: 2 },
        { rule: 'RULE_C', count: 2 },
        { rule: 'RULE_D', count: 1 },
      ]);
    });

    it('should order rules by count descending', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 10, ['RARE_RULE']),
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 10, ['COMMON_RULE', 'COMMON_RULE_2']),
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 10, ['COMMON_RULE', 'COMMON_RULE_2']),
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 10, ['COMMON_RULE']),
      ]);
      const result = await service.getFraudAnalytics();
      // COMMON_RULE: 3, COMMON_RULE_2: 2, RARE_RULE: 1 — deterministic ordering
      expect(result.topTriggeredRules[0]!.rule).toBe('COMMON_RULE');
      expect(result.topTriggeredRules[0]!.count).toBe(3);
      expect(result.topTriggeredRules[1]!.count).toBe(2);
      expect(result.topTriggeredRules[2]!.rule).toBe('RARE_RULE');
      expect(result.topTriggeredRules[2]!.count).toBe(1);
    });

    it('should return empty topTriggeredRules when no rules are triggered', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 0, []),
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 0, []),
      ]);
      const result = await service.getFraudAnalytics();
      expect(result.topTriggeredRules).toEqual([]);
    });

    it('should limit to top 10 rules', async () => {
      const rules = Array.from({ length: 15 }, (_, i) => `RULE_${i}`);
      const alerts = rules.map((rule) =>
        createAlert(FraudAlertStatus.OPEN, FraudSeverity.LOW, 10, [rule]),
      );
      mockAlertRepo.listRecent.mockResolvedValue(alerts);
      const result = await service.getFraudAnalytics();
      expect(result.topTriggeredRules.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Large datasets', () => {
    it('should perform correctly for large datasets (1000 alerts)', async () => {
      const alerts = Array.from({ length: 1000 }, (_, i) =>
        createAlert(
          i % 2 === 0 ? FraudAlertStatus.OPEN : FraudAlertStatus.CONFIRMED_FRAUD,
          i % 10 === 0 ? FraudSeverity.CRITICAL : FraudSeverity.MEDIUM,
          50,
          ['RULE_LARGE'],
        ),
      );
      mockAlertRepo.listRecent.mockResolvedValue(alerts);
      const result = await service.getFraudAnalytics();
      expect(result.metrics.totalAlerts).toBe(1000);
      expect(result.metrics.openAlerts).toBe(500);
      expect(result.metrics.confirmedFraud).toBe(500);
      expect(result.metrics.criticalAlerts).toBe(100);
      expect(result.metrics.averageFraudScore).toBe(50);
      expect(result.topTriggeredRules).toEqual([{ rule: 'RULE_LARGE', count: 1000 }]);
    });

    it('should call listRecent with limit 1000', async () => {
      mockAlertRepo.listRecent.mockResolvedValue([]);
      await service.getFraudAnalytics();
      expect(mockAlertRepo.listRecent).toHaveBeenCalledWith(1000);
    });
  });

  describe('Error handling', () => {
    it('should propagate repository errors', async () => {
      mockAlertRepo.listRecent.mockRejectedValue(new Error('DB error'));
      await expect(service.getFraudAnalytics()).rejects.toThrow('DB error');
    });
  });
});
