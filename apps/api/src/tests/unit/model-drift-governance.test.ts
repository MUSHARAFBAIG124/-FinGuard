import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DriftDetectionService } from '../../services/drift-detection.service';
import type { ModelDriftRepository } from '../../repositories/model-drift.repository';
import type { AuditLogRepository } from '../../repositories/audit-log.repository';
import { DriftLevel } from '@finguard/shared';

describe('ModelDriftRecord Governance Hardening', () => {
  let driftService: DriftDetectionService;
  let driftRepo: ModelDriftRepository;
  let auditRepo: AuditLogRepository;
  let records: any[];

  beforeEach(() => {
    records = [];
    driftRepo = {
      create: vi.fn().mockImplementation(async (input) => {
        const doc = { _id: `id-${records.length}`, ...input };
        records.push(doc);
        return doc;
      }),
      listByModelVersion: vi
        .fn()
        .mockImplementation(async (v) =>
          records
            .filter((r) => r.modelVersion === v)
            .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()),
        ),
      listRecent: vi
        .fn()
        .mockImplementation(async () =>
          [...records].sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()),
        ),
      listCritical: vi
        .fn()
        .mockImplementation(async () =>
          records
            .filter((r) => r.driftLevel === DriftLevel.CRITICAL)
            .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()),
        ),
      countByDriftLevel: vi.fn(),
      countSince: vi.fn(),
    } as unknown as ModelDriftRepository;

    auditRepo = {
      create: vi.fn().mockResolvedValue({}),
    } as unknown as AuditLogRepository;

    driftService = new DriftDetectionService(driftRepo, auditRepo);
  });

  it('should create multiple records for the same feature across different runs', async () => {
    const feature = [
      {
        featureName: 'creditScore',
        trainingMean: 600,
        trainingStd: 50,
        trainingSize: 800,
        productionMean: 610,
        productionStd: 55,
        productionSize: 200,
        trainingHistogram: new Array(10).fill(0.1),
        productionHistogram: new Array(10).fill(0.1),
      },
    ] as any;

    // Run 1
    await driftService.analyzeDrift('v1', feature);
    // Run 2
    await driftService.analyzeDrift('v1', feature);

    expect(records).toHaveLength(2);
    expect(records[0].featureName).toBe('creditScore');
    expect(records[1].featureName).toBe('creditScore');
    expect(records[0]._id).not.toBe(records[1]._id);
  });

  it('should preserve history ordering (newest first) in listRecent', async () => {
    const now = new Date();
    records.push({
      _id: '1',
      detectedAt: new Date(now.getTime() - 1000),
      driftLevel: DriftLevel.LOW,
    });
    records.push({ _id: '2', detectedAt: new Date(now.getTime()), driftLevel: DriftLevel.LOW });

    const recent = await driftRepo.listRecent();
    expect(recent[0]!._id).toBe('2');
    expect(recent[1]!._id).toBe('1');
  });

  it('should only return CRITICAL events in listCritical', async () => {
    records.push({ driftLevel: DriftLevel.LOW });
    records.push({ driftLevel: DriftLevel.CRITICAL });
    records.push({ driftLevel: DriftLevel.HIGH });

    const critical = await driftRepo.listCritical();
    expect(critical).toHaveLength(1);
    expect(critical[0]!.driftLevel).toBe(DriftLevel.CRITICAL);
  });

  it('should generate a unique audit event for every drift run', async () => {
    const feature = [
      {
        featureName: 'age',
        trainingMean: 30,
        trainingStd: 10,
        trainingSize: 800,
        productionMean: 32,
        productionStd: 12,
        productionSize: 200,
        trainingHistogram: new Array(10).fill(0.1),
        productionHistogram: new Array(10).fill(0.1),
      },
    ] as any;

    await driftService.analyzeDrift('v1', feature);
    await driftService.analyzeDrift('v1', feature);

    expect(auditRepo.create).toHaveBeenCalledTimes(2);
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MODEL_DRIFT_DETECTED',
      }),
    );
  });
});
