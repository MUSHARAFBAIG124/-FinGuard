import {
  model,
  models,
  Schema,
  Types,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { RiskCategory, ReviewerDecision } from '@finguard/shared';

import { LOAN_APPLICATION_MODEL_NAME } from './loan-application.model';
import { RISK_ASSESSMENT_MODEL_NAME } from './risk-assessment.model';
import { USER_MODEL_NAME } from './user.model';
import { enumValues } from './schema-helpers';

export const REVIEW_FEEDBACK_MODEL_NAME = 'ReviewFeedback';

export const ReviewFeedbackSchema = new Schema(
  {
    loanApplicationId: {
      type: Schema.Types.ObjectId,
      ref: LOAN_APPLICATION_MODEL_NAME,
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'loanApplicationId must be a valid ObjectId',
      },
    },
    riskAssessmentId: {
      type: Schema.Types.ObjectId,
      ref: RISK_ASSESSMENT_MODEL_NAME,
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'riskAssessmentId must be a valid ObjectId',
      },
    },
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: USER_MODEL_NAME,
      required: true,
      validate: {
        validator: (value: Types.ObjectId) => Types.ObjectId.isValid(value),
        message: 'reviewerId must be a valid ObjectId',
      },
    },
    aiDecision: {
      type: String,
      required: true,
      enum: enumValues(RiskCategory),
    },
    humanDecision: {
      type: String,
      required: true,
      enum: enumValues(ReviewerDecision),
    },
    override: {
      type: Boolean,
      required: true,
      default: false,
    },
    features: {
      type: Schema.Types.Mixed,
      required: false,
      default: null,
    },
    finalOutcome: {
      type: String,
      required: false,
      default: null,
      maxlength: 2000,
    },
  },
  {
    collection: 'review_feedback',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

ReviewFeedbackSchema.index(
  { loanApplicationId: 1, createdAt: -1 },
  { name: 'ix_feedback_loan_date' },
);
ReviewFeedbackSchema.index({ reviewerId: 1, createdAt: -1 }, { name: 'ix_feedback_reviewer_date' });
ReviewFeedbackSchema.index({ override: 1, createdAt: -1 }, { name: 'ix_feedback_override_date' });

export type ReviewFeedback = InferSchemaType<typeof ReviewFeedbackSchema>;
export type ReviewFeedbackDocument = HydratedDocument<ReviewFeedback>;
export const ReviewFeedbackModel: Model<ReviewFeedback> =
  (models[REVIEW_FEEDBACK_MODEL_NAME] as Model<ReviewFeedback> | undefined) ??
  model<ReviewFeedback>(REVIEW_FEEDBACK_MODEL_NAME, ReviewFeedbackSchema);
