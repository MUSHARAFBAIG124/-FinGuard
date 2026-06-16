import type { LoanReviewDecisionRepository } from '../repositories/loan-review-decision.repository';
import type { ReviewFeedbackRepository } from '../repositories/review-feedback.repository';
import { ReviewerDecision, RiskCategory } from '@finguard/shared';

export interface ReviewAnalytics {
  readonly totalReviews: number;
  readonly approvalRate: number;
  readonly rejectionRate: number;
  readonly moreInfoRate: number;
  readonly aiAgreementRate: number;
  readonly overrideRate: number;
  readonly totalApprovals: number;
  readonly totalRejections: number;
  readonly totalMoreInfoRequests: number;
}

export class ReviewAnalyticsService {
  constructor(
    private readonly reviewDecisionRepository: LoanReviewDecisionRepository,
    private readonly feedbackRepository: ReviewFeedbackRepository,
  ) {}

  public async calculateAnalytics(): Promise<ReviewAnalytics> {
    // Get all review decisions for analysis
    const decisions = await this.reviewDecisionRepository.findByDecisionType(ReviewerDecision.APPROVED);
    const rejections = await this.reviewDecisionRepository.findByDecisionType(ReviewerDecision.REJECTED);
    const moreInfoRequests = await this.reviewDecisionRepository.findByDecisionType(
      ReviewerDecision.MORE_INFO_REQUIRED,
    );

    const totalReviews = decisions.length + rejections.length + moreInfoRequests.length;

    if (totalReviews === 0) {
      return {
        totalReviews: 0,
        approvalRate: 0,
        rejectionRate: 0,
        moreInfoRate: 0,
        aiAgreementRate: 0,
        overrideRate: 0,
        totalApprovals: 0,
        totalRejections: 0,
        totalMoreInfoRequests: 0,
      };
    }

    // Calculate decision rates
    const approvalRate = (decisions.length / totalReviews) * 100;
    const rejectionRate = (rejections.length / totalReviews) * 100;
    const moreInfoRate = (moreInfoRequests.length / totalReviews) * 100;

    // Calculate override statistics
    const overrideStats = await this.feedbackRepository.getOverrideStatistics();
    const overrideRate = overrideStats.overrideRate;

    // Calculate AI agreement rate
    const allDecisions = [...decisions, ...rejections, ...moreInfoRequests];
    let agreementCount = 0;

    for (const decision of allDecisions) {
      const isAgreed = this.isDecisionAgreedWithAI(decision.aiRiskCategory as RiskCategory, decision.reviewerDecision as ReviewerDecision);
      if (isAgreed) {
        agreementCount++;
      }
    }

    const aiAgreementRate = (agreementCount / totalReviews) * 100;

    return {
      totalReviews,
      approvalRate,
      rejectionRate,
      moreInfoRate,
      aiAgreementRate,
      overrideRate,
      totalApprovals: decisions.length,
      totalRejections: rejections.length,
      totalMoreInfoRequests: moreInfoRequests.length,
    };
  }

  public async getReviewerStats(reviewerId: string): Promise<{
    readonly totalReviews: number;
    readonly approvalRate: number;
    readonly rejectionRate: number;
    readonly moreInfoRate: number;
    readonly overrideRate: number;
  }> {
    const decisions = await this.reviewDecisionRepository.findByReviewerId(reviewerId);

    if (decisions.length === 0) {
      return {
        totalReviews: 0,
        approvalRate: 0,
        rejectionRate: 0,
        moreInfoRate: 0,
        overrideRate: 0,
      };
    }

    const approvals = decisions.filter((d) => d.reviewerDecision === ReviewerDecision.APPROVED).length;
    const rejections = decisions.filter((d) => d.reviewerDecision === ReviewerDecision.REJECTED).length;
    const moreInfo = decisions.filter((d) => d.reviewerDecision === ReviewerDecision.MORE_INFO_REQUIRED).length;
    const overrides = decisions.filter((d) => d.override).length;

    return {
      totalReviews: decisions.length,
      approvalRate: (approvals / decisions.length) * 100,
      rejectionRate: (rejections / decisions.length) * 100,
      moreInfoRate: (moreInfo / decisions.length) * 100,
      overrideRate: (overrides / decisions.length) * 100,
    };
  }

  private isDecisionAgreedWithAI(
    aiRiskCategory: RiskCategory,
    reviewerDecision: ReviewerDecision,
  ): boolean {
    // AI agreement logic:
    // HIGH risk -> REJECTED is agreement
    // LOW risk -> APPROVED is agreement
    // MEDIUM risk -> anything is acceptable (no single agreement)
    if (aiRiskCategory === RiskCategory.HIGH && reviewerDecision === ReviewerDecision.REJECTED) {
      return true;
    }
    if (aiRiskCategory === RiskCategory.LOW && reviewerDecision === ReviewerDecision.APPROVED) {
      return true;
    }
    return false;
  }
}
