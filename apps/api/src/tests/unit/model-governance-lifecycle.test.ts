import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ModelGovernanceService,
  DEFAULT_THRESHOLDS,
} from '../../services/model-governance.service';
import {
  ModelRegistryRepository,
  MongooseModelRegistryRepository,
} from '../../repositories/model-registry.repository';
import { AuditLogRepository } from '../../repositories/audit-log.repository';
import { ModelStatus } from '@finguard/shared';
import { AppError } from '../../errors/app-error';

describe('ModelGovernanceService Lifecycle', () => {
  let service: ModelGovernanceService;
  let repo: ModelRegistryRepository;
  let auditRepo: AuditLogRepository;

  beforeEach(() => {
    // Simple in-memory mock for the repository
    const models = new Map<string, any>();
    repo = {
      create: async (input: any) => {
        const doc = { _id: 'id', ...input };
        models.set(input.modelVersion, doc);
        return doc;
      },
      findByVersion: async (v: string) => models.get(v) || null,
      findLatestApproved: async () => null,
      approve: async (v: string, by: string, reason: string) => {
        const m = models.get(v);
        m.status = ModelStatus.APPROVED;
        m.approvedBy = by;
        m.approvalReason = reason;
        return m;
      },
      reject: async (v: string, by: string, reason: string) => {
        const m = models.get(v);
        m.status = ModelStatus.REJECTED;
        m.rejectedBy = by;
        m.rejectionReason = reason;
        return m;
      },
      retire: async (v: string, by: string, reason: string) => {
        const m = models.get(v);
        m.status = ModelStatus.RETIRED;
        m.retiredBy = by;
        m.retirementReason = reason;
        return m;
      },
      listAll: async () => Promise.resolve(Array.from(models.values())),
      findByStatus: async () => Promise.resolve([]),
    };

    auditRepo = {
      create: vi.fn().mockResolvedValue({}),
    } as any;

    service = new ModelGovernanceService(repo, auditRepo);
  });

  it('should approve a model that meets thresholds', async () => {
    await service.registerModel({
      modelVersion: '1.0.0',
      modelType: 'RF',
      trainedBy: 'user1',
      accuracy: 0.8,
      precision: 0.8,
      recall: 0.8,
      f1Score: 0.85, // > 0.80
      rocAuc: 0.8,
      datasetName: 'ds1',
      datasetSize: 100,
    });

    const result = await service.approveModel('1.0.0', 'admin1', 'Good metrics');
    expect(result.status).toBe(ModelStatus.APPROVED);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MODEL_APPROVED' }),
    );
  });

  it('should fail approval if F1 is below 0.80', async () => {
    await service.registerModel({
      modelVersion: '1.0.0',
      modelType: 'RF',
      trainedBy: 'user1',
      accuracy: 0.8,
      precision: 0.8,
      recall: 0.8,
      f1Score: 0.79, // < 0.80
      rocAuc: 0.8,
      datasetName: 'ds1',
      datasetSize: 100,
    });

    await expect(service.approveModel('1.0.0', 'admin1', 'Nice try')).rejects.toThrow(
      /below threshold/,
    );
  });

  it('should reject a model in VALIDATION status', async () => {
    await service.registerModel({
      modelVersion: '1.0.0',
      modelType: 'RF',
      trainedBy: 'user1',
      accuracy: 0.5,
      precision: 0.5,
      recall: 0.5,
      f1Score: 0.5,
      rocAuc: 0.5,
      datasetName: 'ds1',
      datasetSize: 100,
    });

    const result = await service.rejectModel('1.0.0', 'admin1', 'Too poor');
    expect(result.status).toBe(ModelStatus.REJECTED);
  });

  it('should retire an APPROVED model', async () => {
    await service.registerModel({
      modelVersion: '1.0.0',
      modelType: 'RF',
      trainedBy: 'user1',
      accuracy: 0.9,
      precision: 0.9,
      recall: 0.9,
      f1Score: 0.9,
      rocAuc: 0.9,
      datasetName: 'ds1',
      datasetSize: 100,
    });
    await service.approveModel('1.0.0', 'admin1', 'Perfect');

    const result = await service.retireModel('1.0.0', 'admin1', 'Outdated');
    expect(result.status).toBe(ModelStatus.RETIRED);
  });

  it('should disallow invalid transition: REJECTED -> APPROVED', async () => {
    await service.registerModel({
      modelVersion: '1.0.0',
      modelType: 'RF',
      trainedBy: 'user1',
      accuracy: 0.5,
      precision: 0.5,
      recall: 0.5,
      f1Score: 0.5,
      rocAuc: 0.5,
      datasetName: 'ds1',
      datasetSize: 100,
    });
    await service.rejectModel('1.0.0', 'admin1', 'Bad');

    await expect(service.approveModel('1.0.0', 'admin1', 'Changed mind')).rejects.toThrow(
      /Invalid status transition/,
    );
  });

  it('should disallow invalid transition: RETIRED -> VALIDATION', async () => {
    await service.registerModel({
      modelVersion: '1.0.0',
      modelType: 'RF',
      trainedBy: 'user1',
      accuracy: 0.9,
      precision: 0.9,
      recall: 0.9,
      f1Score: 0.9,
      rocAuc: 0.9,
      datasetName: 'ds1',
      datasetSize: 100,
    });
    await service.approveModel('1.0.0', 'admin1', 'Perfect');
    await service.retireModel('1.0.0', 'admin1', 'Old');

    // No direct method for VALIDATION transition, but we can simulate calling reject if it were allowed
    await expect(service.rejectModel('1.0.0', 'admin1', 'Retiree is bad')).rejects.toThrow(
      /Invalid status transition/,
    );
  });
});
