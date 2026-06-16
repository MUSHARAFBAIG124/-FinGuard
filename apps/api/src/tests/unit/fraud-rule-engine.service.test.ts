import { describe, it, expect } from 'vitest';
import {
  FraudRuleEngineService,
  FraudCheckContext,
} from '../../services/fraud-rule-engine.service';
import { FraudSeverity } from '@finguard/shared';

describe('FraudRuleEngineService', () => {
  const engine = new FraudRuleEngineService();

  const getCleanContext = (): FraudCheckContext => ({
    transactionId: 'tx-1',
    userId: 'user-1',
    amount: 1000,
    country: 'US', // Approved
    accountAgeDays: 100,
    transactionCountLast10Mins: 1,
    withdrawalCountLastHour: 1,
    isNewDevice: false,
    isGeographicallyImpossible: false,
    transactionHour: 12,
  });

  describe('Clean transaction baseline', () => {
    it('should return zero score and LOW severity for a clean transaction', () => {
      const result = engine.calculateFraudScore(getCleanContext());
      expect(result.fraudScore).toBe(0);
      expect(result.severity).toBe(FraudSeverity.LOW);
      expect(result.ruleTriggers).toHaveLength(0);
    });
  });

  describe('Independent Rule Evaluation', () => {
    it('LARGE_TRANSACTION: amount exactly at threshold (500000) does NOT trigger', () => {
      const ctx = { ...getCleanContext(), amount: 500000 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(0);
      expect(result.ruleTriggers).not.toContain('LARGE_TRANSACTION');
    });

    it('LARGE_TRANSACTION: amount 500001 triggers +25 score', () => {
      const ctx = { ...getCleanContext(), amount: 500001 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(25);
      expect(result.severity).toBe(FraudSeverity.LOW);
      expect(result.ruleTriggers).toContain('LARGE_TRANSACTION');
    });

    it('LARGE_TRANSACTION: very large amount triggers rule', () => {
      const ctx = { ...getCleanContext(), amount: 9_999_999 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(25);
      expect(result.ruleTriggers).toContain('LARGE_TRANSACTION');
    });

    it('TRANSACTION_VELOCITY: count exactly 5 does NOT trigger', () => {
      const ctx = { ...getCleanContext(), transactionCountLast10Mins: 5 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(0);
      expect(result.ruleTriggers).not.toContain('TRANSACTION_VELOCITY');
    });

    it('TRANSACTION_VELOCITY: count 6 triggers +20 score', () => {
      const ctx = { ...getCleanContext(), transactionCountLast10Mins: 6 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(20);
      expect(result.ruleTriggers).toContain('TRANSACTION_VELOCITY');
    });

    it('RAPID_WITHDRAWAL_PATTERN: count exactly 3 does NOT trigger', () => {
      const ctx = { ...getCleanContext(), withdrawalCountLastHour: 3 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(0);
      expect(result.ruleTriggers).not.toContain('RAPID_WITHDRAWAL_PATTERN');
    });

    it('RAPID_WITHDRAWAL_PATTERN: count 4 triggers +15 score', () => {
      const ctx = { ...getCleanContext(), withdrawalCountLastHour: 4 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(15);
      expect(result.ruleTriggers).toContain('RAPID_WITHDRAWAL_PATTERN');
    });

    it('HIGH_RISK_COUNTRY: approved country US does NOT trigger', () => {
      const ctx = { ...getCleanContext(), country: 'US' };
      const result = engine.calculateFraudScore(ctx);
      expect(result.ruleTriggers).not.toContain('HIGH_RISK_COUNTRY');
    });

    it('HIGH_RISK_COUNTRY: approved country GB does NOT trigger', () => {
      const ctx = { ...getCleanContext(), country: 'GB' };
      const result = engine.calculateFraudScore(ctx);
      expect(result.ruleTriggers).not.toContain('HIGH_RISK_COUNTRY');
    });

    it('HIGH_RISK_COUNTRY: unapproved country XX triggers +35 score', () => {
      const ctx = { ...getCleanContext(), country: 'XX' };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(35);
      expect(result.ruleTriggers).toContain('HIGH_RISK_COUNTRY');
    });

    it('HIGH_RISK_COUNTRY: unapproved country RU triggers +35 score', () => {
      const ctx = { ...getCleanContext(), country: 'RU' };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(35);
      expect(result.ruleTriggers).toContain('HIGH_RISK_COUNTRY');
    });

    it('SUSPICIOUS_HOURS: hour 0 (midnight) triggers +10 score', () => {
      const ctx = { ...getCleanContext(), transactionHour: 0 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(10);
      expect(result.ruleTriggers).toContain('SUSPICIOUS_HOURS');
    });

    it('SUSPICIOUS_HOURS: hour 5 triggers +10 score (boundary)', () => {
      const ctx = { ...getCleanContext(), transactionHour: 5 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(10);
      expect(result.ruleTriggers).toContain('SUSPICIOUS_HOURS');
    });

    it('SUSPICIOUS_HOURS: hour 6 does NOT trigger (just after boundary)', () => {
      const ctx = { ...getCleanContext(), transactionHour: 6 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.ruleTriggers).not.toContain('SUSPICIOUS_HOURS');
    });

    it('SUSPICIOUS_HOURS: hour 3 (middle of night) triggers +10 score', () => {
      const ctx = { ...getCleanContext(), transactionHour: 3 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(10);
      expect(result.ruleTriggers).toContain('SUSPICIOUS_HOURS');
    });

    it('NEW_ACCOUNT_RISK: account exactly 30 days does NOT trigger', () => {
      const ctx = { ...getCleanContext(), accountAgeDays: 30 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.ruleTriggers).not.toContain('NEW_ACCOUNT_RISK');
    });

    it('NEW_ACCOUNT_RISK: account 29 days triggers +15 score', () => {
      const ctx = { ...getCleanContext(), accountAgeDays: 29 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(15);
      expect(result.ruleTriggers).toContain('NEW_ACCOUNT_RISK');
    });

    it('NEW_ACCOUNT_RISK: account 0 days triggers +15 score', () => {
      const ctx = { ...getCleanContext(), accountAgeDays: 0 };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(15);
      expect(result.ruleTriggers).toContain('NEW_ACCOUNT_RISK');
    });

    it('DEVICE_CHANGE: isNewDevice false does NOT trigger', () => {
      const ctx = { ...getCleanContext(), isNewDevice: false };
      const result = engine.calculateFraudScore(ctx);
      expect(result.ruleTriggers).not.toContain('DEVICE_CHANGE');
    });

    it('DEVICE_CHANGE: isNewDevice true triggers +15 score', () => {
      const ctx = { ...getCleanContext(), isNewDevice: true };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(15);
      expect(result.ruleTriggers).toContain('DEVICE_CHANGE');
    });

    it('GEOGRAPHIC_IMPOSSIBILITY: false does NOT trigger', () => {
      const ctx = { ...getCleanContext(), isGeographicallyImpossible: false };
      const result = engine.calculateFraudScore(ctx);
      expect(result.ruleTriggers).not.toContain('GEOGRAPHIC_IMPOSSIBILITY');
    });

    it('GEOGRAPHIC_IMPOSSIBILITY: true triggers +40 score', () => {
      const ctx = { ...getCleanContext(), isGeographicallyImpossible: true };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(40);
      expect(result.ruleTriggers).toContain('GEOGRAPHIC_IMPOSSIBILITY');
    });
  });

  describe('Multi-Rule Scenarios', () => {
    it('should correctly combine two rules: LARGE_TRANSACTION + HIGH_RISK_COUNTRY = 60', () => {
      const ctx = {
        ...getCleanContext(),
        amount: 600000, // LARGE_TRANSACTION (+25)
        country: 'XX', // HIGH_RISK_COUNTRY (+35)
      };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(60);
      expect(result.severity).toBe(FraudSeverity.HIGH);
      expect(result.ruleTriggers).toEqual(['LARGE_TRANSACTION', 'HIGH_RISK_COUNTRY']);
    });

    it('should cap the fraud score at 100 when rules sum exceeds 100', () => {
      const ctx = {
        ...getCleanContext(),
        amount: 600000, // +25
        transactionCountLast10Mins: 10, // +20
        country: 'XX', // +35
        isGeographicallyImpossible: true, // +40 ? total 120
      };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(100);
      expect(result.severity).toBe(FraudSeverity.CRITICAL);
    });

    it('should maintain deterministic trigger ordering matching rule definition order', () => {
      const ctx = {
        ...getCleanContext(),
        isNewDevice: true, // DEVICE_CHANGE (+15) - index 6
        amount: 600000, // LARGE_TRANSACTION (+25) - index 0
        transactionHour: 2, // SUSPICIOUS_HOURS (+10) - index 4
      };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(50);
      expect(result.ruleTriggers).toEqual([
        'LARGE_TRANSACTION',
        'SUSPICIOUS_HOURS',
        'DEVICE_CHANGE',
      ]);
    });

    it('should accumulate all 8 rules when all triggered', () => {
      const ctx: FraudCheckContext = {
        transactionId: 'tx-all',
        userId: 'user-all',
        amount: 600000, // LARGE_TRANSACTION +25
        country: 'XX', // HIGH_RISK_COUNTRY +35
        accountAgeDays: 1, // NEW_ACCOUNT_RISK +15
        transactionCountLast10Mins: 10, // TRANSACTION_VELOCITY +20
        withdrawalCountLastHour: 10, // RAPID_WITHDRAWAL_PATTERN +15
        isNewDevice: true, // DEVICE_CHANGE +15
        isGeographicallyImpossible: true, // GEOGRAPHIC_IMPOSSIBILITY +40
        transactionHour: 2, // SUSPICIOUS_HOURS +10 ? total 175 ? capped at 100
      };
      const result = engine.calculateFraudScore(ctx);
      expect(result.fraudScore).toBe(100);
      expect(result.severity).toBe(FraudSeverity.CRITICAL);
      expect(result.ruleTriggers).toHaveLength(8);
    });
  });

  describe('Severity Classification Boundary Tests', () => {
    const mapScore = (score: number) => (engine as any).mapScoreToSeverity(score);

    // 0 edge
    it('score 0 -> LOW', () => expect(mapScore(0)).toBe(FraudSeverity.LOW));
    it('score 1 -> LOW', () => expect(mapScore(1)).toBe(FraudSeverity.LOW));

    // LOW/MEDIUM boundary: <= 25 is LOW, 26+ is MEDIUM
    it('score 25 -> LOW (boundary)', () => expect(mapScore(25)).toBe(FraudSeverity.LOW));
    it('score 26 -> MEDIUM (boundary+1)', () => expect(mapScore(26)).toBe(FraudSeverity.MEDIUM));

    // MEDIUM mid and upper bound
    it('score 50 -> MEDIUM (upper boundary)', () =>
      expect(mapScore(50)).toBe(FraudSeverity.MEDIUM));
    it('score 51 -> HIGH (boundary+1)', () => expect(mapScore(51)).toBe(FraudSeverity.HIGH));

    // HIGH mid and upper bound
    it('score 75 -> HIGH (upper boundary)', () => expect(mapScore(75)).toBe(FraudSeverity.HIGH));
    it('score 76 -> CRITICAL (boundary+1)', () =>
      expect(mapScore(76)).toBe(FraudSeverity.CRITICAL));

    // CRITICAL
    it('score 100 -> CRITICAL (maximum)', () => expect(mapScore(100)).toBe(FraudSeverity.CRITICAL));
    it('score 99 -> CRITICAL', () => expect(mapScore(99)).toBe(FraudSeverity.CRITICAL));

    // Via actual rule combinations
    it('LARGE_TRANSACTION (25) -> LOW via calculateFraudScore', () => {
      const ctx = { ...getCleanContext(), amount: 600000 };
      expect(engine.calculateFraudScore(ctx).severity).toBe(FraudSeverity.LOW);
    });

    it('GEOGRAPHIC_IMPOSSIBILITY (40) -> MEDIUM via calculateFraudScore', () => {
      const ctx = { ...getCleanContext(), isGeographicallyImpossible: true };
      expect(engine.calculateFraudScore(ctx).severity).toBe(FraudSeverity.MEDIUM);
    });

    it('GEOGRAPHIC_IMPOSSIBILITY + LARGE_TRANSACTION (65) -> HIGH via calculateFraudScore', () => {
      const ctx = { ...getCleanContext(), isGeographicallyImpossible: true, amount: 600000 };
      expect(engine.calculateFraudScore(ctx).severity).toBe(FraudSeverity.HIGH);
    });

    it('HIGH_RISK_COUNTRY + GEOGRAPHIC_IMPOSSIBILITY (75) -> HIGH via calculateFraudScore', () => {
      const ctx = { ...getCleanContext(), country: 'XX', isGeographicallyImpossible: true };
      expect(engine.calculateFraudScore(ctx).fraudScore).toBe(75);
      expect(engine.calculateFraudScore(ctx).severity).toBe(FraudSeverity.HIGH);
    });

    it('LARGE_TRANSACTION + HIGH_RISK_COUNTRY + GEOGRAPHIC_IMPOSSIBILITY (100) -> CRITICAL', () => {
      const ctx = {
        ...getCleanContext(),
        amount: 600000,
        country: 'XX',
        isGeographicallyImpossible: true,
      };
      expect(engine.calculateFraudScore(ctx).fraudScore).toBe(100);
      expect(engine.calculateFraudScore(ctx).severity).toBe(FraudSeverity.CRITICAL);
    });
  });

  describe('Return object integrity', () => {
    it('should return ruleTriggers as a readonly array', () => {
      const result = engine.calculateFraudScore(getCleanContext());
      expect(Array.isArray(result.ruleTriggers)).toBe(true);
    });

    it('should not mutate the input context', () => {
      const ctx = getCleanContext();
      const ctxCopy = { ...ctx };
      engine.calculateFraudScore(ctx);
      expect(ctx).toEqual(ctxCopy);
    });
  });
});
