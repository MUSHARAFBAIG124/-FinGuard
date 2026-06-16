import type { LoanReviewDecisionRepository } from '../repositories/loan-review-decision.repository';
import type { ReviewFeedbackRepository } from '../repositories/review-feedback.repository';
import type { LoanRepository } from '../repositories/loan.repository';
import type { RiskAssessmentRepository } from '../repositories/risk-assessment.repository';
import type { AuditLogRepository } from '../repositories/audit-log.repository';
import { ReviewerDecision, RiskCategory, LoanStatus } from '@finguard/shared';
import { AppError } from '../errors/app-error';

export interface SubmitReviewInput {
  readonly loanId: string;
  readonly reviewerId: string;
  readonly requestId: string;
  readonly ipAddress: string;
  readonly decision: ReviewerDecision;
  readonly reason: string;
  readonly features?: Record<string, unknown>;
}

export interface ReviewDecisionOutput {
  readonly id: string;
  readonly loanId: string;
  readonly riskAssessmentId: string;
  readonly reviewerId: string;
  readonly aiRiskCategory: RiskCategory;
  readonly aiRiskScore: number;
  readonly aiApprovalProbability: number;
  readonly reviewerDecision: ReviewerDecision;
  readonly reviewerReason: string;
  readonly override: boolean;
  readonly reviewedAt: string;
}

export interface ReviewHistoryOutput {
  readonly id: string;
  readonly loanId: string;
  readonly decision: ReviewerDecision;
  readonly reason: string;
  readonly override: boolean;
  readonly reviewedAt: string;
}

export class ReviewService {
  constructor(
    private readonly reviewDecisionRepository: LoanReviewDecisionRepository,
    private readonly feedbackRepository: ReviewFeedbackRepository,
    private readonly loanRepository: LoanRepository,
    private readonly riskAssessmentRepository: RiskAssessmentRepository,
    private readonly auditLogRepository: AuditLogRepository,
  ) {}

  public async submitReview(input: SubmitReviewInput): Promise<ReviewDecisionOutput> {
    // Validate loan exists and is in UNDER_REVIEW status
    const loan = await this.loanRepository.findById(input.loanId);
    if (!loan) {
      throw new AppError({
        message: 'Loan not found',
        statusCode: 404,
        code: 'LOAN_NOT_FOUND',
      });
    }

    if (loan.status !== LoanStatus.UNDER_REVIEW) {
      throw new AppError({
        message: `Loan must be in UNDER_REVIEW status, current status: ${loan.status}`,
        statusCode: 400,
        code: 'INVALID_LOAN_STATUS',
      });
    }

    // Get latest risk assessment
    const riskAssessment = await this.riskAssessmentRepository.findLatestByLoanApplicationId(
      input.loanId,
    );
    if (!riskAssessment) {
      throw new AppError({
        message: 'Risk assessment not found for this loan',
        statusCode: 404,
        code: 'RISK_ASSESSMENT_NOT_FOUND',
      });
    }

    // Create review decision
    const reviewDecision = await this.reviewDecisionRepository.create({
      loanApplicationId: input.loanId,
      riskAssessmentId: riskAssessment._id.toString(),
      reviewerId: input.reviewerId,
      aiRiskCategory: riskAssessment.riskCategory as RiskCategory,
      aiRiskScore: riskAssessment.riskScore,
      aiApprovalProbability: riskAssessment.approvalProbability,
      reviewerDecision: input.decision,
      reviewerReason: input.reason,
    });

    // Create feedback record for future training
    await this.feedbackRepository.create({
      loanApplicationId: input.loanId,
      riskAssessmentId: riskAssessment._id.toString(),
      reviewerId: input.reviewerId,
      aiDecision: riskAssessment.riskCategory as RiskCategory,
      humanDecision: input.decision,
      override: reviewDecision.override,
      features: input.features,
    });

    // Update loan status based on decision
    const newLoanStatus = this.mapDecisionToLoanStatus(input.decision);
    await this.loanRepository.updateStatus(input.loanId, newLoanStatus);

    // Log audit event
    await this.auditLogRepository.create({
      userId: input.reviewerId,
      action: 'LOAN_REVIEW_COMPLETED',
      resourceType: 'LoanApplication',
      resourceId: input.loanId,
      ipAddress: input.ipAddress,
      requestId: input.requestId,
      metadata: {
        decision: input.decision,
        override: reviewDecision.override,
        aiRiskCategory: riskAssessment.riskCategory as RiskCategory,
      },
    });

    return {
      id: reviewDecision._id.toString(),
      loanId: input.loanId,
      riskAssessmentId: riskAssessment._id.toString(),
      reviewerId: input.reviewerId,
      aiRiskCategory: riskAssessment.riskCategory as RiskCategory,
      aiRiskScore: riskAssessment.riskScore,
      aiApprovalProbability: riskAssessment.approvalProbability,
      reviewerDecision: reviewDecision.reviewerDecision as ReviewerDecision,
      reviewerReason: reviewDecision.reviewerReason,
      override: reviewDecision.override,
      reviewedAt: reviewDecision.reviewedAt.toISOString(),
    };
  }

  public async getReviewHistory(loanId: string): Promise<readonly ReviewHistoryOutput[]> {
    const decisions = await this.reviewDecisionRepository.findByLoanId(loanId);

    return decisions.map((decision) => ({
      id: decision._id.toString(),
      loanId: decision.loanApplicationId.toString(),
      decision: decision.reviewerDecision as ReviewerDecision,
      reason: decision.reviewerReason,
      override: decision.override,
      reviewedAt: decision.reviewedAt.toISOString(),
    }));
  }

  public async getReviewerReviews(reviewerId: string): Promise<readonly ReviewDecisionOutput[]> {
    const decisions = await this.reviewDecisionRepository.findByReviewerId(reviewerId);

    return decisions.map((decision) => ({
      id: decision._id.toString(),
      loanId: decision.loanApplicationId.toString(),
      riskAssessmentId: decision.riskAssessmentId.toString(),
      reviewerId: decision.reviewerId.toString(),
      aiRiskCategory: decision.aiRiskCategory as RiskCategory,
      aiRiskScore: decision.aiRiskScore,
      aiApprovalProbability: decision.aiApprovalProbability,
      reviewerDecision: decision.reviewerDecision as ReviewerDecision,
      reviewerReason: decision.reviewerReason,
      override: decision.override,
      reviewedAt: decision.reviewedAt.toISOString(),
    }));
  }

  private mapDecisionToLoanStatus(decision: ReviewerDecision): LoanStatus {
    switch (decision) {
      case ReviewerDecision.APPROVED:
        return LoanStatus.APPROVED;
      case ReviewerDecision.REJECTED:
        return LoanStatus.REJECTED;
      case ReviewerDecision.MORE_INFO_REQUIRED:
        return LoanStatus.MORE_INFO_REQUIRED;
    }
  }
}
