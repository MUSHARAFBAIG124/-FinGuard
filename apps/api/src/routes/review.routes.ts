import type { Router } from 'express';
import type { ReviewService } from '../services/review.service';
import type { ReviewAnalyticsService } from '../services/review-analytics.service';
import { createReviewController } from '../controllers/review.controller';
import { UserRole } from '@finguard/shared';
import { requireJwt } from '../middleware/jwt.middleware';
import { requireRole } from '../middleware/rbac.middleware';

export function createReviewRoutes(
  router: Router,
  reviewService: ReviewService,
  analyticsService: ReviewAnalyticsService,
): Router {
  const controller = createReviewController({
    reviewService,
    analyticsService,
  });

  // Submit review decision for a loan
  router.post(
    '/api/v1/reviews/:loanId',
    requireJwt,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    (req, res) => controller.submitReview(req, res),
  );

  // Get review history for a loan
  router.get(
    '/api/v1/reviews/history/:loanId',
    requireJwt,
    (req, res) => controller.getReviewHistory(req, res),
  );

  // Get all reviews by reviewer
  router.get(
    '/api/v1/reviews/my-reviews',
    requireJwt,
    requireRole(UserRole.LOAN_OFFICER, UserRole.ADMIN),
    (req, res) => controller.getReviewerReviews(req, res),
  );

  // Get overall review analytics
  router.get(
    '/api/v1/reviews/analytics',
    requireJwt,
    requireRole(UserRole.RISK_ANALYST, UserRole.ADMIN),
    (req, res) => controller.getAnalytics(req, res),
  );

  // Get stats for specific reviewer
  router.get(
    '/api/v1/reviews/stats/:reviewerId',
    requireJwt,
    requireRole(UserRole.ADMIN),
    (req, res) => controller.getReviewerStats(req, res),
  );

  return router;
}
