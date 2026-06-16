import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Types } from 'mongoose';
import { MongooseRiskAssessmentRepository } from '../../repositories/mongoose-risk-assessment.repository';
import { RiskAssessmentModel } from '../../models/risk-assessment.model';
import { RiskCategory } from '@finguard/shared';

// Mock the RiskAssessmentModel
vi.mock('../../models/risk-assessment.model', () => ({
  RiskAssessmentModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

describe('MongooseRiskAssessmentRepository', () => {
  let repository: MongooseRiskAssessmentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new MongooseRiskAssessmentRepository();
  });

  describe('create', () => {
    it('creates a new risk assessment in the database', async () => {
      const loanApplicationId = new Types.ObjectId().toString();
      const input = {
        loanApplicationId,
        riskScore: 42,
        riskCategory: RiskCategory.HIGH,
        approvalProbability: 0.1,
        modelVersion: '1.0.0',
        riskEngineVersion: '1.0.0',
        explanation: {
          summary: 'high risk',
          positiveFactors: ['good credit'],
          negativeFactors: ['high debt'],
        },
        generatedAt: new Date(),
      };

      const mockCreated = {
        _id: new Types.ObjectId(),
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (RiskAssessmentModel.create as any).mockResolvedValue(mockCreated);

      const result = await repository.create(input);

      expect(result).toEqual(mockCreated);
      expect(RiskAssessmentModel.create).toHaveBeenCalledWith(input);
      expect(RiskAssessmentModel.create).toHaveBeenCalledTimes(1);
    });

    it('creates assessment with SHAP values', async () => {
      const loanApplicationId = new Types.ObjectId().toString();
      const shapValues = [
        { feature: 'creditScore', value: 0.35 },
        { feature: 'income', value: 0.25 },
      ];

      const input = {
        loanApplicationId,
        riskScore: 35,
        riskCategory: RiskCategory.MEDIUM,
        approvalProbability: 0.5,
        modelVersion: '2.0.0',
        riskEngineVersion: '1.0.0',
        explanation: {
          summary: 'moderate risk',
          positiveFactors: ['stable employment'],
          negativeFactors: ['some debt'],
          shapValues,
        },
        generatedAt: new Date(),
      };

      const mockCreated = {
        _id: new Types.ObjectId(),
        ...input,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (RiskAssessmentModel.create as any).mockResolvedValue(mockCreated);

      const result = await repository.create(input);

      expect(result.explanation.shapValues).toEqual(shapValues);
      expect(RiskAssessmentModel.create).toHaveBeenCalledWith(input);
    });
  });

  describe('findByLoanApplicationId', () => {
    it('retrieves all assessments for a loan application', async () => {
      const loanApplicationId = new Types.ObjectId().toString();
      const assessmentId1 = new Types.ObjectId();
      const assessmentId2 = new Types.ObjectId();

      const mockAssessments = [
        {
          _id: assessmentId1,
          loanApplicationId,
          riskScore: 42,
          riskCategory: 'HIGH',
          approvalProbability: 0.1,
          modelVersion: '1.0.0',
          riskEngineVersion: '1.0.0',
          explanation: {
            summary: 'high risk',
            positiveFactors: [],
            negativeFactors: [],
          },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          _id: assessmentId2,
          loanApplicationId,
          riskScore: 35,
          riskCategory: 'MEDIUM',
          approvalProbability: 0.5,
          modelVersion: '1.0.0',
          riskEngineVersion: '1.0.0',
          explanation: {
            summary: 'medium risk',
            positiveFactors: [],
            negativeFactors: [],
          },
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      const mockChain = {
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockAssessments),
      };

      (RiskAssessmentModel.find as any).mockReturnValue(mockChain);

      const result = await repository.findByLoanApplicationId(loanApplicationId);

      expect(result).toEqual(mockAssessments);
      expect(RiskAssessmentModel.find).toHaveBeenCalledWith({ loanApplicationId });
      expect(mockChain.sort).toHaveBeenCalledWith({ generatedAt: -1 });
      expect(mockChain.exec).toHaveBeenCalled();
    });

    it('returns empty array when no assessments found', async () => {
      const loanApplicationId = new Types.ObjectId().toString();

      const mockChain = {
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };

      (RiskAssessmentModel.find as any).mockReturnValue(mockChain);

      const result = await repository.findByLoanApplicationId(loanApplicationId);

      expect(result).toEqual([]);
    });
  });

  describe('findLatestByLoanApplicationId', () => {
    it('retrieves the latest assessment for a loan application', async () => {
      const loanApplicationId = new Types.ObjectId().toString();
      const assessmentId = new Types.ObjectId();

      const mockAssessment = {
        _id: assessmentId,
        loanApplicationId,
        riskScore: 45,
        riskCategory: 'MEDIUM',
        approvalProbability: 0.55,
        modelVersion: '2.0.0',
        riskEngineVersion: '1.0.0',
        explanation: {
          summary: 'moderate risk',
          positiveFactors: ['good credit'],
          negativeFactors: ['some existing debt'],
        },
        createdAt: new Date('2024-01-05'),
        updatedAt: new Date('2024-01-05'),
      };

      const mockChain = {
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(mockAssessment),
      };

      (RiskAssessmentModel.findOne as any).mockReturnValue(mockChain);

      const result = await repository.findLatestByLoanApplicationId(loanApplicationId);

      expect(result).toEqual(mockAssessment);
      expect(RiskAssessmentModel.findOne).toHaveBeenCalledWith({ loanApplicationId });
      expect(mockChain.sort).toHaveBeenCalledWith({ generatedAt: -1 });
    });

    it('returns null when no assessment found', async () => {
      const loanApplicationId = new Types.ObjectId().toString();

      const mockChain = {
        sort: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue(null),
      };

      (RiskAssessmentModel.findOne as any).mockReturnValue(mockChain);

      const result = await repository.findLatestByLoanApplicationId(loanApplicationId);

      expect(result).toBeNull();
    });
  });
});
