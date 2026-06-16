import { Types } from 'mongoose';
import { FraudInvestigationAction } from '@finguard/shared';
import {
  FraudInvestigation,
  FraudInvestigationDocument,
  FraudInvestigationModel,
} from '../models/fraud-investigation.model';

export interface CreateFraudInvestigationInput {
  readonly fraudAlertId: string;
  readonly investigatorId: string;
  readonly action: FraudInvestigationAction;
  readonly notes: string;
}

export interface FraudInvestigationRepository {
  create(input: CreateFraudInvestigationInput): Promise<FraudInvestigationDocument>;
  findByAlertId(fraudAlertId: string): Promise<readonly FraudInvestigationDocument[]>;
  findByInvestigator(investigatorId: string): Promise<readonly FraudInvestigationDocument[]>;
  listRecent(limit?: number): Promise<readonly FraudInvestigationDocument[]>;
}

export class MongooseFraudInvestigationRepository implements FraudInvestigationRepository {
  async create(input: CreateFraudInvestigationInput): Promise<FraudInvestigationDocument> {
    const investigation = new FraudInvestigationModel({
      ...input,
      fraudAlertId: new Types.ObjectId(input.fraudAlertId),
      investigatorId: new Types.ObjectId(input.investigatorId),
    });
    return investigation.save();
  }

  async findByAlertId(fraudAlertId: string): Promise<readonly FraudInvestigationDocument[]> {
    return FraudInvestigationModel.find({ fraudAlertId: new Types.ObjectId(fraudAlertId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  async findByInvestigator(investigatorId: string): Promise<readonly FraudInvestigationDocument[]> {
    return FraudInvestigationModel.find({ investigatorId: new Types.ObjectId(investigatorId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async listRecent(limit: number = 20): Promise<readonly FraudInvestigationDocument[]> {
    return FraudInvestigationModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }
}
