import {
  model,
  models,
  Schema,
  Types,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { FraudRecommendedAction, FraudSeverity, FraudStatus } from '@finguard/shared';

import { enumValues } from './schema-helpers';
import { TRANSACTION_MODEL_NAME } from './transaction.model';

export const FRAUD_ALERT_MODEL_NAME = 'FraudAlert';

export const FraudAlertSchema = new Schema(
  {
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: TRANSACTION_MODEL_NAME,
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'transactionId must be a valid ObjectId',
      },
    },
    fraudProbability: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    severity: {
      type: String,
      required: true,
      enum: enumValues(FraudSeverity),
    },
    recommendedAction: {
      type: String,
      required: true,
      enum: enumValues(FraudRecommendedAction),
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(FraudStatus),
      default: FraudStatus.OPEN,
    },
  },
  {
    collection: 'fraud_alerts',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

FraudAlertSchema.index({ transactionId: 1 }, { name: 'ix_fraud_alerts_transaction_id' });
FraudAlertSchema.index({ status: 1 }, { name: 'ix_fraud_alerts_status' });
FraudAlertSchema.index({ status: 1, createdAt: -1 }, { name: 'ix_fraud_alerts_status_created_at' });

export type FraudAlert = InferSchemaType<typeof FraudAlertSchema>;
export type FraudAlertDocument = HydratedDocument<FraudAlert>;
export const FraudAlertModel: Model<FraudAlert> =
  (models[FRAUD_ALERT_MODEL_NAME] as Model<FraudAlert> | undefined) ??
  model<FraudAlert>(FRAUD_ALERT_MODEL_NAME, FraudAlertSchema);
