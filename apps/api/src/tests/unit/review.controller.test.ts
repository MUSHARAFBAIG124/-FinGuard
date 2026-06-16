import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewController } from '../../controllers/review.controller';
import { ReviewService } from '../../services/review.service';
import { ReviewAnalyticsService } from '../../services/review-analytics.service';
import { ReviewerDecision, RiskCategory } from '@finguard/shared';

describe('ReviewController', () => {
  let controller: ReviewController;
  let reviewService: ReviewService;
  let analyticsService: ReviewAnalyticsService;

  beforeEach(() => {
    reviewService = {
      submitReview: vi.fn(),
      getReviewHistory: vi.fn(),
      getReviewerReviews: vi.fn(),
    } as unknown as ReviewService;

    analyticsService = {
      calculateAnalytics: vi.fn(),
      getReviewerStats: vi.fn(),
    } as unknown as ReviewAnalyticsService;

    controller = new ReviewController(reviewService, analyticsService);
  });

  describe('submitReview', () => {
    it('should submit review with valid request', async () => {
      const mockReq = {
        params: { loanId: 'loan123' },
        body: {
          decision: ReviewerDecision.APPROVED,
          reason: 'Low risk profile, application meets all criteria',
        },
        user: { id: 'reviewer123' },
        get: vi.fn((header: string) => {
          if (header === 'X-Request-ID') return 'req-123';
          return undefined;
        }),
        ip: '192.168.1.1',
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const mockResult = {
        id: 'review123',
        loanId: 'loan123',
        riskAssessmentId: 'risk123',
        reviewerId: 'reviewer123',
        aiRiskCategory: RiskCategory.LOW,
        aiRiskScore: 25,
        aiApprovalProbability: 0.85,
        reviewerDecision: ReviewerDecision.APPROVED,
        reviewerReason: 'Low risk profile, application meets all criteria',
        override: false,
        reviewedAt: '2024-01-15T10:30:00Z',
      };

      vi.mocked(reviewService.submitReview).mockResolvedValue(mockResult);

      await controller.submitReview(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should reject if user not authenticated', async () => {
      const mockReq = {
        params: { loanId: 'loan123' },
        body: {
          decision: ReviewerDecision.APPROVED,
          reason: 'Low risk profile',
        },
        user: undefined,
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.submitReview(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should reject invalid decision value', async () => {
      const mockReq = {
        params: { loanId: 'loan123' },
        body: {
          decision: 'INVALID_DECISION',
          reason: 'Low risk profile',
        },
        user: { id: 'reviewer123' },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.submitReview(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: expect.stringContaining('Invalid decision'),
      });
    });

    it('should reject reason shorter than 10 characters', async () => {
      const mockReq = {
        params: { loanId: 'loan123' },
        body: {
          decision: ReviewerDecision.APPROVED,
          reason: 'Short',
        },
        user: { id: 'reviewer123' },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.submitReview(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: expect.stringContaining('at least 10 characters'),
      });
    });
  });

  describe('getReviewHistory', () => {
    it('should retrieve review history for a loan', async () => {
      const mockReq = {
        params: { loanId: 'loan123' },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const mockHistory = [
        {
          id: 'review1',
          loanId: 'loan123',
          decision: ReviewerDecision.MORE_INFO_REQUIRED,
          reason: 'Need employment verification',
          override: false,
          reviewedAt: '2024-01-14T09:00:00Z',
        },
        {
          id: 'review2',
          loanId: 'loan123',
          decision: ReviewerDecision.APPROVED,
          reason: 'Documentation received, approving application',
          override: false,
          reviewedAt: '2024-01-15T10:30:00Z',
        },
      ];

      vi.mocked(reviewService.getReviewHistory).mockResolvedValue(mockHistory as any);

      await controller.getReviewHistory(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockHistory,
      });
    });
  });

  describe('getReviewerReviews', () => {
    it('should retrieve all reviews by a specific reviewer', async () => {
      const mockReq = {
        user: { id: 'reviewer123' },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const mockReviews = [
        {
          id: 'review1',
          loanId: 'loan1',
          riskAssessmentId: 'risk1',
          reviewerId: 'reviewer123',
          aiRiskCategory: RiskCategory.HIGH,
          aiRiskScore: 75,
          aiApprovalProbability: 0.25,
          reviewerDecision: ReviewerDecision.REJECTED,
          reviewerReason: 'High risk, rejecting application',
          override: false,
          reviewedAt: '2024-01-15T10:30:00Z',
        },
      ];

      vi.mocked(reviewService.getReviewerReviews).mockResolvedValue(mockReviews as any);

      await controller.getReviewerReviews(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockReviews,
      });
    });

    it('should reject if user not authenticated', async () => {
      const mockReq = {
        user: undefined,
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.getReviewerReviews(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('getAnalytics', () => {
    it('should retrieve overall analytics', async () => {
      const mockReq = {};

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const mockAnalytics = {
        totalReviews: 100,
        approvalRate: 45,
        rejectionRate: 35,
        moreInfoRate: 20,
        aiAgreementRate: 78,
        overrideRate: 12,
        totalApprovals: 45,
        totalRejections: 35,
        totalMoreInfoRequests: 20,
      };

      vi.mocked(analyticsService.calculateAnalytics).mockResolvedValue(mockAnalytics as any);

      await controller.getAnalytics(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockAnalytics,
      });
    });
  });

  describe('getReviewerStats', () => {
    it('should retrieve stats for a specific reviewer', async () => {
      const mockReq = {
        params: { reviewerId: 'reviewer123' },
      };

      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      const mockStats = {
        totalReviews: 50,
        approvalRate: 48,
        rejectionRate: 32,
        moreInfoRate: 20,
        overrideRate: 10,
      };

      vi.mocked(analyticsService.getReviewerStats).mockResolvedValue(mockStats as any);

      await controller.getReviewerStats(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });
  });
});
