import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Types } from 'mongoose';
import { MongooseModelMetricsRepository } from '../../repositories/model-metrics.repository';
import { ModelMetricsModel } from '../../models/model-metrics.model';

// Mock the ModelMetricsModel
vi.mock('../../models/model-metrics.model', () => ({
  ModelMetricsModel: {
    findOneAndUpdate: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
  },
}));

describe('MongooseModelMetricsRepository', () => {
  let repository: MongooseModelMetricsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new MongooseModelMetricsRepository();
  });

  describe('incrementPrediction', () => {
    it('creates new metrics record with upsert on first prediction', async () => {
      const modelVersion = '1.0.0';
      const latencyMs = 125;

      const mockDoc = {
        _id: new Types.ObjectId(),
        modelVersion,
        predictionCount: 1,
        successfulPredictions: 1,
        failedPredictions: 0,
        averageLatencyMs: 125,
        lastPredictionAt: new Date(),
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockChain = {
        exec: vi.fn().mockResolvedValue(mockDoc),
      };

      (ModelMetricsModel.findOneAndUpdate as any).mockReturnValue(mockChain);

      const result = await repository.incrementPrediction(modelVersion, latencyMs, true);

      expect(result).toEqual(mockDoc);
      expect(ModelMetricsModel.findOneAndUpdate).toHaveBeenCalledWith(
        { modelVersion },
        expect.objectContaining({
          $inc: {
            predictionCount: 1,
            successfulPredictions: 1,
            failedPredictions: 0,
          },
          $set: expect.objectContaining({
            lastPredictionAt: expect.any(Date),
          }),
        }),
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    });

    it('increments successful predictions and updates average latency', async () => {
      const modelVersion = '2.0.0';
      const latencyMs = 200;

      const mockDoc = {
        _id: new Types.ObjectId(),
        modelVersion,
        predictionCount: 5,
        successfulPredictions: 4,
        failedPredictions: 0,
        averageLatencyMs: 150,
        lastPredictionAt: new Date(),
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockChain = {
        exec: vi.fn().mockResolvedValue(mockDoc),
      };

      (ModelMetricsModel.findOneAndUpdate as any).mockReturnValue(mockChain);

      const result = await repository.incrementPrediction(modelVersion, latencyMs, true);

      expect(result.predictionCount).toBe(5);
      expect(result.successfulPredictions).toBe(4);
      // verify save was called to persist average latency update
      expect(result.save).toHaveBeenCalled();
    });

    it('increments failed predictions and updates average latency', async () => {
      const modelVersion = '3.0.0';
      const latencyMs = 5000;

      const mockDoc = {
        _id: new Types.ObjectId(),
        modelVersion,
        predictionCount: 3,
        successfulPredictions: 2,
        failedPredictions: 1,
        averageLatencyMs: 3000,
        lastPredictionAt: new Date(),
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockChain = {
        exec: vi.fn().mockResolvedValue(mockDoc),
      };

      (ModelMetricsModel.findOneAndUpdate as any).mockReturnValue(mockChain);

      const result = await repository.incrementPrediction(modelVersion, latencyMs, false);

      expect(result.predictionCount).toBe(3);
      expect(result.save).toHaveBeenCalled();
    });

    it('calculates rolling average latency correctly', async () => {
      const modelVersion = '4.0.0';
      const latencyMs = 100;

      let savedDoc: any = null;
      const mockDoc = {
        _id: new Types.ObjectId(),
        modelVersion,
        predictionCount: 2,
        successfulPredictions: 2,
        failedPredictions: 0,
        averageLatencyMs: 150, // Previous average: (prev_avg * 1 + 100) / 2
        lastPredictionAt: new Date(),
        save: vi.fn(async function (this: any) {
          savedDoc = { ...this };
          return undefined;
        }),
      };

      const mockChain = {
        exec: vi.fn().mockResolvedValue(mockDoc),
      };

      (ModelMetricsModel.findOneAndUpdate as any).mockReturnValue(mockChain);

      const result = await repository.incrementPrediction(modelVersion, latencyMs, true);

      // Average should be: (150 * (2-1) + 100) / max(1, 2) = (150 + 100) / 2 = 125
      expect(result.averageLatencyMs).toBe(125);
      expect(result.save).toHaveBeenCalled();
    });

    it('handles null average latency on new record', async () => {
      const modelVersion = '5.0.0';
      const latencyMs = 250;

      const mockDoc = {
        _id: new Types.ObjectId(),
        modelVersion,
        predictionCount: 1,
        successfulPredictions: 1,
        failedPredictions: 0,
        averageLatencyMs: null, // New record
        lastPredictionAt: new Date(),
        save: vi.fn().mockResolvedValue(undefined),
      };

      const mockChain = {
        exec: vi.fn().mockResolvedValue(mockDoc),
      };

      (ModelMetricsModel.findOneAndUpdate as any).mockReturnValue(mockChain);

      const result = await repository.incrementPrediction(modelVersion, latencyMs, true);

      // With null prev avg: (0 * 0 + 250) / max(1, 1) = 250 / 1 = 250
      expect(result.averageLatencyMs).toBe(250);
    });

    it('throws when findOneAndUpdate returns null', async () => {
      const mockChain = {
        exec: vi.fn().mockResolvedValue(null),
      };

      (ModelMetricsModel.findOneAndUpdate as any).mockReturnValue(mockChain);

      await expect(repository.incrementPrediction('bad.model', 100, true)).rejects.toThrow(
        'Failed to update model metrics',
      );
    });
  });

  describe('getLatest', () => {
    it('retrieves the latest metrics for a model version', async () => {
      const modelVersion = '1.5.0';

      const mockDoc = {
        _id: new Types.ObjectId(),
        modelVersion,
        predictionCount: 42,
        successfulPredictions: 40,
        failedPredictions: 2,
        averageLatencyMs: 156,
        lastPredictionAt: new Date(),
      };

      const mockChain = {
        exec: vi.fn().mockResolvedValue(mockDoc),
      };

      (ModelMetricsModel.findOne as any).mockReturnValue(mockChain);

      const result = await repository.getLatest(modelVersion);

      expect(result).toEqual(mockDoc);
      expect(ModelMetricsModel.findOne).toHaveBeenCalledWith({ modelVersion });
    });

    it('returns null when model version not found', async () => {
      const mockChain = {
        exec: vi.fn().mockResolvedValue(null),
      };

      (ModelMetricsModel.findOne as any).mockReturnValue(mockChain);

      const result = await repository.getLatest('nonexistent.model');

      expect(result).toBeNull();
    });
  });

  describe('listAll', () => {
    it('retrieves all model metrics sorted by version', async () => {
      const mockDocs = [
        {
          _id: new Types.ObjectId(),
          modelVersion: '1.0.0',
          predictionCount: 100,
          successfulPredictions: 95,
          failedPredictions: 5,
          averageLatencyMs: 120,
          lastPredictionAt: new Date(),
        },
        {
          _id: new Types.ObjectId(),
          modelVersion: '2.0.0',
          predictionCount: 50,
          successfulPredictions: 48,
          failedPredictions: 2,
          averageLatencyMs: 180,
          lastPredictionAt: new Date(),
        },
        {
          _id: new Types.ObjectId(),
          modelVersion: '3.0.0',
          predictionCount: 25,
          successfulPredictions: 24,
          failedPredictions: 1,
          averageLatencyMs: 200,
          lastPredictionAt: new Date(),
        },
      ];

      const mockChain = {
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockDocs),
      };

      (ModelMetricsModel.find as any).mockReturnValue(mockChain);

      const result = await repository.listAll();

      expect(result).toEqual(mockDocs);
      expect(ModelMetricsModel.find).toHaveBeenCalledWith();
      expect(mockChain.sort).toHaveBeenCalledWith({ modelVersion: 1 });
    });

    it('returns empty array when no metrics exist', async () => {
      const mockChain = {
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };

      (ModelMetricsModel.find as any).mockReturnValue(mockChain);

      const result = await repository.listAll();

      expect(result).toEqual([]);
    });

    it('returns multiple metrics sorted in ascending order by version', async () => {
      const mockDocs = [
        { modelVersion: '1.0.0', predictionCount: 10 },
        { modelVersion: '1.1.0', predictionCount: 20 },
        { modelVersion: '2.0.0', predictionCount: 30 },
      ];

      const mockChain = {
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockDocs),
      };

      (ModelMetricsModel.find as any).mockReturnValue(mockChain);

      const result = await repository.listAll();

      expect(result).toHaveLength(3);
      expect(result[0]!.modelVersion).toBe('1.0.0');
      expect(result[1]!.modelVersion).toBe('1.1.0');
      expect(result[2]!.modelVersion).toBe('2.0.0');
    });
  });
});
