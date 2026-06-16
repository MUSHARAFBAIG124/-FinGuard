import type { LoanReviewDecisionDocument } from '../models/loan-review-decision.model';
import { LoanReviewDecisionModel } from '../models/loan-review-decision.model';
import { RiskCategory, ReviewerDecision } from '@finguard/shared';

export interface CreateLoanReviewDecisionInput {
  readonly loanApplicationId: string;
  readonly riskAssessmentId: string;
  readonly reviewerId: string;
  readonly aiRiskCategory: RiskCategory;
  readonly aiRiskScore: number;
  readonly aiApprovalProbability: number;
  readonly reviewerDecision: ReviewerDecision;
  readonly reviewerReason: string;
}

export interface LoanReviewDecisionRepository {
  create(input: CreateLoanReviewDecisionInput): Promise<LoanReviewDecisionDocument>;
  findByLoanId(loanApplicationId: string): Promise<readonly LoanReviewDecisionDocument[]>;
  findByReviewerId(reviewerId: string): Promise<readonly LoanReviewDecisionDocument[]>;
  findLatestByLoanId(loanApplicationId: string): Promise<LoanReviewDecisionDocument | null>;
  findByDecisionType(
    reviewerDecision: ReviewerDecision,
  ): Promise<readonly LoanReviewDecisionDocument[]>;
}

export class MongooseLoanReviewDecisionRepository implements LoanReviewDecisionRepository {
  public async create(input: CreateLoanReviewDecisionInput): Promise<LoanReviewDecisionDocument> {
    const override =
      (input.aiRiskCategory === 'HIGH' && input.reviewerDecision === ReviewerDecision.APPROVED) ||
      (input.aiRiskCategory === 'LOW' && input.reviewerDecision === ReviewerDecision.REJECTED);

    return LoanReviewDecisionModel.create({
      ...input,
      override,
    });
  }

  public async findByLoanId(loanApplicationId: string): Promise<readonly LoanReviewDecisionDocument[]> {
    return LoanReviewDecisionModel.find({ loanApplicationId })
      .sort({ reviewedAt: -1 })
      .exec();
  }

  public async findByReviewerId(reviewerId: string): Promise<readonly LoanReviewDecisionDocument[]> {
    return LoanReviewDecisionModel.find({ reviewerId })
      .sort({ reviewedAt: -1 })
      .exec();
  }

  public async findLatestByLoanId(loanApplicationId: string): Promise<LoanReviewDecisionDocument | null> {
    return LoanReviewDecisionModel.findOne({ loanApplicationId })
      .sort({ reviewedAt: -1 })
      .exec();
  }

  public async findByDecisionType(
    reviewerDecision: ReviewerDecision,
  ): Promise<readonly LoanReviewDecisionDocument[]> {
    return LoanReviewDecisionModel.find({ reviewerDecision })
      .sort({ reviewedAt: -1 })
      .exec();
  }
}
