import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MongooseLoanReviewDecisionRepository } from '../../repositories/loan-review-decision.repository';
import { MongooseReviewFeedbackRepository } from '../../repositories/review-feedback.repository';
import { ReviewerDecision, RiskCategory } from '@finguard/shared';
import { LoanReviewDecisionModel } from '../../models/loan-review-decision.model';
import { ReviewFeedbackModel } from '../../models/review-feedback.model';

vi.mock('../../models/loan-review-decision.model', () => ({
  LoanReviewDecisionModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

vi.mock('../../models/review-feedback.model', () => ({
  ReviewFeedbackModel: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

describe('MongooseLoanReviewDecisionRepository', () => {
  let repository: MongooseLoanReviewDecisionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new MongooseLoanReviewDecisionRepository();
  });

  describe('create', () => {
    it('should create a review decision and detect override for HIGH+APPROVED', async () => {
      const input = {
        loanApplicationId: '507f1f77bcf86cd799439011',
        riskAssessmentId: '507f1f77bcf86cd799439013',
        reviewerId: '507f1f77bcf86cd799439012',
        aiRiskCategory: RiskCategory.HIGH,
        aiRiskScore: 85,
        aiApprovalProbability: 0.15,
        reviewerDecision: ReviewerDecision.APPROVED,
        reviewerReason: 'Strong relationship justifies override',
      };

      const mockDoc = { _id: 'new-id', ...input, override: true };
      vi.mocked(LoanReviewDecisionModel.create).mockResolvedValue(mockDoc as any);

      const result = await repository.create(input);

      expect(LoanReviewDecisionModel.create).toHaveBeenCalledWith({
        ...input,
        override: true,
      });
      expect(result.override).toBe(true);
    });

    it('should create a review decision without override for HIGH+REJECTED', async () => {
      const input = {
        loanApplicationId: '507f1f77bcf86cd799439011',
        riskAssessmentId: '507f1f77bcf86cd799439013',
        reviewerId: '507f1f77bcf86cd799439012',
        aiRiskCategory: RiskCategory.HIGH,
        aiRiskScore: 75,
        aiApprovalProbability: 0.25,
        reviewerDecision: ReviewerDecision.REJECTED,
        reviewerReason: 'Risk too high',
      };

      const mockDoc = { _id: 'new-id', ...input, override: false };
      vi.mocked(LoanReviewDecisionModel.create).mockResolvedValue(mockDoc as any);

      const result = await repository.create(input);

      expect(LoanReviewDecisionModel.create).toHaveBeenCalledWith({
        ...input,
        override: false,
      });
      expect(result.override).toBe(false);
    });
  });

  describe('findByLoanId', () => {
    it('should return decisions sorted by reviewedAt desc', async () => {
      const loanId = '507f1f77bcf86cd799439011';
      const mockDecisions = [
        { _id: '1', loanApplicationId: loanId, reviewerDecision: ReviewerDecision.APPROVED },
        { _id: '2', loanApplicationId: loanId, reviewerDecision: ReviewerDecision.REJECTED },
      ];

      const mockSort = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(mockDecisions) });
      vi.mocked(LoanReviewDecisionModel.find).mockReturnValue({ sort: mockSort } as any);

      const result = await repository.findByLoanId(loanId);

      expect(LoanReviewDecisionModel.find).toHaveBeenCalledWith({ loanApplicationId: loanId });
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no decisions exist', async () => {
      const mockSort = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue([]) });
      vi.mocked(LoanReviewDecisionModel.find).mockReturnValue({ sort: mockSort } as any);

      const result = await repository.findByLoanId('507f1f77bcf86cd799439011');

      expect(result).toEqual([]);
    });
  });

  describe('findByReviewerId', () => {
    it('should return decisions by reviewer', async () => {
      const reviewerId = '507f1f77bcf86cd799439012';
      const mockDecisions = [
        { _id: '1', reviewerId, reviewerDecision: ReviewerDecision.APPROVED },
      ];

      const mockSort = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(mockDecisions) });
      vi.mocked(LoanReviewDecisionModel.find).mockReturnValue({ sort: mockSort } as any);

      const result = await repository.findByReviewerId(reviewerId);

      expect(LoanReviewDecisionModel.find).toHaveBeenCalledWith({ reviewerId });
      expect(result).toHaveLength(1);
    });
  });

  describe('findLatestByLoanId', () => {
    it('should return the most recent decision', async () => {
      const loanId = '507f1f77bcf86cd799439011';
      const mockDecision = { _id: 'latest', loanApplicationId: loanId };

      const mockSort = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(mockDecision) });
      vi.mocked(LoanReviewDecisionModel.findOne).mockReturnValue({ sort: mockSort } as any);

      const result = await repository.findLatestByLoanId(loanId);

      expect(LoanReviewDecisionModel.findOne).toHaveBeenCalledWith({ loanApplicationId: loanId });
      expect(result).not.toBeNull();
    });

    it('should return null when no decisions exist', async () => {
      const mockSort = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(null) });
      vi.mocked(LoanReviewDecisionModel.findOne).mockReturnValue({ sort: mockSort } as any);

      const result = await repository.findLatestByLoanId('507f1f77bcf86cd799439011');

      expect(result).toBeNull();
    });
  });

  describe('findByDecisionType', () => {
    it('should return decisions of a specific type', async () => {
      const mockDecisions = [
        { _id: '1', reviewerDecision: ReviewerDecision.APPROVED },
      ];

      const mockSort = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(mockDecisions) });
      vi.mocked(LoanReviewDecisionModel.find).mockReturnValue({ sort: mockSort } as any);

      const result = await repository.findByDecisionType(ReviewerDecision.APPROVED);

      expect(LoanReviewDecisionModel.find).toHaveBeenCalledWith({
        reviewerDecision: ReviewerDecision.APPROVED,
      });
      expect(result).toHaveLength(1);
    });
  });
});

describe('MongooseReviewFeedbackRepository', () => {
  let repository: MongooseReviewFeedbackRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new MongooseReviewFeedbackRepository();
  });

  describe('create', () => {
    it('should create a feedback record', async () => {
      const input = {
        loanApplicationId: '507f1f77bcf86cd799439011',
        riskAssessmentId: '507f1f77bcf86cd799439013',
        reviewerId: '507f1f77bcf86cd799439012',
        aiDecision: RiskCategory.MEDIUM,
        humanDecision: ReviewerDecision.APPROVED,
        override: false,
        features: { incomeVerified: true },
      };

      const mockDoc = { _id: 'feedback-id', ...input };
      vi.mocked(ReviewFeedbackModel.create).mockResolvedValue(mockDoc as any);

      const result = await repository.create(input);

      expect(ReviewFeedbackModel.create).toHaveBeenCalledWith(input);
      expect(result._id).toBe('feedback-id');
    });
  });

  describe('findByLoanId', () => {
    it('should return feedback for a loan', async () => {
      const mockSort = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue([{ _id: '1' }]) });
      vi.mocked(ReviewFeedbackModel.find).mockReturnValue({ sort: mockSort } as any);

      const result = await repository.findByLoanId('507f1f77bcf86cd799439011');

      expect(ReviewFeedbackModel.find).toHaveBeenCalledWith({
        loanApplicationId: '507f1f77bcf86cd799439011',
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findByReviewerId', () => {
    it('should return feedback by reviewer', async () => {
      const mockSort = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue([{ _id: '1' }]) });
      vi.mocked(ReviewFeedbackModel.find).mockReturnValue({ sort: mockSort } as any);

      const result = await repository.findByReviewerId('reviewer1');

      expect(ReviewFeedbackModel.find).toHaveBeenCalledWith({ reviewerId: 'reviewer1' });
      expect(result).toHaveLength(1);
    });
  });

  describe('findByLoanIdLatest', () => {
    it('should return latest feedback', async () => {
      const mockSort = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue({ _id: 'latest' }) });
      vi.mocked(ReviewFeedbackModel.findOne).mockReturnValue({ sort: mockSort } as any);

      const result = await repository.findByLoanIdLatest('loan1');

      expect(ReviewFeedbackModel.findOne).toHaveBeenCalledWith({ loanApplicationId: 'loan1' });
      expect(result).not.toBeNull();
    });
  });

  describe('getOverrideStatistics', () => {
    it('should calculate override rate correctly', async () => {
      vi.mocked(ReviewFeedbackModel.countDocuments).mockResolvedValueOnce(10);
      vi.mocked(ReviewFeedbackModel.countDocuments).mockResolvedValueOnce(2);

      const result = await repository.getOverrideStatistics();

      expect(result.totalFeedback).toBe(10);
      expect(result.overrideCount).toBe(2);
      expect(result.overrideRate).toBe(20);
    });

    it('should return 0 rate when no feedback exists', async () => {
      vi.mocked(ReviewFeedbackModel.countDocuments).mockResolvedValueOnce(0);
      vi.mocked(ReviewFeedbackModel.countDocuments).mockResolvedValueOnce(0);

      const result = await repository.getOverrideStatistics();

      expect(result.totalFeedback).toBe(0);
      expect(result.overrideCount).toBe(0);
      expect(result.overrideRate).toBe(0);
    });
  });
});
