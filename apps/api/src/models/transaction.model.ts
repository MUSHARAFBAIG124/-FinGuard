import {
  model,
  models,
  Schema,
  Types,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { TransactionStatus, TransactionType } from '@finguard/shared';

import { enumValues } from './schema-helpers';
import { USER_MODEL_NAME } from './user.model';

export const TRANSACTION_MODEL_NAME = 'Transaction';

export const TransactionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: USER_MODEL_NAME,
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'userId must be a valid ObjectId',
      },
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      match: [/^[A-Z]{3}$/, 'currency must be a valid ISO 4217 code'],
    },
    transactionType: {
      type: String,
      required: true,
      enum: enumValues(TransactionType),
    },
    deviceFingerprint: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 256,
    },
    ipAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
    location: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(TransactionStatus),
      default: TransactionStatus.PENDING,
    },
  },
  {
    collection: 'transactions',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

TransactionSchema.index({ userId: 1 }, { name: 'ix_transactions_user_id' });
TransactionSchema.index({ createdAt: -1 }, { name: 'ix_transactions_created_at' });
TransactionSchema.index({ userId: 1, createdAt: -1 }, { name: 'ix_transactions_user_created_at' });

export type Transaction = InferSchemaType<typeof TransactionSchema>;
export type TransactionDocument = HydratedDocument<Transaction>;
export const TransactionModel: Model<Transaction> =
  (models[TRANSACTION_MODEL_NAME] as Model<Transaction> | undefined) ??
  model<Transaction>(TRANSACTION_MODEL_NAME, TransactionSchema);
