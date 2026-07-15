import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DriftDetectionService } from '../../services/drift-detection.service';
import type { ModelDriftRepository } from '../../repositories/model-drift.repository';
import type { AuditLogRepository } from '../../repositories/audit-log.repository';
import { DriftLevel } from '@finguard/shared';

describe('DriftDetectionService', () => {
  let driftService: DriftDetectionService;
  let driftRepo: ModelDriftRepository;
  let auditRepo: AuditLogRepository;

  beforeEach(() => {
    driftRepo = {
      create: vi.fn(),
      listByModelVersion: vi.fn(),
      listRecent: vi.fn(),
      listCritical: vi.fn(),
      countByDriftLevel: vi.fn(),
      countSince: vi.fn(),
    };

    auditRepo = {
      create: vi.fn(),
    } as unknown as AuditLogRepository;

    driftService = new DriftDetectionService(driftRepo, auditRepo);
  });

  describe('calculatePSI', () => {
    it('should return 0 for identical distributions', () => {
      const hist = [0.2, 0.3, 0.2, 0.1, 0.1, 0.05, 0.03, 0.01, 0.01, 0.0];
      const psi = driftService.calculatePSI(hist, hist);
      expect(psi).toBeCloseTo(0, 5);
    });

    it('should return positive value for different distributions', () => {
      const training = [0.3, 0.3, 0.2, 0.1, 0.05, 0.03, 0.01, 0.01, 0.0, 0.0];
      const production = [0.1, 0.1, 0.1, 0.2, 0.2, 0.1, 0.1, 0.05, 0.03, 0.02];
      const psi = driftService.calculatePSI(training, production);
      expect(psi).toBeGreaterThan(0.1);
    });
  });

  describe('classifyDrift', () => {
    it('should classify LOW for PSI < 0.1', () => {
      expect(driftService.classifyDrift(0.05)).toBe(DriftLevel.LOW);
      expect(driftService.classifyDrift(0.0999)).toBe(DriftLevel.LOW);
    });

    it('should classify MEDIUM for PSI between 0.1 and 0.25', () => {
      expect(driftService.classifyDrift(0.1)).toBe(DriftLevel.MEDIUM);
      expect(driftService.classifyDrift(0.15)).toBe(DriftLevel.MEDIUM);
      expect(driftService.classifyDrift(0.2499)).toBe(DriftLevel.MEDIUM);
    });

    it('should classify HIGH for PSI between 0.25 and 0.5', () => {
      expect(driftService.classifyDrift(0.25)).toBe(DriftLevel.HIGH);
      expect(driftService.classifyDrift(0.35)).toBe(DriftLevel.HIGH);
      expect(driftService.classifyDrift(0.4999)).toBe(DriftLevel.HIGH);
    });

    it('should classify CRITICAL for PSI >= 0.5', () => {
      expect(driftService.classifyDrift(0.5)).toBe(DriftLevel.CRITICAL);
      expect(driftService.classifyDrift(0.75)).toBe(DriftLevel.CRITICAL);
    });
  });

  describe('computeHistogram', () => {
    it('should normalize histogram to probabilities', () => {
      const data = [1, 1, 1, 2, 2, 3, 4, 5, 6, 7];
      const hist = driftService.computeHistogram(data, 10);
      const total = hist.reduce((a: number, b: number) => a + b, 0);
      expect(total).toBeCloseTo(1, 5);
    });

    it('should handle empty data', () => {
      const hist = driftService.computeHistogram([], 10);
      expect(hist).toHaveLength(10);
      expect(hist.every((h: number) => h === 0)).toBe(true);
    });
  });

  describe('analyzeDrift', () => {
    it('should produce drift results for each feature', async () => {
      const features = [
        {
          featureName: 'age',
          trainingMean: 35,
          trainingStd: 10,
          trainingSize: 800,
          productionMean: 38,
          productionStd: 12,
          productionSize: 200,
          trainingHistogram: [0.2, 0.3, 0.2, 0.1, 0.1, 0.05, 0.03, 0.01, 0.01, 0.0],
          productionHistogram: [0.1, 0.2, 0.25, 0.2, 0.1, 0.08, 0.04, 0.02, 0.01, 0.0],
        },
        {
          featureName: 'income',
          trainingMean: 50000,
          trainingStd: 15000,
          trainingSize: 800,
          productionMean: 52000,
          productionStd: 16000,
          productionSize: 200,
          trainingHistogram: [0.3, 0.3, 0.2, 0.1, 0.05, 0.03, 0.01, 0.01, 0.0, 0.0],
          productionHistogram: [0.3, 0.3, 0.2, 0.1, 0.05, 0.03, 0.01, 0.01, 0.0, 0.0],
        },
      ];

      const results = await driftService.analyzeDrift('2.0.0', features);

      expect(results).toHaveLength(2);
      expect(results[0]!.featureName).toBe('age');
      expect(results[1]!.featureName).toBe('income');
      expect(driftRepo.create).toHaveBeenCalledTimes(2);
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MODEL_DRIFT_DETECTED' }),
      );
    });
  });

  describe('getDriftRecords', () => {
    it('should return all drift records when no model version specified', async () => {
      const mockRecords = [
        {
          _id: { toString: () => '1' },
          modelVersion: '2.0.0',
          featureName: 'age',
          trainingMean: 35,
          productionMean: 38,
          driftScore: 0.15,
          driftLevel: 'MEDIUM',
          detectedAt: new Date('2024-01-15'),
        },
      ];

      vi.mocked(driftRepo.listRecent).mockResolvedValue(mockRecords as any);

      const results = await driftService.getDriftRecords();

      expect(results).toHaveLength(1);
      expect(results[0]!.featureName).toBe('age');
      expect(results[0]!.driftLevel).toBe('MEDIUM');
    });

    it('should return drift records filtered by model version', async () => {
      const mockRecords = [
        {
          _id: { toString: () => '2' },
          modelVersion: '2.0.0',
          featureName: 'income',
          trainingMean: 50000,
          productionMean: 52000,
          driftScore: 0.05,
          driftLevel: 'LOW',
          detectedAt: new Date('2024-02-01'),
        },
      ];

      vi.mocked(driftRepo.listByModelVersion).mockResolvedValue(mockRecords as any);

      const results = await driftService.getDriftRecords('2.0.0');

      expect(results).toHaveLength(1);
      expect(results[0]!.featureName).toBe('income');
      expect(driftRepo.listByModelVersion).toHaveBeenCalledWith('2.0.0');
    });

    it('should return empty array when no records exist', async () => {
      vi.mocked(driftRepo.listRecent).mockResolvedValue([]);

      const results = await driftService.getDriftRecords();

      expect(results).toEqual([]);
    });
  });
});
