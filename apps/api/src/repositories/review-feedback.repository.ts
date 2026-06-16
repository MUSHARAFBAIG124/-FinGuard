import type { ReviewFeedbackDocument } from '../models/review-feedback.model';
import { ReviewFeedbackModel } from '../models/review-feedback.model';
import { RiskCategory, ReviewerDecision } from '@finguard/shared';

export interface CreateReviewFeedbackInput {
  readonly loanApplicationId: string;
  readonly riskAssessmentId: string;
  readonly reviewerId: string;
  readonly aiDecision: RiskCategory;
  readonly humanDecision: ReviewerDecision;
  readonly override: boolean;
  readonly features?: Record<string, unknown>;
  readonly finalOutcome?: string;
}

export interface ReviewFeedbackRepository {
  create(input: CreateReviewFeedbackInput): Promise<ReviewFeedbackDocument>;
  findByLoanId(loanApplicationId: string): Promise<readonly ReviewFeedbackDocument[]>;
  findByReviewerId(reviewerId: string): Promise<readonly ReviewFeedbackDocument[]>;
  findByLoanIdLatest(loanApplicationId: string): Promise<ReviewFeedbackDocument | null>;
  getOverrideStatistics(): Promise<{ totalFeedback: number; overrideCount: number; overrideRate: number }>;
}

export class MongooseReviewFeedbackRepository implements ReviewFeedbackRepository {
  public async create(input: CreateReviewFeedbackInput): Promise<ReviewFeedbackDocument> {
    return ReviewFeedbackModel.create(input);
  }

  public async findByLoanId(loanApplicationId: string): Promise<readonly ReviewFeedbackDocument[]> {
    return ReviewFeedbackModel.find({ loanApplicationId })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findByReviewerId(reviewerId: string): Promise<readonly ReviewFeedbackDocument[]> {
    return ReviewFeedbackModel.find({ reviewerId })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async findByLoanIdLatest(loanApplicationId: string): Promise<ReviewFeedbackDocument | null> {
    return ReviewFeedbackModel.findOne({ loanApplicationId })
      .sort({ createdAt: -1 })
      .exec();
  }

  public async getOverrideStatistics(): Promise<{ totalFeedback: number; overrideCount: number; overrideRate: number }> {
    const totalFeedback = await ReviewFeedbackModel.countDocuments();
    const overrideCount = await ReviewFeedbackModel.countDocuments({ override: true });
    const overrideRate = totalFeedback > 0 ? (overrideCount / totalFeedback) * 100 : 0;

    return {
      totalFeedback,
      overrideCount,
      overrideRate,
    };
  }
}
