import type { FraudRecommendedAction, FraudSeverity, FraudStatus } from '@finguard/shared';

import type { FraudAlertDocument } from '../models/fraud-alert.model';

export interface CreateFraudAlertInput {
  readonly transactionId: string;
  readonly fraudProbability: number;
  readonly severity: FraudSeverity;
  readonly recommendedAction: FraudRecommendedAction;
  readonly status?: FraudStatus;
}

export interface FraudAlertRepository {
  create(input: CreateFraudAlertInput): Promise<FraudAlertDocument>;
  findById(id: string): Promise<FraudAlertDocument | null>;
  findByTransactionId(transactionId: string): Promise<FraudAlertDocument | null>;
  findByStatus(status: FraudStatus): Promise<readonly FraudAlertDocument[]>;
}
