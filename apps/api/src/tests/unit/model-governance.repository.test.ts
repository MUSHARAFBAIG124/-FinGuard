import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MongooseModelRegistryRepository } from '../../repositories/model-registry.repository';
import { MongooseModelDriftRepository } from '../../repositories/model-drift.repository';
import { ModelRegistryModel } from '../../models/model-registry.model';
import { ModelDriftRecordModel } from '../../models/model-drift-record.model';
import { ModelStatus, DriftLevel } from '@finguard/shared';

vi.mock('../../models/model-registry.model', () => ({
  ModelRegistryModel: {
    create: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../../models/model-drift-record.model', () => ({
  ModelDriftRecordModel: {
    create: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

describe('MongooseModelRegistryRepository', () => {
  let repo: MongooseModelRegistryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new MongooseModelRegistryRepository();
  });

  it('should create a model registry entry', async () => {
    const input = {
      modelVersion: '2.0.0',
      modelType: 'RandomForest',
      trainedBy: 'user123',
      accuracy: 0.85,
      precision: 0.82,
      recall: 0.88,
      f1Score: 0.84,
      rocAuc: 0.87,
      datasetName: 'german_credit',
      datasetSize: 1000,
      status: ModelStatus.VALIDATION,
    };

    const mockDoc = { _id: 'new-id', ...input };
    vi.mocked(ModelRegistryModel.create).mockResolvedValue(mockDoc as any);

    const result = await repo.create(input);

    expect(ModelRegistryModel.create).toHaveBeenCalledWith(input);
    expect(result._id).toBe('new-id');
  });

  it('should find by version', async () => {
    vi.mocked(ModelRegistryModel.findOne).mockReturnValue({
      exec: vi.fn().mockResolvedValue({ modelVersion: '2.0.0' }),
    } as any);

    const result = await repo.findByVersion('2.0.0');

    expect(ModelRegistryModel.findOne).toHaveBeenCalledWith({ modelVersion: '2.0.0' });
    expect(result).not.toBeNull();
  });

  it('should find latest approved model', async () => {
    const mockSort = vi
      .fn()
      .mockReturnValue({ exec: vi.fn().mockResolvedValue({ modelVersion: '2.0.0' }) });
    vi.mocked(ModelRegistryModel.findOne).mockReturnValue({ sort: mockSort } as any);

    const result = await repo.findLatestApproved();

    expect(result).not.toBeNull();
  });

  it('should approve a model', async () => {
    vi.mocked(ModelRegistryModel.findOneAndUpdate).mockReturnValue({
      exec: vi.fn().mockResolvedValue({
        modelVersion: '2.0.0',
        status: ModelStatus.APPROVED,
        approved: true,
      }),
    } as any);

    const result = await repo.approve('2.0.0', 'admin123', 'Reason');

    expect(result).not.toBeNull();
    expect(ModelRegistryModel.findOneAndUpdate).toHaveBeenCalledWith(
      { modelVersion: '2.0.0' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: ModelStatus.APPROVED,
          approved: true,
        }),
      }),
      { new: true },
    );
  });

  it('should reject a model', async () => {
    vi.mocked(ModelRegistryModel.findOneAndUpdate).mockReturnValue({
      exec: vi.fn().mockResolvedValue({ modelVersion: '2.0.0', status: ModelStatus.REJECTED }),
    } as any);

    const result = await repo.reject('2.0.0', 'admin123', 'Reason');

    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModelStatus.REJECTED);
  });

  it('should retire a model', async () => {
    vi.mocked(ModelRegistryModel.findOneAndUpdate).mockReturnValue({
      exec: vi.fn().mockResolvedValue({ modelVersion: '2.0.0', status: ModelStatus.RETIRED }),
    } as any);

    const result = await repo.retire('2.0.0', 'admin123', 'Reason');

    expect(result).not.toBeNull();
    expect(result?.status).toBe(ModelStatus.RETIRED);
  });

  it('should list all models', async () => {
    const mockSort = vi
      .fn()
      .mockReturnValue({ exec: vi.fn().mockResolvedValue([{ modelVersion: '1.0.0' }]) });
    vi.mocked(ModelRegistryModel.find).mockReturnValue({ sort: mockSort } as any);

    const result = await repo.listAll();

    expect(result).toHaveLength(1);
  });

  it('should find models by status', async () => {
    const mockSort = vi
      .fn()
      .mockReturnValue({ exec: vi.fn().mockResolvedValue([{ modelVersion: '1.0.0' }]) });
    vi.mocked(ModelRegistryModel.find).mockReturnValue({ sort: mockSort } as any);

    const result = await repo.findByStatus(ModelStatus.APPROVED);

    expect(ModelRegistryModel.find).toHaveBeenCalledWith({ status: ModelStatus.APPROVED });
    expect(result).toHaveLength(1);
  });
});

describe('MongooseModelDriftRepository', () => {
  let repo: MongooseModelDriftRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new MongooseModelDriftRepository();
  });

  it('should create a drift record', async () => {
    const input = {
      modelVersion: '2.0.0',
      featureName: 'age',
      trainingMean: 35,
      productionMean: 38,
      driftScore: 0.15,
      driftLevel: DriftLevel.MEDIUM,
    };

    vi.mocked(ModelDriftRecordModel.create).mockResolvedValue({ _id: 'drift-id', ...input } as any);

    const result = await repo.create(input);

    expect(ModelDriftRecordModel.create).toHaveBeenCalledWith(input);
    expect(result._id).toBe('drift-id');
  });

  it('should find by model version', async () => {
    const mockSort = vi
      .fn()
      .mockReturnValue({ exec: vi.fn().mockResolvedValue([{ featureName: 'age' }]) });
    vi.mocked(ModelDriftRecordModel.find).mockReturnValue({ sort: mockSort } as any);

    const result = await repo.listByModelVersion('2.0.0');

    expect(result).toHaveLength(1);
  });

  it('should list all drift records', async () => {
    const mockLimit = vi
      .fn()
      .mockReturnValue({ exec: vi.fn().mockResolvedValue([{ featureName: 'age' }]) });
    const mockSort = vi.fn().mockReturnValue({ limit: mockLimit } as any);
    vi.mocked(ModelDriftRecordModel.find).mockReturnValue({ sort: mockSort } as any);

    const result = await repo.listRecent();

    expect(result).toHaveLength(1);
  });

  it('should list critical drifts', async () => {
    const mockSort = vi.fn().mockReturnValue({
      exec: vi.fn().mockResolvedValue([{ featureName: 'age', driftLevel: DriftLevel.CRITICAL }]),
    });
    vi.mocked(ModelDriftRecordModel.find).mockReturnValue({ sort: mockSort } as any);

    const result = await repo.listCritical();

    expect(result).toHaveLength(1);
  });

  it('should count by drift level since date', async () => {
    const since = new Date('2024-01-01');
    vi.mocked(ModelDriftRecordModel.countDocuments).mockReturnValue({
      exec: vi.fn().mockResolvedValue(3),
    } as any);

    const result = await repo.countByDriftLevel(DriftLevel.CRITICAL, since);

    expect(ModelDriftRecordModel.countDocuments).toHaveBeenCalledWith({
      driftLevel: DriftLevel.CRITICAL,
      detectedAt: { $gte: since },
    });
    expect(result).toBe(3);
  });

  it('should count all drift records since date', async () => {
    const since = new Date('2024-01-01');
    vi.mocked(ModelDriftRecordModel.countDocuments).mockReturnValue({
      exec: vi.fn().mockResolvedValue(5),
    } as any);

    const result = await repo.countSince(since);

    expect(result).toBe(5);
  });
});
