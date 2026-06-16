import { RiskAssessmentModel } from '../models/risk-assessment.model';
import type {
  CreateRiskAssessmentInput,
  RiskAssessmentRepository,
} from './risk-assessment.repository';

export class MongooseRiskAssessmentRepository implements RiskAssessmentRepository {
  public async create(input: CreateRiskAssessmentInput) {
    return RiskAssessmentModel.create(input);
  }

  public async findByLoanApplicationId(loanApplicationId: string) {
    return RiskAssessmentModel.find({ loanApplicationId }).sort({ generatedAt: -1 }).exec();
  }

  public async findLatestByLoanApplicationId(loanApplicationId: string) {
    return RiskAssessmentModel.findOne({ loanApplicationId }).sort({ generatedAt: -1 }).exec();
  }
}
