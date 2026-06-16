import { describe, expect, it } from 'vitest';

import {
  API_PREFIX,
  EmploymentType,
  FraudSeverity,
  FraudRecommendedAction,
  FraudStatus,
  LoanStatus,
  RiskCategory,
  TransactionStatus,
  TransactionType,
  UserRole,
  UserStatus,
} from './index';

describe('shared domain contracts', () => {
  it('defines banking roles used by API and web workspaces', () => {
    expect(Object.values(UserRole)).toEqual(['CUSTOMER', 'LOAN_OFFICER', 'RISK_ANALYST', 'ADMIN']);
  });

  it('defines database domain states required by Phase 3', () => {
    expect(UserStatus.SUSPENDED).toBe('SUSPENDED');
    expect(LoanStatus.UNDER_REVIEW).toBe('UNDER_REVIEW');
    expect(RiskCategory.HIGH).toBe('HIGH');
    expect(TransactionStatus.FLAGGED).toBe('FLAGGED');
    expect(FraudStatus.FALSE_POSITIVE).toBe('FALSE_POSITIVE');
  });

  it('defines supporting enum values used by schema validation', () => {
    expect(EmploymentType.SELF_EMPLOYED).toBe('SELF_EMPLOYED');
    expect(TransactionType.TRANSFER).toBe('TRANSFER');
    expect(FraudSeverity.CRITICAL).toBe('CRITICAL');
    expect(FraudRecommendedAction.STEP_UP_AUTHENTICATION).toBe('STEP_UP_AUTHENTICATION');
  });

  it('uses a versioned API prefix', () => {
    expect(API_PREFIX).toBe('/api/v1');
  });
});
