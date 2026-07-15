import mongoose, {
  model,
  Schema,
  Types,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { FraudAlertStatus, FraudSeverity } from '@finguard/shared';

import { enumValues } from './schema-helpers';
import { TRANSACTION_MODEL_NAME } from './transaction.model';
import { USER_MODEL_NAME } from './user.model';

export const FRAUD_ALERT_MODEL_NAME = 'FraudAlert';

export const FraudAlertSchema = new mongoose.Schema(
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: USER_MODEL_NAME,
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'userId must be a valid ObjectId',
      },
    },
    fraudScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    severity: {
      type: String,
      required: true,
      enum: enumValues(FraudSeverity),
    },
    ruleTriggers: {
      type: [String],
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(FraudAlertStatus),
      default: FraudAlertStatus.OPEN,
    },
    detectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: USER_MODEL_NAME,
    },
    resolutionReason: {
      type: String,
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
FraudAlertSchema.index({ userId: 1 }, { name: 'ix_fraud_alerts_user_id' });
FraudAlertSchema.index({ status: 1 }, { name: 'ix_fraud_alerts_status' });
FraudAlertSchema.index(
  { status: 1, detectedAt: -1 },
  { name: 'ix_fraud_alerts_status_detected_at' },
);
FraudAlertSchema.index({ severity: 1 }, { name: 'ix_fraud_alerts_severity' });

export type FraudAlert = InferSchemaType<typeof FraudAlertSchema>;
export type FraudAlertDocument = HydratedDocument<FraudAlert>;
export const FraudAlertModel: Model<FraudAlert> =
  (mongoose.models[FRAUD_ALERT_MODEL_NAME] as Model<FraudAlert> | undefined) ??
  mongoose.model<FraudAlert>(FRAUD_ALERT_MODEL_NAME, FraudAlertSchema);
