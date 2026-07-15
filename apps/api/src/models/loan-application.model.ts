import mongoose, {
  model,
  Schema,
  Types,
  type HydratedDocument,
  type InferSchemaType,
  type Model,
} from 'mongoose';

import { EmploymentType, LoanStatus } from '@finguard/shared';

import { enumValues } from './schema-helpers';
import { USER_MODEL_NAME } from './user.model';

export const LOAN_APPLICATION_MODEL_NAME = 'LoanApplication';

export const LoanApplicationSchema = new mongoose.Schema(
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
    loanAmount: {
      type: Number,
      required: true,
      min: 1,
      max: 100000000,
    },
    loanPurpose: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    employmentType: {
      type: String,
      required: true,
      enum: enumValues(EmploymentType),
    },
    annualIncome: {
      type: Number,
      required: true,
      min: 0,
      max: 1000000000,
    },
    existingDebt: {
      type: Number,
      required: true,
      min: 0,
      max: 1000000000,
    },
    creditScore: {
      type: Number,
      required: true,
      min: 300,
      max: 850,
    },
    status: {
      type: String,
      required: true,
      enum: enumValues(LoanStatus),
      default: LoanStatus.DRAFT,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    decisionAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'loan_applications',
    strict: 'throw',
    timestamps: true,
    versionKey: false,
  },
);

LoanApplicationSchema.index({ userId: 1 }, { name: 'ix_loan_applications_user_id' });
LoanApplicationSchema.index({ status: 1 }, { name: 'ix_loan_applications_status' });
LoanApplicationSchema.index({ userId: 1, status: 1 }, { name: 'ix_loan_applications_user_status' });

export type LoanApplication = InferSchemaType<typeof LoanApplicationSchema>;
export type LoanApplicationDocument = HydratedDocument<LoanApplication>;
export const LoanApplicationModel: Model<LoanApplication> =
  (mongoose.models[LOAN_APPLICATION_MODEL_NAME] as Model<LoanApplication> | undefined) ??
  mongoose.model<LoanApplication>(LOAN_APPLICATION_MODEL_NAME, LoanApplicationSchema);
