import type { RiskCategory } from '@finguard/shared';
import { RiskAssessmentModel, type RiskAssessmentDocument } from '../models/risk-assessment.model';

export interface CreateRiskAssessmentInput {
  readonly loanApplicationId: string;
  readonly riskScore: number;
  readonly riskCategory: RiskCategory;
  readonly approvalProbability: number;
  readonly modelVersion: string;
  readonly riskEngineVersion: string;
  readonly generatedAt?: Date;
  readonly explanation: {
    readonly summary: string;
    readonly positiveFactors: readonly string[];
    readonly negativeFactors: readonly string[];
    readonly shapValues?: readonly { readonly feature: string; readonly value: number }[];
  };
}

export interface RiskAssessmentRepository {
  create(input: CreateRiskAssessmentInput): Promise<RiskAssessmentDocument>;
  findByLoanApplicationId(loanApplicationId: string): Promise<readonly RiskAssessmentDocument[]>;
  findLatestByLoanApplicationId(loanApplicationId: string): Promise<RiskAssessmentDocument | null>;
}
