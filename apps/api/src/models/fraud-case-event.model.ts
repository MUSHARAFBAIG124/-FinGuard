import type { Document } from 'mongoose';
import mongoose, { Schema } from 'mongoose';
import type { FraudCaseEventContract } from '@finguard/shared';
import { FraudCaseEventType } from '@finguard/shared';

export interface FraudCaseEventDocument extends FraudCaseEventContract, Document {
  id: string;
}

const FraudCaseEventSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: true,
      index: true,
    },
    investigatorId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: Object.values(FraudCaseEventType),
      required: true,
    },
    notes: {
      type: String,
      required: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

export const FraudCaseEventModel =
  (mongoose.models.FraudCaseEvent as mongoose.Model<FraudCaseEventDocument>) ||
  mongoose.model<FraudCaseEventDocument>('FraudCaseEvent', FraudCaseEventSchema);
