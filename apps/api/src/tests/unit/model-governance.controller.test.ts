import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelGovernanceController } from '../../controllers/model-governance.controller';
import { ModelGovernanceService } from '../../services/model-governance.service';
import { DriftDetectionService } from '../../services/drift-detection.service';
import { GovernanceAnalyticsService } from '../../services/governance-analytics.service';
import { ModelStatus } from '@finguard/shared';

describe('ModelGovernanceController', () => {
  let controller: ModelGovernanceController;
  let governanceService: ModelGovernanceService;
  let driftService: DriftDetectionService;
  let analyticsService: GovernanceAnalyticsService;

  beforeEach(() => {
    governanceService = {
      registerModel: vi.fn(),
      listModels: vi.fn(),
      getModelDetails: vi.fn(),
      approveModel: vi.fn(),
      rejectModel: vi.fn(),
      retireModel: vi.fn(),
    } as unknown as ModelGovernanceService;

    driftService = {
      analyzeDrift: vi.fn(),
      getDriftRecords: vi.fn(),
    } as unknown as DriftDetectionService;

    analyticsService = {
      getGovernanceSummary: vi.fn(),
    } as unknown as GovernanceAnalyticsService;

    controller = new ModelGovernanceController(governanceService, driftService, analyticsService);
  });

  describe('registerModel', () => {
    it('should register a model with valid input', async () => {
      const mockReq = {
        body: {
          modelVersion: '1.0.0',
          modelType: 'RandomForest',
          accuracy: 0.85,
          precision: 0.82,
          recall: 0.88,
          f1Score: 0.84,
          rocAuc: 0.87,
          datasetName: 'german_credit',
          datasetSize: 1000,
        },
        user: { id: 'user123' },
      };

      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      vi.mocked(governanceService.registerModel).mockResolvedValue({
        id: 'model-id',
        modelVersion: '1.0.0',
        status: ModelStatus.VALIDATION,
      });

      await controller.registerModel(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: { id: 'model-id', modelVersion: '1.0.0', status: ModelStatus.VALIDATION },
      });
    });

    it('should reject if user not authenticated', async () => {
      const mockReq = { body: {}, user: undefined };
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await controller.registerModel(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should reject if missing required fields', async () => {
      const mockReq = { body: { modelVersion: '1.0.0' }, user: { id: 'user123' } };
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await controller.registerModel(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('listModels', () => {
    it('should list all models', async () => {
      const mockReq = {};
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      vi.mocked(governanceService.listModels).mockResolvedValue([
        { id: '1', modelVersion: '1.0.0', status: ModelStatus.APPROVED },
      ] as any);

      await controller.listModels(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: [{ id: '1', modelVersion: '1.0.0', status: ModelStatus.APPROVED }],
      });
    });
  });

  describe('getModelDetails', () => {
    it('should return model details', async () => {
      const mockReq = { params: { version: '1.0.0' } };
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      vi.mocked(governanceService.getModelDetails).mockResolvedValue({
        id: '1',
        modelVersion: '1.0.0',
        status: ModelStatus.APPROVED,
      } as any);

      await controller.getModelDetails(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 for unknown model', async () => {
      const mockReq = { params: { version: 'nonexistent' } };
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      vi.mocked(governanceService.getModelDetails).mockResolvedValue(null);

      await controller.getModelDetails(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('approveModel', () => {
    it('should approve a model', async () => {
      const mockReq = {
        params: { version: '1.0.0' },
        body: { reason: 'Meets all criteria' },
        user: { id: 'admin123' },
      };
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      vi.mocked(governanceService.approveModel).mockResolvedValue({
        id: '1',
        status: ModelStatus.APPROVED,
      });

      await controller.approveModel(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('rejectModel', () => {
    it('should reject a model', async () => {
      const mockReq = {
        params: { version: '1.0.0' },
        body: { reason: 'Performance too low' },
        user: { id: 'admin123' },
      };
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      vi.mocked(governanceService.rejectModel).mockResolvedValue({
        id: '1',
        status: ModelStatus.REJECTED,
      });

      await controller.rejectModel(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('retireModel', () => {
    it('should retire a model', async () => {
      const mockReq = {
        params: { version: '1.0.0' },
        body: { reason: 'Replaced by v2' },
        user: { id: 'admin123' },
      };
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      vi.mocked(governanceService.retireModel).mockResolvedValue({
        id: '1',
        status: ModelStatus.RETIRED,
      });

      await controller.retireModel(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('checkDrift', () => {
    it('should run drift analysis', async () => {
      const mockReq = {
        body: {
          modelVersion: '1.0.0',
          features: [
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
          ],
        },
      };
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      vi.mocked(driftService.analyzeDrift).mockResolvedValue([
        { featureName: 'age', driftScore: 0.15, driftLevel: 'MEDIUM' },
      ] as any);

      await controller.checkDrift(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should reject without modelVersion or features', async () => {
      const mockReq = { body: {} };
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await controller.checkDrift(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('listDriftRecords', () => {
    it('should list all drift records', async () => {
      const mockReq = { query: {} };
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      vi.mocked(driftService.getDriftRecords).mockResolvedValue([
        { id: '1', featureName: 'age', driftScore: 0.1, driftLevel: 'LOW' },
      ] as any);

      await controller.listDriftRecords(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getAnalytics', () => {
    it('should return governance analytics', async () => {
      const mockReq = {};
      const mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      vi.mocked(analyticsService.getGovernanceSummary).mockResolvedValue({
        models: {
          totalModels: 4,
          approvedModels: 2,
          rejectedModels: 1,
          retiredModels: 1,
          activeModels: 2,
        },
        performance: {
          averageAccuracy: 0.81,
          averagePrecision: 0.75,
          averageRecall: 0.8,
          averageF1: 0.87,
          averageRocAuc: 0.85,
        },
        drift: {
          totalDriftRecords: 5,
          criticalDriftEvents: 2,
          highDriftEvents: 1,
          mediumDriftEvents: 1,
          lowDriftEvents: 1,
          topDriftedFeatures: [],
        },
        trends: { last7Days: 0, last30Days: 5, last90Days: 5 },
        health: { governanceHealthScore: 80 },
      } as any);

      await controller.getAnalytics(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: {
          models: {
            totalModels: 4,
            approvedModels: 2,
            rejectedModels: 1,
            retiredModels: 1,
            activeModels: 2,
          },
          performance: {
            averageAccuracy: 0.81,
            averagePrecision: 0.75,
            averageRecall: 0.8,
            averageF1: 0.87,
            averageRocAuc: 0.85,
          },
          drift: {
            totalDriftRecords: 5,
            criticalDriftEvents: 2,
            highDriftEvents: 1,
            mediumDriftEvents: 1,
            lowDriftEvents: 1,
            topDriftedFeatures: [],
          },
          trends: { last7Days: 0, last30Days: 5, last90Days: 5 },
          health: { governanceHealthScore: 80 },
        },
      });
    });
  });
});
