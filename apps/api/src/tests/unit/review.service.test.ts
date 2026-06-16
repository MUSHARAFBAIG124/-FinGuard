import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LoanReviewDecisionRepository } from '../../repositories/loan-review-decision.repository';
import type { ReviewFeedbackRepository } from '../../repositories/review-feedback.repository';
import type { LoanRepository } from '../../repositories/loan.repository';
import type { RiskAssessmentRepository } from '../../repositories/risk-assessment.repository';
import type { AuditLogRepository } from '../../repositories/audit-log.repository';
import { ReviewService } from '../../services/review.service';
import { ReviewAnalyticsService } from '../../services/review-analytics.service';
import { ReviewerDecision, RiskCategory, LoanStatus } from '@finguard/shared';
import { AppError } from '../../errors/app-error';

// Mock types
interface MockLoanDocument {
  _id: { toString: () => string };
  status: LoanStatus;
  userId: string;
}

interface MockRiskAssessmentDocument {
  _id: { toString: () => string };
  riskCategory: RiskCategory;
  riskScore: number;
  approvalProbability: number;
}

interface MockReviewDecisionDocument {
  _id: { toString: () => string };
  loanApplicationId: { toString: () => string };
  riskAssessmentId: { toString: () => string };
  reviewerId: { toString: () => string };
  aiRiskCategory: RiskCategory;
  aiRiskScore: number;
  aiApprovalProbability: number;
  reviewerDecision: ReviewerDecision;
  reviewerReason: string;
  override: boolean;
  reviewedAt: Date;
}

interface MockFeedbackDocument {
  _id: { toString: () => string };
  loanApplicationId: string;
  reviewerId: string;
  aiDecision: RiskCategory;
  humanDecision: ReviewerDecision;
  override: boolean;
}

describe('ReviewService', () => {
  let reviewService: ReviewService;
  let reviewDecisionRepo: LoanReviewDecisionRepository;
  let feedbackRepo: ReviewFeedbackRepository;
  let loanRepo: LoanRepository;
  let riskAssessmentRepo: RiskAssessmentRepository;
  let auditLogRepo: AuditLogRepository;

  beforeEach(() => {
    // Create mock repositories
    reviewDecisionRepo = {
      create: vi.fn(),
      findByLoanId: vi.fn(),
      findByReviewerId: vi.fn(),
      findLatestByLoanId: vi.fn(),
      findByDecisionType: vi.fn(),
    } as unknown as LoanReviewDecisionRepository;

    feedbackRepo = {
      create: vi.fn(),
      findByLoanId: vi.fn(),
      findByReviewerId: vi.fn(),
      findByLoanIdLatest: vi.fn(),
      getOverrideStatistics: vi.fn(),
    } as unknown as ReviewFeedbackRepository;

    loanRepo = {
      findById: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as LoanRepository;

    riskAssessmentRepo = {
      findLatestByLoanApplicationId: vi.fn(),
    } as unknown as RiskAssessmentRepository;

    auditLogRepo = {
      create: vi.fn(),
    } as unknown as AuditLogRepository;

    reviewService = new ReviewService(
      reviewDecisionRepo,
      feedbackRepo,
      loanRepo,
      riskAssessmentRepo,
      auditLogRepo,
    );
  });

  describe('submitReview', () => {
    it('should successfully submit a review for a HIGH risk loan with REJECTED decision', async () => {
      // Arrange
      const loanId = '507f1f77bcf86cd799439011';
      const reviewerId = '507f1f77bcf86cd799439012';
      const riskAssessmentId = '507f1f77bcf86cd799439013';

      const mockLoan: MockLoanDocument = {
        _id: { toString: () => loanId },
        status: LoanStatus.UNDER_REVIEW,
        userId: '507f1f77bcf86cd799439014',
      };

      const mockRiskAssessment: MockRiskAssessmentDocument = {
        _id: { toString: () => riskAssessmentId },
        riskCategory: RiskCategory.HIGH,
        riskScore: 75,
        approvalProbability: 0.25,
      };

      const mockReviewDecision: MockReviewDecisionDocument = {
        _id: { toString: () => '507f1f77bcf86cd799439015' },
        loanApplicationId: { toString: () => loanId },
        riskAssessmentId: { toString: () => riskAssessmentId },
        reviewerId: { toString: () => reviewerId },
        aiRiskCategory: RiskCategory.HIGH,
        aiRiskScore: 75,
        aiApprovalProbability: 0.25,
        reviewerDecision: ReviewerDecision.REJECTED,
        reviewerReason: 'Risk profile too high, loan application rejected',
        override: false,
        reviewedAt: new Date(),
      };

      vi.mocked(loanRepo.findById).mockResolvedValue(mockLoan as any);
      vi.mocked(riskAssessmentRepo.findLatestByLoanApplicationId).mockResolvedValue(
        mockRiskAssessment as any,
      );
      vi.mocked(reviewDecisionRepo.create).mockResolvedValue(mockReviewDecision as any);
      vi.mocked(feedbackRepo.create).mockResolvedValue({ _id: '507f1f77bcf86cd799439016' } as any);
      vi.mocked(loanRepo.updateStatus).mockResolvedValue(null as any);
      vi.mocked(auditLogRepo.create).mockResolvedValue({ _id: '507f1f77bcf86cd799439017' } as any);

      // Act
      const result = await reviewService.submitReview({
        loanId,
        reviewerId,
        requestId: 'req-123',
        ipAddress: '192.168.1.1',
        decision: ReviewerDecision.REJECTED,
        reason: 'Risk profile too high, loan application rejected',
      });

      // Assert
      expect(result.override).toBe(false);
      expect(result.reviewerDecision).toBe(ReviewerDecision.REJECTED);
      expect(reviewDecisionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          loanApplicationId: loanId,
          reviewerDecision: ReviewerDecision.REJECTED,
        }),
      );
      expect(loanRepo.updateStatus).toHaveBeenCalledWith(loanId, LoanStatus.REJECTED);
    });

    it('should detect override when HIGH risk loan is APPROVED', async () => {
      const loanId = '507f1f77bcf86cd799439011';
      const reviewerId = '507f1f77bcf86cd799439012';
      const riskAssessmentId = '507f1f77bcf86cd799439013';

      const mockLoan: MockLoanDocument = {
        _id: { toString: () => loanId },
        status: LoanStatus.UNDER_REVIEW,
        userId: '507f1f77bcf86cd799439014',
      };

      const mockRiskAssessment: MockRiskAssessmentDocument = {
        _id: { toString: () => riskAssessmentId },
        riskCategory: RiskCategory.HIGH,
        riskScore: 85,
        approvalProbability: 0.15,
      };

      const mockReviewDecision: MockReviewDecisionDocument = {
        _id: { toString: () => '507f1f77bcf86cd799439015' },
        loanApplicationId: { toString: () => loanId },
        riskAssessmentId: { toString: () => riskAssessmentId },
        reviewerId: { toString: () => reviewerId },
        aiRiskCategory: RiskCategory.HIGH,
        aiRiskScore: 85,
        aiApprovalProbability: 0.15,
        reviewerDecision: ReviewerDecision.APPROVED,
        reviewerReason: 'Customer has strong relationship with bank, approve despite high risk',
        override: true,
        reviewedAt: new Date(),
      };

      vi.mocked(loanRepo.findById).mockResolvedValue(mockLoan as any);
      vi.mocked(riskAssessmentRepo.findLatestByLoanApplicationId).mockResolvedValue(
        mockRiskAssessment as any,
      );
      vi.mocked(reviewDecisionRepo.create).mockResolvedValue(mockReviewDecision as any);
      vi.mocked(feedbackRepo.create).mockResolvedValue({} as any);
      vi.mocked(loanRepo.updateStatus).mockResolvedValue(null as any);
      vi.mocked(auditLogRepo.create).mockResolvedValue({} as any);

      const result = await reviewService.submitReview({
        loanId,
        reviewerId,
        requestId: 'req-124',
        ipAddress: '192.168.1.1',
        decision: ReviewerDecision.APPROVED,
        reason: 'Customer has strong relationship with bank, approve despite high risk',
      });

      expect(result.override).toBe(true);
      expect(result.reviewerDecision).toBe(ReviewerDecision.APPROVED);
    });

    it('should throw error when loan is not in UNDER_REVIEW status', async () => {
      const loanId = '507f1f77bcf86cd799439011';
      const mockLoan: MockLoanDocument = {
        _id: { toString: () => loanId },
        status: LoanStatus.DRAFT,
        userId: '507f1f77bcf86cd799439014',
      };

      vi.mocked(loanRepo.findById).mockResolvedValue(mockLoan as any);

      await expect(
        reviewService.submitReview({
          loanId,
          reviewerId: '507f1f77bcf86cd799439012',
          requestId: 'req-125',
          ipAddress: '192.168.1.1',
          decision: ReviewerDecision.APPROVED,
          reason: 'This should fail because loan is in DRAFT status',
        }),
      ).rejects.toThrow(AppError);
    });

    it('should throw error when loan does not exist', async () => {
      vi.mocked(loanRepo.findById).mockResolvedValue(null);

      await expect(
        reviewService.submitReview({
          loanId: '507f1f77bcf86cd799439011',
          reviewerId: '507f1f77bcf86cd799439012',
          requestId: 'req-126',
          ipAddress: '192.168.1.1',
          decision: ReviewerDecision.APPROVED,
          reason: 'This should fail because loan does not exist',
        }),
      ).rejects.toThrow('Loan not found');
    });

    it('should create feedback record for future training', async () => {
      const loanId = '507f1f77bcf86cd799439011';
      const reviewerId = '507f1f77bcf86cd799439012';
      const riskAssessmentId = '507f1f77bcf86cd799439013';

      const mockLoan: MockLoanDocument = {
        _id: { toString: () => loanId },
        status: LoanStatus.UNDER_REVIEW,
        userId: '507f1f77bcf86cd799439014',
      };

      const mockRiskAssessment: MockRiskAssessmentDocument = {
        _id: { toString: () => riskAssessmentId },
        riskCategory: RiskCategory.MEDIUM,
        riskScore: 50,
        approvalProbability: 0.5,
      };

      const mockReviewDecision: MockReviewDecisionDocument = {
        _id: { toString: () => '507f1f77bcf86cd799439015' },
        loanApplicationId: { toString: () => loanId },
        riskAssessmentId: { toString: () => riskAssessmentId },
        reviewerId: { toString: () => reviewerId },
        aiRiskCategory: RiskCategory.MEDIUM,
        aiRiskScore: 50,
        aiApprovalProbability: 0.5,
        reviewerDecision: ReviewerDecision.MORE_INFO_REQUIRED,
        reviewerReason: 'Need more employment information to finalize decision',
        override: false,
        reviewedAt: new Date(),
      };

      vi.mocked(loanRepo.findById).mockResolvedValue(mockLoan as any);
      vi.mocked(riskAssessmentRepo.findLatestByLoanApplicationId).mockResolvedValue(
        mockRiskAssessment as any,
      );
      vi.mocked(reviewDecisionRepo.create).mockResolvedValue(mockReviewDecision as any);
      vi.mocked(feedbackRepo.create).mockResolvedValue({} as any);
      vi.mocked(loanRepo.updateStatus).mockResolvedValue(null as any);
      vi.mocked(auditLogRepo.create).mockResolvedValue({} as any);

      const features = { employmentStatus: 'pending', verificationStatus: 'incomplete' };

      await reviewService.submitReview({
        loanId,
        reviewerId,
        requestId: 'req-127',
        ipAddress: '192.168.1.1',
        decision: ReviewerDecision.MORE_INFO_REQUIRED,
        reason: 'Need more employment information to finalize decision',
        features,
      });

      expect(feedbackRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          loanApplicationId: loanId,
          aiDecision: RiskCategory.MEDIUM,
          humanDecision: ReviewerDecision.MORE_INFO_REQUIRED,
          features,
        }),
      );
    });
  });

  describe('getReviewHistory', () => {
    it('should return all reviews for a specific loan', async () => {
      const loanId = '507f1f77bcf86cd799439011';
      const mockReviews: MockReviewDecisionDocument[] = [
        {
          _id: { toString: () => '507f1f77bcf86cd799439015' },
          loanApplicationId: { toString: () => loanId },
          riskAssessmentId: { toString: () => '507f1f77bcf86cd799439013' },
          reviewerId: { toString: () => '507f1f77bcf86cd799439012' },
          aiRiskCategory: RiskCategory.HIGH,
          aiRiskScore: 75,
          aiApprovalProbability: 0.25,
          reviewerDecision: ReviewerDecision.MORE_INFO_REQUIRED,
          reviewerReason: 'Need more information',
          override: false,
          reviewedAt: new Date('2024-01-01'),
        },
      ];

      vi.mocked(reviewDecisionRepo.findByLoanId).mockResolvedValue(mockReviews as any);

      const result = await reviewService.getReviewHistory(loanId);

      expect(result).toHaveLength(1);
      expect(result[0]!.decision).toBe(ReviewerDecision.MORE_INFO_REQUIRED);
      expect(reviewDecisionRepo.findByLoanId).toHaveBeenCalledWith(loanId);
    });

    it('should return empty array when no reviews exist', async () => {
      vi.mocked(reviewDecisionRepo.findByLoanId).mockResolvedValue([]);

      const result = await reviewService.getReviewHistory('507f1f77bcf86cd799439011');

      expect(result).toEqual([]);
    });
  });

  describe('getReviewerReviews', () => {
    it('should return all reviews submitted by a specific reviewer', async () => {
      const reviewerId = '507f1f77bcf86cd799439012';
      const mockReviews: MockReviewDecisionDocument[] = [
        {
          _id: { toString: () => '507f1f77bcf86cd799439015' },
          loanApplicationId: { toString: () => '507f1f77bcf86cd799439011' },
          riskAssessmentId: { toString: () => '507f1f77bcf86cd799439013' },
          reviewerId: { toString: () => reviewerId },
          aiRiskCategory: RiskCategory.LOW,
          aiRiskScore: 25,
          aiApprovalProbability: 0.85,
          reviewerDecision: ReviewerDecision.APPROVED,
          reviewerReason: 'Low risk profile, approve application',
          override: false,
          reviewedAt: new Date(),
        },
      ];

      vi.mocked(reviewDecisionRepo.findByReviewerId).mockResolvedValue(mockReviews as any);

      const result = await reviewService.getReviewerReviews(reviewerId);

      expect(result).toHaveLength(1);
      expect(result[0]!.reviewerDecision).toBe(ReviewerDecision.APPROVED);
    });
  });
});

describe('ReviewAnalyticsService', () => {
  let analyticsService: ReviewAnalyticsService;
  let reviewDecisionRepo: LoanReviewDecisionRepository;
  let feedbackRepo: ReviewFeedbackRepository;

  beforeEach(() => {
    reviewDecisionRepo = {
      findByDecisionType: vi.fn(),
      findByReviewerId: vi.fn(),
    } as unknown as LoanReviewDecisionRepository;

    feedbackRepo = {
      getOverrideStatistics: vi.fn(),
    } as unknown as ReviewFeedbackRepository;

    analyticsService = new ReviewAnalyticsService(reviewDecisionRepo, feedbackRepo);
  });

  describe('calculateAnalytics', () => {
    it('should calculate correct approval, rejection, and override rates', async () => {
      const mockApprovals: MockReviewDecisionDocument[] = [
        {
          _id: { toString: () => '1' },
          loanApplicationId: { toString: () => 'loan1' },
          riskAssessmentId: { toString: () => 'risk1' },
          reviewerId: { toString: () => 'reviewer1' },
          aiRiskCategory: RiskCategory.LOW,
          aiRiskScore: 25,
          aiApprovalProbability: 0.85,
          reviewerDecision: ReviewerDecision.APPROVED,
          reviewerReason: 'Approved',
          override: false,
          reviewedAt: new Date(),
        },
      ];

      const mockRejections: MockReviewDecisionDocument[] = [
        {
          _id: { toString: () => '2' },
          loanApplicationId: { toString: () => 'loan2' },
          riskAssessmentId: { toString: () => 'risk2' },
          reviewerId: { toString: () => 'reviewer1' },
          aiRiskCategory: RiskCategory.HIGH,
          aiRiskScore: 75,
          aiApprovalProbability: 0.25,
          reviewerDecision: ReviewerDecision.REJECTED,
          reviewerReason: 'Rejected',
          override: false,
          reviewedAt: new Date(),
        },
      ];

      const mockMoreInfo: MockReviewDecisionDocument[] = [
        {
          _id: { toString: () => '3' },
          loanApplicationId: { toString: () => 'loan3' },
          riskAssessmentId: { toString: () => 'risk3' },
          reviewerId: { toString: () => 'reviewer1' },
          aiRiskCategory: RiskCategory.MEDIUM,
          aiRiskScore: 50,
          aiApprovalProbability: 0.5,
          reviewerDecision: ReviewerDecision.MORE_INFO_REQUIRED,
          reviewerReason: 'More info',
          override: false,
          reviewedAt: new Date(),
        },
      ];

      vi.mocked(reviewDecisionRepo.findByDecisionType)
        .mockResolvedValueOnce(mockApprovals as any)
        .mockResolvedValueOnce(mockRejections as any)
        .mockResolvedValueOnce(mockMoreInfo as any);

      vi.mocked(feedbackRepo.getOverrideStatistics).mockResolvedValue({
        totalFeedback: 3,
        overrideCount: 0,
        overrideRate: 0,
      });

      const result = await analyticsService.calculateAnalytics();

      expect(result.totalReviews).toBe(3);
      expect(result.approvalRate).toBeCloseTo(33.33, 1);
      expect(result.rejectionRate).toBeCloseTo(33.33, 1);
      expect(result.moreInfoRate).toBeCloseTo(33.33, 1);
      expect(result.overrideRate).toBe(0);
      expect(result.aiAgreementRate).toBeGreaterThan(0);
    });

    it('should return zero rates when no reviews exist', async () => {
      vi.mocked(reviewDecisionRepo.findByDecisionType)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await analyticsService.calculateAnalytics();

      expect(result.totalReviews).toBe(0);
      expect(result.approvalRate).toBe(0);
      expect(result.rejectionRate).toBe(0);
      expect(result.moreInfoRate).toBe(0);
    });
  });

  describe('getReviewerStats', () => {
    it('should calculate per-reviewer statistics', async () => {
      const reviewerId = '507f1f77bcf86cd799439012';
      const mockReviews: MockReviewDecisionDocument[] = [
        {
          _id: { toString: () => '1' },
          loanApplicationId: { toString: () => 'loan1' },
          riskAssessmentId: { toString: () => 'risk1' },
          reviewerId: { toString: () => reviewerId },
          aiRiskCategory: RiskCategory.LOW,
          aiRiskScore: 25,
          aiApprovalProbability: 0.85,
          reviewerDecision: ReviewerDecision.APPROVED,
          reviewerReason: 'Approved',
          override: false,
          reviewedAt: new Date(),
        },
        {
          _id: { toString: () => '2' },
          loanApplicationId: { toString: () => 'loan2' },
          riskAssessmentId: { toString: () => 'risk2' },
          reviewerId: { toString: () => reviewerId },
          aiRiskCategory: RiskCategory.HIGH,
          aiRiskScore: 85,
          aiApprovalProbability: 0.15,
          reviewerDecision: ReviewerDecision.APPROVED,
          reviewerReason: 'Override approval',
          override: true,
          reviewedAt: new Date(),
        },
      ];

      vi.mocked(reviewDecisionRepo.findByReviewerId).mockResolvedValue(mockReviews as any);

      const result = await analyticsService.getReviewerStats(reviewerId);

      expect(result.totalReviews).toBe(2);
      expect(result.approvalRate).toBe(100); // 2/2 approvals
      expect(result.overrideRate).toBe(50); // 1/2 overrides
    });
  });
});
