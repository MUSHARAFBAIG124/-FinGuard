import type { FraudCaseEventType } from '@finguard/shared';
import type { FraudCaseEventDocument } from '../models/fraud-case-event.model';
import { FraudCaseEventModel } from '../models/fraud-case-event.model';

export interface CreateFraudCaseEventInput {
  readonly caseId: string;
  readonly investigatorId: string;
  readonly eventType: FraudCaseEventType;
  readonly notes: string;
}

export interface FraudCaseEventRepository {
  create(input: CreateFraudCaseEventInput): Promise<FraudCaseEventDocument>;
  findByCaseId(caseId: string): Promise<readonly FraudCaseEventDocument[]>;
  listRecent(limit?: number): Promise<readonly FraudCaseEventDocument[]>;
}

export class MongooseFraudCaseEventRepository implements FraudCaseEventRepository {
  async create(input: CreateFraudCaseEventInput): Promise<FraudCaseEventDocument> {
    const event = new FraudCaseEventModel(input);
    return event.save();
  }

  async findByCaseId(caseId: string): Promise<readonly FraudCaseEventDocument[]> {
    return FraudCaseEventModel.find({ caseId }).sort({ createdAt: 1 }).exec();
  }

  async listRecent(limit: number = 50): Promise<readonly FraudCaseEventDocument[]> {
    return FraudCaseEventModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }
}
