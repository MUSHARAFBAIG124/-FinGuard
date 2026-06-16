import type { ModelRegistryDocument } from '../models/model-registry.model';
import { ModelRegistryModel } from '../models/model-registry.model';
import { ModelStatus } from '@finguard/shared';

export interface CreateModelRegistryInput {
  readonly modelVersion: string;
  readonly modelType: string;
  readonly trainedBy: string;
  readonly accuracy: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1Score: number;
  readonly rocAuc: number;
  readonly datasetName: string;
  readonly datasetSize: number;
  readonly status: ModelStatus;
}

export interface ModelRegistryRepository {
  create(input: CreateModelRegistryInput): Promise<ModelRegistryDocument>;
  findByVersion(version: string): Promise<ModelRegistryDocument | null>;
  findLatestApproved(): Promise<ModelRegistryDocument | null>;
  approve(version: string, approvedBy: string, reason: string): Promise<ModelRegistryDocument | null>;
  reject(version: string, rejectedBy: string, reason: string): Promise<ModelRegistryDocument | null>;
  retire(version: string, retiredBy: string, reason: string): Promise<ModelRegistryDocument | null>;
  listAll(): Promise<readonly ModelRegistryDocument[]>;
  findByStatus(status: ModelStatus): Promise<readonly ModelRegistryDocument[]>;
}

export class MongooseModelRegistryRepository implements ModelRegistryRepository {
  public async create(input: CreateModelRegistryInput): Promise<ModelRegistryDocument> {
    return ModelRegistryModel.create(input);
  }

  public async findByVersion(version: string): Promise<ModelRegistryDocument | null> {
    return ModelRegistryModel.findOne({ modelVersion: version }).exec();
  }

  public async findLatestApproved(): Promise<ModelRegistryDocument | null> {
    return ModelRegistryModel.findOne({ status: ModelStatus.APPROVED })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async approve(version: string, approvedBy: string, reason: string): Promise<ModelRegistryDocument | null> {
    return ModelRegistryModel.findOneAndUpdate(
      { modelVersion: version },
      {
        $set: {
          status: ModelStatus.APPROVED,
          approved: true,
          approvedBy,
          approvedAt: new Date(),
          approvalReason: reason,
        },
      },
      { new: true },
    ).exec();
  }

  public async reject(version: string, rejectedBy: string, reason: string): Promise<ModelRegistryDocument | null> {
    return ModelRegistryModel.findOneAndUpdate(
      { modelVersion: version },
      {
        $set: {
          status: ModelStatus.REJECTED,
          approved: false,
          rejectedBy,
          rejectedAt: new Date(),
          rejectionReason: reason,
        },
      },
      { new: true },
    ).exec();
  }

  public async retire(version: string, retiredBy: string, reason: string): Promise<ModelRegistryDocument | null> {
    return ModelRegistryModel.findOneAndUpdate(
      { modelVersion: version },
      {
        $set: {
          status: ModelStatus.RETIRED,
          retiredBy,
          retiredAt: new Date(),
          retirementReason: reason,
        },
      },
      { new: true },
    ).exec();
  }

  public async listAll(): Promise<readonly ModelRegistryDocument[]> {
    return ModelRegistryModel.find().sort({ createdAt: -1 }).exec();
  }

  public async findByStatus(status: ModelStatus): Promise<readonly ModelRegistryDocument[]> {
    return ModelRegistryModel.find({ status }).sort({ createdAt: -1 }).exec();
  }
}
