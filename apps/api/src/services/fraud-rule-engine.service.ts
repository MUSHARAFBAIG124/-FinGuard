import { FraudSeverity } from '@finguard/shared';

export interface FraudCheckContext {
  readonly transactionId: string;
  readonly userId: string;
  readonly amount: number;
  readonly country: string;
  readonly accountAgeDays: number;
  readonly transactionCountLast10Mins: number;
  readonly withdrawalCountLastHour: number;
  readonly isNewDevice: boolean;
  readonly isGeographicallyImpossible: boolean;
  readonly transactionHour: number; // 0-23
}

export interface FraudCheckResult {
  readonly fraudScore: number;
  readonly severity: FraudSeverity;
  readonly ruleTriggers: string[];
}

export class FraudRuleEngineService {
  private readonly APPROVED_COUNTRIES = ['US', 'GB', 'CA', 'DE', 'FR', 'JP', 'AU'];
  private readonly LARGE_TRANSACTION_THRESHOLD = 500000;

  private readonly RULES = [
    {
      id: 'LARGE_TRANSACTION',
      score: 25,
      evaluate: (ctx: FraudCheckContext) => ctx.amount > this.LARGE_TRANSACTION_THRESHOLD,
    },
    {
      id: 'TRANSACTION_VELOCITY',
      score: 20,
      evaluate: (ctx: FraudCheckContext) => ctx.transactionCountLast10Mins > 5,
    },
    {
      id: 'RAPID_WITHDRAWAL_PATTERN',
      score: 15,
      evaluate: (ctx: FraudCheckContext) => ctx.withdrawalCountLastHour > 3,
    },
    {
      id: 'HIGH_RISK_COUNTRY',
      score: 35,
      evaluate: (ctx: FraudCheckContext) => !this.APPROVED_COUNTRIES.includes(ctx.country),
    },
    {
      id: 'SUSPICIOUS_HOURS',
      score: 10,
      evaluate: (ctx: FraudCheckContext) => ctx.transactionHour >= 0 && ctx.transactionHour <= 5,
    },
    {
      id: 'NEW_ACCOUNT_RISK',
      score: 15,
      evaluate: (ctx: FraudCheckContext) => ctx.accountAgeDays < 30,
    },
    {
      id: 'DEVICE_CHANGE',
      score: 15,
      evaluate: (ctx: FraudCheckContext) => ctx.isNewDevice,
    },
    {
      id: 'GEOGRAPHIC_IMPOSSIBILITY',
      score: 40,
      evaluate: (ctx: FraudCheckContext) => ctx.isGeographicallyImpossible,
    },
  ];

  public calculateFraudScore(context: FraudCheckContext): FraudCheckResult {
    let totalScore = 0;
    const triggeredRules: string[] = [];

    for (const rule of this.RULES) {
      if (rule.evaluate(context)) {
        totalScore += rule.score;
        triggeredRules.push(rule.id);
      }
    }

    const finalScore = Math.min(totalScore, 100);
    const severity = this.mapScoreToSeverity(finalScore);

    return {
      fraudScore: finalScore,
      severity,
      ruleTriggers: triggeredRules,
    };
  }

  private mapScoreToSeverity(score: number): FraudSeverity {
    if (score <= 25) return FraudSeverity.LOW;
    if (score <= 50) return FraudSeverity.MEDIUM;
    if (score <= 75) return FraudSeverity.HIGH;
    return FraudSeverity.CRITICAL;
  }
}
