import { StatusCodes } from 'http-status-codes';

import { LoanStatus, UserRole } from '@finguard/shared';

import { AppError } from '../errors/app-error';
import type { LoanApplicationDocument } from '../models/loan-application.model';
import type { AuditLogRepository } from '../repositories/audit-log.repository';
import type {
  CreateLoanApplicationInput,
  LoanRepository,
  UpdateLoanApplicationInput,
} from '../repositories/loan.repository';
import { getDocumentId } from '../utils/document-id';
import type { RequestContext } from './auth.types';
import type { RiskAssessmentService } from './risk-assessment.service';

export interface LoanServiceDependencies {
  readonly loanRepository: LoanRepository;
  readonly auditLogRepository: AuditLogRepository;
  readonly riskAssessmentService?: RiskAssessmentService;
}

export interface LoanApplicationResponse {
  readonly id: string;
  readonly userId: string;
  readonly loanAmount: number;
  readonly loanPurpose: string;
  readonly employmentType: string;
  readonly annualIncome: number;
  readonly existingDebt: number;
  readonly creditScore: number;
  readonly status: LoanStatus;
  readonly submittedAt?: string;
  readonly decisionAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const toLoanResponse = (loan: LoanApplicationDocument): LoanApplicationResponse => ({
  id: getDocumentId(loan),
  userId: loan.userId.toString(),
  loanAmount: loan.loanAmount,
  loanPurpose: loan.loanPurpose,
  employmentType: loan.employmentType,
  annualIncome: loan.annualIncome,
  existingDebt: loan.existingDebt,
  creditScore: loan.creditScore,
  status: loan.status as LoanStatus,
  submittedAt: loan.submittedAt?.toISOString(),
  decisionAt: loan.decisionAt?.toISOString(),
  createdAt: loan.createdAt.toISOString(),
  updatedAt: loan.updatedAt.toISOString(),
});

const validateStateTransition = (fromStatus: LoanStatus, toStatus: LoanStatus): void => {
  const validTransitions: Record<LoanStatus, LoanStatus[]> = {
    [LoanStatus.DRAFT]: [LoanStatus.SUBMITTED],
    [LoanStatus.SUBMITTED]: [LoanStatus.UNDER_REVIEW],
    [LoanStatus.UNDER_REVIEW]: [
      LoanStatus.APPROVED,
      LoanStatus.REJECTED,
      LoanStatus.MORE_INFO_REQUIRED,
    ],
    [LoanStatus.MORE_INFO_REQUIRED]: [LoanStatus.SUBMITTED],
    [LoanStatus.APPROVED]: [],
    [LoanStatus.REJECTED]: [],
  };

  if (!validTransitions[fromStatus]?.includes(toStatus)) {
    throw new AppError({
      code: 'INVALID_STATE_TRANSITION',
      message: `Cannot transition from ${fromStatus} to ${toStatus}`,
      statusCode: StatusCodes.BAD_REQUEST,
    });
  }
};

export class LoanService {
  public constructor(private readonly dependencies: LoanServiceDependencies) {}

  public async create(
    userId: string,
    input: CreateLoanApplicationInput,
    context: RequestContext,
  ): Promise<LoanApplicationResponse> {
    const loan = await this.dependencies.loanRepository.create({
      ...input,
      userId,
      status: LoanStatus.DRAFT,
    });

    await this.audit(userId, 'LOAN_CREATED', getDocumentId(loan), context, {
      loanAmount: input.loanAmount,
      loanPurpose: input.loanPurpose,
    });

    return toLoanResponse(loan);
  }

  public async findById(
    loanId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<LoanApplicationResponse> {
    const loan = await this.dependencies.loanRepository.findById(loanId);

    if (!loan) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    this.assertCanView(loan, userId, userRole);

    return toLoanResponse(loan);
  }

  public async findByUser(userId: string): Promise<readonly LoanApplicationResponse[]> {
    const loans = await this.dependencies.loanRepository.findByUserId(userId);
    return loans.map(toLoanResponse);
  }

  public async findAll(): Promise<readonly LoanApplicationResponse[]> {
    const loans = await this.dependencies.loanRepository.findAll();
    return loans.map(toLoanResponse);
  }

  public async getReviewQueue(): Promise<readonly LoanApplicationResponse[]> {
    const submitted = await this.dependencies.loanRepository.findByStatus(LoanStatus.SUBMITTED);
    return submitted.map(toLoanResponse);
  }

  public async update(
    loanId: string,
    userId: string,
    input: UpdateLoanApplicationInput,
    context: RequestContext,
  ): Promise<LoanApplicationResponse> {
    const loan = await this.dependencies.loanRepository.findById(loanId);

    if (!loan) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    this.assertOwner(loan, userId);

    const currentStatus = loan.status as LoanStatus;
    if (currentStatus !== LoanStatus.DRAFT && currentStatus !== LoanStatus.MORE_INFO_REQUIRED) {
      throw new AppError({
        code: 'CANNOT_UPDATE_SUBMITTED_LOAN',
        message: 'Can only update draft or more info required loans',
        statusCode: StatusCodes.BAD_REQUEST,
      });
    }

    const updated = await this.dependencies.loanRepository.update(loanId, input);

    if (!updated) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    await this.audit(userId, 'LOAN_UPDATED', loanId, context, {
      changes: Object.keys(input),
    });

    return toLoanResponse(updated);
  }

  public async submit(
    loanId: string,
    userId: string,
    context: RequestContext,
  ): Promise<LoanApplicationResponse> {
    const loan = await this.dependencies.loanRepository.findById(loanId);

    if (!loan) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    this.assertOwner(loan, userId);

    const currentStatus = loan.status as LoanStatus;
    validateStateTransition(currentStatus, LoanStatus.SUBMITTED);

    const submitted = await this.dependencies.loanRepository.submit(loanId);

    if (!submitted) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    await this.audit(userId, 'LOAN_SUBMITTED', loanId, context);

    // Trigger risk assessment asynchronously if service available
    try {
      const riskService = this.dependencies.riskAssessmentService;
      if (riskService) {
        const applicationData = {
          age: (loan as any).age ?? 35,
          annualIncome: submitted.annualIncome,
          employmentType: submitted.employmentType,
          existingDebt: submitted.existingDebt,
          creditScore: submitted.creditScore,
          loanAmount: submitted.loanAmount,
        };

        // fire-and-forget, but await to ensure persistence in tests
        await riskService.createRiskAssessment(loanId, applicationData, {
          userId,
          requestId: context.requestId,
          ipAddress: context.ipAddress,
        });
      }
    } catch (err) {
      // Do not block loan submission on AI failures; just log audit
      await this.audit(userId, 'RISK_ASSESSMENT_UPDATED', loanId, context, { error: String(err) });
    }

    return toLoanResponse(submitted);
  }

  public async startReview(
    loanId: string,
    officerId: string,
    context: RequestContext,
  ): Promise<LoanApplicationResponse> {
    const loan = await this.dependencies.loanRepository.findById(loanId);

    if (!loan) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    const currentStatus = loan.status as LoanStatus;
    validateStateTransition(currentStatus, LoanStatus.UNDER_REVIEW);

    const updated = await this.dependencies.loanRepository.startReview(loanId);

    if (!updated) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    await this.audit(officerId, 'LOAN_REVIEW_STARTED', loanId, context);

    return toLoanResponse(updated);
  }

  public async requestMoreInfo(
    loanId: string,
    officerId: string,
    context: RequestContext,
  ): Promise<LoanApplicationResponse> {
    const loan = await this.dependencies.loanRepository.findById(loanId);

    if (!loan) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    const currentStatus = loan.status as LoanStatus;
    validateStateTransition(currentStatus, LoanStatus.MORE_INFO_REQUIRED);

    const updated = await this.dependencies.loanRepository.requestMoreInfo(loanId);

    if (!updated) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    await this.audit(officerId, 'LOAN_INFO_REQUESTED', loanId, context);

    return toLoanResponse(updated);
  }

  public async approve(
    loanId: string,
    officerId: string,
    context: RequestContext,
  ): Promise<LoanApplicationResponse> {
    const loan = await this.dependencies.loanRepository.findById(loanId);

    if (!loan) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    const currentStatus = loan.status as LoanStatus;
    validateStateTransition(currentStatus, LoanStatus.APPROVED);

    const approved = await this.dependencies.loanRepository.approve(loanId);

    if (!approved) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    await this.audit(officerId, 'LOAN_APPROVED', loanId, context);

    return toLoanResponse(approved);
  }

  public async reject(
    loanId: string,
    officerId: string,
    context: RequestContext,
  ): Promise<LoanApplicationResponse> {
    const loan = await this.dependencies.loanRepository.findById(loanId);

    if (!loan) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    const currentStatus = loan.status as LoanStatus;
    validateStateTransition(currentStatus, LoanStatus.REJECTED);

    const rejected = await this.dependencies.loanRepository.reject(loanId);

    if (!rejected) {
      throw new AppError({
        code: 'LOAN_NOT_FOUND',
        message: 'Loan application not found',
        statusCode: StatusCodes.NOT_FOUND,
      });
    }

    await this.audit(officerId, 'LOAN_REJECTED', loanId, context);

    return toLoanResponse(rejected);
  }

  private assertOwner(loan: LoanApplicationDocument, userId: string): void {
    if (loan.userId.toString() !== userId) {
      throw new AppError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this loan',
        statusCode: StatusCodes.FORBIDDEN,
      });
    }
  }

  private assertCanView(loan: LoanApplicationDocument, userId: string, userRole: UserRole): void {
    if (userRole === UserRole.CUSTOMER && loan.userId.toString() !== userId) {
      throw new AppError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access this loan',
        statusCode: StatusCodes.FORBIDDEN,
      });
    }
  }

  private async audit(
    userId: string,
    action: string,
    loanId: string,
    context: RequestContext,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.dependencies.auditLogRepository.create({
      userId,
      action,
      resourceType: 'LoanApplication',
      resourceId: loanId,
      ipAddress: context.ipAddress,
      requestId: context.requestId,
      metadata,
    });
  }
}
