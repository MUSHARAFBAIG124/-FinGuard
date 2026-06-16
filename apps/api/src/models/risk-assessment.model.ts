import {
  model,
  models,
  Schema,
  Types,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { RiskCategory } from '@finguard/shared';

import { LOAN_APPLICATION_MODEL_NAME } from './loan-application.model';
import { applyImmutableQueryGuard, enumValues } from './schema-helpers';

export const RISK_ASSESSMENT_MODEL_NAME = 'RiskAssessment';

export const RiskAssessmentSchema = new Schema(
  {
    loanApplicationId: {
      type: Schema.Types.ObjectId,
      ref: LOAN_APPLICATION_MODEL_NAME,
      required: true,
      immutable: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'loanApplicationId must be a valid ObjectId',
      },
    },
    riskScore: {
      type: Number,
      required: true,
      immutable: true,
      min: 0,
      max: 100,
    },
    riskCategory: {
      type: String,
      required: true,
      immutable: true,
      enum: enumValues(RiskCategory),
    },
    approvalProbability: {
      type: Number,
      required: true,
      immutable: true,
      min: 0,
      max: 1,
    },
    modelVersion: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    riskEngineVersion: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    explanation: {
      type: {
        summary: { type: String, required: true },
        positiveFactors: { type: [String], required: true },
        negativeFactors: { type: [String], required: true },
        shapValues: {
          type: [
            {
              feature: { type: String, required: true },
              value: { type: Number, required: true },
            },
          ],
          required: false,
        },
      },
      required: true,
      immutable: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      immutable: true,
      default: Date.now,
    },
  },
  {
    collection: 'risk_assessments',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

RiskAssessmentSchema.index(
  { loanApplicationId: 1, generatedAt: -1 },
  { name: 'ix_risk_assessments_loan_generated_at' },
);
RiskAssessmentSchema.index({ riskCategory: 1 }, { name: 'ix_risk_assessments_category' });
applyImmutableQueryGuard(RiskAssessmentSchema, 'RiskAssessment');

export type RiskAssessment = InferSchemaType<typeof RiskAssessmentSchema>;
export type RiskAssessmentDocument = HydratedDocument<RiskAssessment>;
export const RiskAssessmentModel: Model<RiskAssessment> =
  (models[RISK_ASSESSMENT_MODEL_NAME] as Model<RiskAssessment> | undefined) ??
  model<RiskAssessment>(RISK_ASSESSMENT_MODEL_NAME, RiskAssessmentSchema);
