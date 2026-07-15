import type { FraudCaseStatus, FraudCasePriority, FraudOwnerRole } from '@finguard/shared';
import type { FraudCaseDocument } from '../models/fraud-case.model';
import { FraudCaseModel } from '../models/fraud-case.model';

export interface CreateFraudCaseInput {
  readonly fraudAlertId: string;
  readonly userId: string;
  readonly priority: FraudCasePriority;
  readonly slaDueAt: Date;
}

export interface UpdateFraudCaseStatusInput {
  readonly status: FraudCaseStatus;
  readonly resolutionReason?: string;
  readonly resolvedAt?: Date;
}

export interface AssignFraudCaseInput {
  readonly assignedTo: string;
  readonly currentOwnerRole: FraudOwnerRole;
  readonly assignedAt: Date;
  readonly status: FraudCaseStatus;
}

export interface FraudCaseRepository {
  create(input: CreateFraudCaseInput): Promise<FraudCaseDocument>;
  findById(caseId: string): Promise<FraudCaseDocument | null>;
  listCases(filters?: {
    status?: FraudCaseStatus;
    priority?: FraudCasePriority;
    assignedTo?: string;
  }): Promise<readonly FraudCaseDocument[]>;
  updateStatus(
    caseId: string,
    input: UpdateFraudCaseStatusInput,
  ): Promise<FraudCaseDocument | null>;
  assignCase(caseId: string, input: AssignFraudCaseInput): Promise<FraudCaseDocument | null>;
  countCases(filters?: { status?: FraudCaseStatus }): Promise<number>;
  getMetrics(): Promise<any>;
}

export class MongooseFraudCaseRepository implements FraudCaseRepository {
  async create(input: CreateFraudCaseInput): Promise<FraudCaseDocument> {
    const fraudCase = new FraudCaseModel(input);
    return fraudCase.save();
  }

  async findById(caseId: string): Promise<FraudCaseDocument | null> {
    return FraudCaseModel.findOne({ caseId }).exec();
  }

  async listCases(
    filters: { status?: FraudCaseStatus; priority?: FraudCasePriority; assignedTo?: string } = {},
  ): Promise<readonly FraudCaseDocument[]> {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.assignedTo) query.assignedTo = filters.assignedTo;

    return FraudCaseModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async updateStatus(
    caseId: string,
    input: UpdateFraudCaseStatusInput,
  ): Promise<FraudCaseDocument | null> {
    return FraudCaseModel.findOneAndUpdate({ caseId }, { $set: input }, { new: true }).exec();
  }

  async assignCase(caseId: string, input: AssignFraudCaseInput): Promise<FraudCaseDocument | null> {
    return FraudCaseModel.findOneAndUpdate({ caseId }, { $set: input }, { new: true }).exec();
  }

  async countCases(filters: { status?: FraudCaseStatus } = {}): Promise<number> {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    return FraudCaseModel.countDocuments(query).exec();
  }

  async getMetrics(): Promise<any> {
    // In memory mock or aggregate operations
    // This will be mostly mocked in tests, but useful for actual implementation
    return FraudCaseModel.aggregate([
      {
        $facet: {
          totals: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          priorities: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
        },
      },
    ]).exec();
  }
}
