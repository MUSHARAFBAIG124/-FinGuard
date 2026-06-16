import { FraudAlertRepository } from '../repositories/fraud-alert.repository';
import { FraudAlertStatus } from '@finguard/shared';

export interface FraudMetrics {
  readonly totalAlerts: number;
  readonly openAlerts: number;
  readonly criticalAlerts: number;
  readonly confirmedFraud: number;
  readonly falsePositives: number;
  readonly averageFraudScore: number;
}

export interface RuleTriggerCount {
  readonly rule: string;
  readonly count: number;
}

export interface FraudAnalyticsResult {
  readonly metrics: FraudMetrics;
  readonly topTriggeredRules: readonly RuleTriggerCount[];
}

export class FraudAnalyticsService {
  constructor(private readonly alertRepo: FraudAlertRepository) {}

  async getFraudAnalytics(): Promise<FraudAnalyticsResult> {
    const allAlerts = await this.alertRepo.listRecent(1000); // Simplified for now

    const totalAlerts = allAlerts.length;
    const openAlerts = allAlerts.filter((a) => a.status === FraudAlertStatus.OPEN).length;
    const criticalAlerts = allAlerts.filter((a) => a.severity === 'CRITICAL').length; // Using string since severity is enum
    const confirmedFraud = allAlerts.filter(
      (a) => a.status === FraudAlertStatus.CONFIRMED_FRAUD,
    ).length;
    const falsePositives = allAlerts.filter(
      (a) => a.status === FraudAlertStatus.FALSE_POSITIVE,
    ).length;

    const avgScore =
      totalAlerts > 0 ? allAlerts.reduce((sum, a) => sum + a.fraudScore, 0) / totalAlerts : 0;

    const ruleCounts: Record<string, number> = {};
    allAlerts.forEach((a) => {
      a.ruleTriggers.forEach((rule) => {
        ruleCounts[rule] = (ruleCounts[rule] || 0) + 1;
      });
    });

    const topTriggeredRules = Object.entries(ruleCounts)
      .map(([rule, count]) => ({ rule, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      metrics: {
        totalAlerts,
        openAlerts,
        criticalAlerts,
        confirmedFraud,
        falsePositives,
        averageFraudScore: Math.round(avgScore * 100) / 100,
      },
      topTriggeredRules: topTriggeredRules,
    };
  }
}
