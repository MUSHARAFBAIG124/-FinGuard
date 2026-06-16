import type { TransactionStatus, TransactionType } from '@finguard/shared';

import type { TransactionDocument } from '../models/transaction.model';

export interface CreateTransactionInput {
  readonly userId: string;
  readonly amount: number;
  readonly currency: string;
  readonly transactionType: TransactionType;
  readonly deviceFingerprint: string;
  readonly ipAddress: string;
  readonly location: string;
  readonly status?: TransactionStatus;
}

export interface TransactionRepository {
  create(input: CreateTransactionInput): Promise<TransactionDocument>;
  findById(id: string): Promise<TransactionDocument | null>;
  findByUserId(userId: string): Promise<readonly TransactionDocument[]>;
  findRecentByUserId(userId: string, limit: number): Promise<readonly TransactionDocument[]>;
}
