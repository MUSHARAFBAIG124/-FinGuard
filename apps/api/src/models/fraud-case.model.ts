import mongoose, { Document, Schema } from 'mongoose';
import {
  FraudCaseContract,
  FraudCaseStatus,
  FraudCasePriority,
  FraudOwnerRole,
} from '@finguard/shared';
import crypto from 'crypto';

export interface FraudCaseDocument extends FraudCaseContract, Document {
  id: string;
}

const FraudCaseSchema = new Schema(
  {
    caseId: {
      type: String,
      required: true,
      unique: true,
      default: () => `FC-${crypto.randomUUID().substring(0, 8).toUpperCase()}`,
    },
    fraudAlertId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(FraudCaseStatus),
      default: FraudCaseStatus.OPEN,
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(FraudCasePriority),
      required: true,
    },
    assignedTo: {
      type: String,
      index: true,
    },
    currentOwnerRole: {
      type: String,
      enum: Object.values(FraudOwnerRole),
    },
    assignedAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    resolutionReason: {
      type: String,
    },
    slaDueAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

export const FraudCaseModel =
  (mongoose.models.FraudCase as mongoose.Model<FraudCaseDocument>) || mongoose.model<FraudCaseDocument>('FraudCase', FraudCaseSchema);
