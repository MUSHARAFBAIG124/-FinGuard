import { LoanStatus } from '@finguard/shared';
import { Types } from 'mongoose';

import type { LoanApplicationDocument } from '../models/loan-application.model';
import type {
  CreateLoanApplicationInput,
  LoanRepository,
  UpdateLoanApplicationInput,
} from '../repositories/loan.repository';
import type { AuditLogRepository, CreateAuditLogInput } from '../repositories/audit-log.repository';
import type { AuditLogDocument } from '../models/audit-log.model';
import type { LoanServiceDependencies } from '../services/loan.service';
import type {
  RiskAssessmentRepository,
  CreateRiskAssessmentInput,
} from '../repositories/risk-assessment.repository';
import type { RiskAssessmentDocument } from '../models/risk-assessment.model';
import { RiskAssessmentService } from '../services/risk-assessment.service';
import { InMemoryModelMetricsRepository } from './in-memory-model-metrics';
import { ModelMetricsService } from '../services/model-metrics.service';

type StoredLoan = LoanApplicationDocument & {
  submittedAt: Date | null;
  decisionAt: Date | null;
};

class InMemoryLoanRepository implements LoanRepository {
  public constructor(private readonly loans: StoredLoan[]) {}

  public create(input: CreateLoanApplicationInput): Promise<LoanApplicationDocument> {
    const loan = {
      _id: new Types.ObjectId(),
      ...input,
      userId: input.userId as unknown as InstanceType<typeof Types.ObjectId>,
      status: input.status ?? LoanStatus.DRAFT,
      submittedAt: null,
      decisionAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as StoredLoan;

    this.loans.push(loan);
    return Promise.resolve(loan);
  }

  public findById(id: string): Promise<LoanApplicationDocument | null> {
    return Promise.resolve(this.loans.find((loan) => loan._id.toString() === id) ?? null);
  }

  public findByUserId(userId: string): Promise<readonly LoanApplicationDocument[]> {
    // Handle both ObjectId hex strings and string IDs like 'user-123'
    return Promise.resolve(
      this.loans.filter((loan) => {
        const loanUserId = loan.userId.toString();
        return loanUserId === userId || loan.userId.toString() === userId;
      }),
    );
  }

  public findByStatus(status: LoanStatus): Promise<readonly LoanApplicationDocument[]> {
    return Promise.resolve(this.loans.filter((loan) => (loan.status as LoanStatus) === status));
  }

  public findAll(): Promise<readonly LoanApplicationDocument[]> {
    return Promise.resolve([...this.loans]);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async update(
    id: string,
    input: UpdateLoanApplicationInput,
  ): Promise<LoanApplicationDocument | null> {
    const loan = this.loans.find((l) => l._id.toString() === id);

    if (!loan) {
      return null;
    }

    Object.assign(loan, input);
    loan.updatedAt = new Date();
    return loan;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async submit(id: string): Promise<LoanApplicationDocument | null> {
    const loan = this.loans.find((l) => l._id.toString() === id);

    if (!loan) {
      return null;
    }

    loan.status = LoanStatus.SUBMITTED;
    loan.submittedAt = new Date();
    loan.updatedAt = new Date();
    return loan;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async startReview(id: string): Promise<LoanApplicationDocument | null> {
    const loan = this.loans.find((l) => l._id.toString() === id);

    if (!loan) {
      return null;
    }

    loan.status = LoanStatus.UNDER_REVIEW;
    loan.updatedAt = new Date();
    return loan;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async approve(id: string): Promise<LoanApplicationDocument | null> {
    const loan = this.loans.find((l) => l._id.toString() === id);

    if (!loan) {
      return null;
    }

    loan.status = LoanStatus.APPROVED;
    loan.decisionAt = new Date();
    loan.updatedAt = new Date();
    return loan;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async reject(id: string): Promise<LoanApplicationDocument | null> {
    const loan = this.loans.find((l) => l._id.toString() === id);

    if (!loan) {
      return null;
    }

    loan.status = LoanStatus.REJECTED;
    loan.decisionAt = new Date();
    loan.updatedAt = new Date();
    return loan;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async requestMoreInfo(id: string): Promise<LoanApplicationDocument | null> {
    const loan = this.loans.find((l) => l._id.toString() === id);

    if (!loan) {
      return null;
    }

    loan.status = LoanStatus.MORE_INFO_REQUIRED;
    loan.updatedAt = new Date();
    return loan;
  }

  public async updateStatus(
    id: string,
    status: LoanStatus,
  ): Promise<LoanApplicationDocument | null> {
    const loan = this.loans.find((l) => l._id.toString() === id);
    if (!loan) return null;
    loan.status = status;
    loan.updatedAt = new Date();
    return loan;
  }
}

class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly logs: AuditLogDocument[] = [];

  public async create(input: CreateAuditLogInput): Promise<AuditLogDocument> {
    const log = {
      ...input,
      _id: new Types.ObjectId(),
      timestamp: new Date(),
    } as unknown as AuditLogDocument;
    this.logs.push(log);
    return log;
  }

  public async findByUserId(userId: string): Promise<readonly AuditLogDocument[]> {
    return this.logs.filter((log) => log.userId.toString() === userId);
  }

  public async findByResource(
    resourceType: string,
    resourceId: string,
  ): Promise<readonly AuditLogDocument[]> {
    return this.logs.filter(
      (log) => log.resourceType === resourceType && log.resourceId === resourceId,
    );
  }
}

class InMemoryRiskAssessmentRepository implements RiskAssessmentRepository {
  private readonly store: RiskAssessmentDocument[] = [];

  public async create(input: CreateRiskAssessmentInput): Promise<RiskAssessmentDocument> {
    const rec = {
      ...input,
      _id: new Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as RiskAssessmentDocument;
    this.store.push(rec);
    return rec;
  }

  public async findByLoanApplicationId(
    loanApplicationId: string,
  ): Promise<readonly RiskAssessmentDocument[]> {
    return this.store.filter((r) => r.loanApplicationId.toString() === loanApplicationId);
  }

  public async findLatestByLoanApplicationId(
    loanApplicationId: string,
  ): Promise<RiskAssessmentDocument | null> {
    const items = this.store.filter((r) => r.loanApplicationId.toString() === loanApplicationId);
    return items[items.length - 1] ?? null;
  }
}

export interface InMemoryLoanStore {
  readonly loans: StoredLoan[];
}

export const createInMemoryLoanDependencies = (): {
  readonly dependencies: LoanServiceDependencies & { modelMetricsService: ModelMetricsService };
  readonly store: InMemoryLoanStore;
  readonly repos?: {
    riskAssessmentRepository?: import('../repositories/risk-assessment.repository').RiskAssessmentRepository;
    auditLogRepository?: import('../repositories/audit-log.repository').AuditLogRepository;
    modelMetricsRepository?: import('./in-memory-model-metrics').InMemoryModelMetricsRepository;
  };
  readonly modelMetricsService: ModelMetricsService;
} => {
  const store: InMemoryLoanStore = {
    loans: [],
  };
  const auditLogRepository = new InMemoryAuditLogRepository();
  const riskAssessmentRepository = new InMemoryRiskAssessmentRepository();
  const modelMetricsRepository = new InMemoryModelMetricsRepository();
  const modelMetricsService = new ModelMetricsService({ modelMetricsRepository });

  const deps: any = {
    loanRepository: new InMemoryLoanRepository(store.loans),
    auditLogRepository,
    riskAssessmentService: new RiskAssessmentService({
      riskAssessmentRepository,
      auditLogRepository,
      modelMetricsService,
    }),
    modelMetricsService,
  };

  return {
    store,
    repos: { riskAssessmentRepository, auditLogRepository, modelMetricsRepository },
    dependencies: deps,
    modelMetricsService,
  };
};
