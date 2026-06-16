import { Types } from 'mongoose';
import { FraudAlertStatus, FraudSeverity } from '@finguard/shared';
import { FraudAlert, FraudAlertDocument, FraudAlertModel } from '../models/fraud-alert.model';

export interface CreateFraudAlertInput {
  readonly transactionId: string;
  readonly userId: string;
  readonly fraudScore: number;
  readonly severity: FraudSeverity;
  readonly ruleTriggers: string[];
  readonly status?: FraudAlertStatus;
}

export interface UpdateFraudAlertStatusInput {
  readonly status: FraudAlertStatus;
  readonly reviewedBy?: string;
  readonly resolutionReason?: string;
}

export interface FraudAlertRepository {
  create(input: CreateFraudAlertInput): Promise<FraudAlertDocument>;
  findById(id: string): Promise<FraudAlertDocument | null>;
  findByUserId(userId: string): Promise<readonly FraudAlertDocument[]>;
  findOpenAlerts(): Promise<readonly FraudAlertDocument[]>;
  findCriticalAlerts(): Promise<readonly FraudAlertDocument[]>;
  updateStatus(id: string, input: UpdateFraudAlertStatusInput): Promise<FraudAlertDocument | null>;
  listRecent(limit?: number): Promise<readonly FraudAlertDocument[]>;
}

export class MongooseFraudAlertRepository implements FraudAlertRepository {
  async create(input: CreateFraudAlertInput): Promise<FraudAlertDocument> {
    const alert = new FraudAlertModel({
      ...input,
      transactionId: new Types.ObjectId(input.transactionId),
      userId: new Types.ObjectId(input.userId),
    });
    return alert.save();
  }

  async findById(id: string): Promise<FraudAlertDocument | null> {
    return FraudAlertModel.findById(id).exec();
  }

  async findByUserId(userId: string): Promise<readonly FraudAlertDocument[]> {
    return FraudAlertModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ detectedAt: -1 })
      .exec();
  }

  async findOpenAlerts(): Promise<readonly FraudAlertDocument[]> {
    return FraudAlertModel.find({ status: FraudAlertStatus.OPEN }).sort({ detectedAt: -1 }).exec();
  }

  async findCriticalAlerts(): Promise<readonly FraudAlertDocument[]> {
    return FraudAlertModel.find({ severity: FraudSeverity.CRITICAL })
      .sort({ detectedAt: -1 })
      .exec();
  }

  async updateStatus(
    id: string,
    input: UpdateFraudAlertStatusInput,
  ): Promise<FraudAlertDocument | null> {
    const update: any = {
      status: input.status,
      reviewedAt: new Date(),
    };

    if (input.reviewedBy) {
      update.reviewedBy = new Types.ObjectId(input.reviewedBy);
    }

    if (input.resolutionReason) {
      update.resolutionReason = input.resolutionReason;
    }

    return FraudAlertModel.findByIdAndUpdate(id, { $set: update }, { new: true }).exec();
  }

  async listRecent(limit: number = 20): Promise<readonly FraudAlertDocument[]> {
    return FraudAlertModel.find().sort({ detectedAt: -1 }).limit(limit).exec();
  }
}
