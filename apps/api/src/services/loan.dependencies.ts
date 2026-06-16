import {
  MongooseAuditLogRepository,
  MongooseLoanRepository,
  MongooseRiskAssessmentRepository,
} from '../repositories';
import { LoanService, type LoanServiceDependencies } from './loan.service';
import { RiskAssessmentService } from './risk-assessment.service';

export const createLoanServiceDependencies = (): LoanServiceDependencies => ({
  loanRepository: new MongooseLoanRepository(),
  auditLogRepository: new MongooseAuditLogRepository(),
  riskAssessmentService: new RiskAssessmentService({
    riskAssessmentRepository: new MongooseRiskAssessmentRepository(),
    auditLogRepository: new MongooseAuditLogRepository(),
  }),
});

export const createLoanService = (): LoanService =>
  new LoanService(createLoanServiceDependencies());
