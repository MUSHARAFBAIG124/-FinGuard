import mongoose, {
  model,
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

export const LOAN_REVIEW_DECISION_MODEL_NAME = 'LoanReviewDecision';

export const LoanReviewDecisionSchema = new mongoose.Schema(
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
    aiRiskCategory: {
      type: String,
      required: true,
      enum: enumValues(RiskCategory),
    },
    aiRiskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    aiApprovalProbability: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    reviewerDecision: {
      type: String,
      required: true,
      enum: enumValues(ReviewerDecision),
    },
    reviewerReason: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 1000,
    },
    override: {
      type: Boolean,
      required: true,
      default: false,
    },
    reviewedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    collection: 'loan_review_decisions',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

LoanReviewDecisionSchema.index(
  { loanApplicationId: 1, reviewedAt: -1 },
  { name: 'ix_review_decision_loan_date' },
);
LoanReviewDecisionSchema.index(
  { reviewerId: 1, reviewedAt: -1 },
  { name: 'ix_review_decision_reviewer_date' },
);
LoanReviewDecisionSchema.index(
  { reviewerDecision: 1, reviewedAt: -1 },
  { name: 'ix_review_decision_type_date' },
);

export type LoanReviewDecision = InferSchemaType<typeof LoanReviewDecisionSchema>;
export type LoanReviewDecisionDocument = HydratedDocument<LoanReviewDecision>;
export const LoanReviewDecisionModel: Model<LoanReviewDecision> =
  (mongoose.models[LOAN_REVIEW_DECISION_MODEL_NAME] as Model<LoanReviewDecision> | undefined) ??
  mongoose.model<LoanReviewDecision>(LOAN_REVIEW_DECISION_MODEL_NAME, LoanReviewDecisionSchema);
