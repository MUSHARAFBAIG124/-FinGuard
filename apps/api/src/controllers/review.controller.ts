import type { Request, Response } from 'express';
import type { ReviewService } from '../services/review.service';
import type { ReviewAnalyticsService } from '../services/review-analytics.service';
import { ReviewerDecision } from '@finguard/shared';

export interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface ReviewControllerFactory {
  reviewService: ReviewService;
  analyticsService: ReviewAnalyticsService;
}

export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly analyticsService: ReviewAnalyticsService,
  ) {}

  public async submitReview(req: RequestWithUser, res: Response): Promise<void> {
    const loanId = req.params.loanId;
    if (!loanId) {
      res.status(400).json({ error: 'Loan ID is required' });
      return;
    }
    const { decision, reason, features } = req.body;
    const reviewerId = req.user?.id;

    if (!reviewerId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!Object.values(ReviewerDecision).includes(decision)) {
      res
        .status(400)
        .json({ error: 'Invalid decision. Must be APPROVED, REJECTED, or MORE_INFO_REQUIRED' });
      return;
    }

    if (!reason || reason.trim().length < 10) {
      res.status(400).json({ error: 'Reason must be at least 10 characters' });
      return;
    }

    const result = await this.reviewService.submitReview({
      loanId,
      reviewerId,
      requestId: req.get('X-Request-ID') || '',
      ipAddress: req.ip || '',
      decision,
      reason,
      features,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  }

  public async getReviewHistory(req: RequestWithUser, res: Response): Promise<void> {
    const loanId = req.params.loanId;
    if (!loanId) {
      res.status(400).json({ error: 'Loan ID is required' });
      return;
    }
    const history = await this.reviewService.getReviewHistory(loanId);

    res.status(200).json({
      success: true,
      data: history,
    });
  }

  public async getReviewerReviews(req: RequestWithUser, res: Response): Promise<void> {
    const reviewerId = req.user?.id;

    if (!reviewerId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const reviews = await this.reviewService.getReviewerReviews(reviewerId);

    res.status(200).json({
      success: true,
      data: reviews,
    });
  }

  public async getAnalytics(req: RequestWithUser, res: Response): Promise<void> {
    const analytics = await this.analyticsService.calculateAnalytics();

    res.status(200).json({
      success: true,
      data: analytics,
    });
  }

  public async getReviewerStats(req: RequestWithUser, res: Response): Promise<void> {
    const reviewerId = req.params.reviewerId;
    if (!reviewerId) {
      res.status(400).json({ error: 'Reviewer ID is required' });
      return;
    }
    const stats = await this.analyticsService.getReviewerStats(reviewerId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  }
}

export function createReviewController(factory: ReviewControllerFactory): ReviewController {
  return new ReviewController(factory.reviewService, factory.analyticsService);
}
