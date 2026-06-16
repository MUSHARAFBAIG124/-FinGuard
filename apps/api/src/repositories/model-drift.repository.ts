import type { ModelDriftRecordDocument } from '../models/model-drift-record.model';
import { ModelDriftRecordModel } from '../models/model-drift-record.model';
import { DriftLevel } from '@finguard/shared';

export interface CreateDriftRecordInput {
  readonly modelVersion: string;
  readonly featureName: string;
  readonly trainingMean: number;
  readonly productionMean: number;
  readonly driftScore: number;
  readonly driftLevel: DriftLevel;
}

export interface ModelDriftRepository {
  create(input: CreateDriftRecordInput): Promise<ModelDriftRecordDocument>;
  listByModelVersion(modelVersion: string): Promise<readonly ModelDriftRecordDocument[]>;
  listRecent(limit?: number): Promise<readonly ModelDriftRecordDocument[]>;
  listCritical(): Promise<readonly ModelDriftRecordDocument[]>;
  countByDriftLevel(level: DriftLevel, since: Date): Promise<number>;
  countSince(since: Date): Promise<number>;
}

export class MongooseModelDriftRepository implements ModelDriftRepository {
  public async create(input: CreateDriftRecordInput): Promise<ModelDriftRecordDocument> {
    return ModelDriftRecordModel.create(input);
  }

  public async listByModelVersion(modelVersion: string): Promise<readonly ModelDriftRecordDocument[]> {
    return ModelDriftRecordModel.find({ modelVersion }).sort({ detectedAt: -1 }).exec();
  }

  public async listRecent(limit = 100): Promise<readonly ModelDriftRecordDocument[]> {
    return ModelDriftRecordModel.find().sort({ detectedAt: -1 }).limit(limit).exec();
  }

  public async listCritical(): Promise<readonly ModelDriftRecordDocument[]> {
    return ModelDriftRecordModel.find({ driftLevel: DriftLevel.CRITICAL }).sort({ detectedAt: -1 }).exec();
  }

  public async countByDriftLevel(level: DriftLevel, since: Date): Promise<number> {
    return ModelDriftRecordModel.countDocuments({
      driftLevel: level,
      detectedAt: { $gte: since },
    }).exec();
  }

  public async countSince(since: Date): Promise<number> {
    return ModelDriftRecordModel.countDocuments({
      detectedAt: { $gte: since },
    }).exec();
  }
}
