import {
  model,
  models,
  Schema,
  Types,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { FraudAlertStatus, FraudInvestigationAction } from '@finguard/shared';

import { enumValues } from './schema-helpers';
import { FRAUD_ALERT_MODEL_NAME } from './fraud-alert.model';
import { USER_MODEL_NAME } from './user.model';

export const FRAUD_INVESTIGATION_MODEL_NAME = 'FraudInvestigation';

export const FraudInvestigationSchema = new Schema(
  {
    fraudAlertId: {
      type: Schema.Types.ObjectId,
      ref: FRAUD_ALERT_MODEL_NAME,
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'fraudAlertId must be a valid ObjectId',
      },
    },
    investigatorId: {
      type: Schema.Types.ObjectId,
      ref: USER_MODEL_NAME,
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'investigatorId must be a valid ObjectId',
      },
    },
    action: {
      type: String,
      required: true,
      enum: enumValues(FraudInvestigationAction),
    },
    notes: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'fraud_investigations',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

FraudInvestigationSchema.index({ fraudAlertId: 1 }, { name: 'ix_fraud_inv_alert_id' });
FraudInvestigationSchema.index({ investigatorId: 1 }, { name: 'ix_fraud_inv_investigator_id' });
FraudInvestigationSchema.index({ createdAt: -1 }, { name: 'ix_fraud_inv_created_at' });

export type FraudInvestigation = InferSchemaType<typeof FraudInvestigationSchema>;
export type FraudInvestigationDocument = HydratedDocument<FraudInvestigation>;
export const FraudInvestigationModel: Model<FraudInvestigation> =
  (models[FRAUD_INVESTIGATION_MODEL_NAME] as Model<FraudInvestigation> | undefined) ??
  model<FraudInvestigation>(FRAUD_INVESTIGATION_MODEL_NAME, FraudInvestigationSchema);
