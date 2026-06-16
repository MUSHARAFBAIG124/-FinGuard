import type { EmploymentType, LoanStatus } from '@finguard/shared';

import type { LoanApplicationDocument } from '../models/loan-application.model';
import { LoanApplicationModel } from '../models/loan-application.model';

export interface CreateLoanApplicationInput {
  readonly userId: string;
  readonly loanAmount: number;
  readonly loanPurpose: string;
  readonly employmentType: EmploymentType;
  readonly annualIncome: number;
  readonly existingDebt: number;
  readonly creditScore: number;
  readonly status?: LoanStatus;
}

export interface UpdateLoanApplicationInput {
  readonly loanAmount?: number;
  readonly loanPurpose?: string;
  readonly employmentType?: EmploymentType;
  readonly annualIncome?: number;
  readonly existingDebt?: number;
  readonly creditScore?: number;
}

export interface LoanRepository {
  create(input: CreateLoanApplicationInput): Promise<LoanApplicationDocument>;
  findById(id: string): Promise<LoanApplicationDocument | null>;
  findByUserId(userId: string): Promise<readonly LoanApplicationDocument[]>;
  findByStatus(status: LoanStatus): Promise<readonly LoanApplicationDocument[]>;
  findAll(): Promise<readonly LoanApplicationDocument[]>;
  update(id: string, input: UpdateLoanApplicationInput): Promise<LoanApplicationDocument | null>;
  submit(id: string): Promise<LoanApplicationDocument | null>;
  startReview(id: string): Promise<LoanApplicationDocument | null>;
  approve(id: string): Promise<LoanApplicationDocument | null>;
  reject(id: string): Promise<LoanApplicationDocument | null>;
  requestMoreInfo(id: string): Promise<LoanApplicationDocument | null>;
  updateStatus(id: string, status: LoanStatus): Promise<LoanApplicationDocument | null>;
}

export class MongooseLoanRepository implements LoanRepository {
  public async create(input: CreateLoanApplicationInput): Promise<LoanApplicationDocument> {
    return LoanApplicationModel.create(input);
  }

  public async findById(id: string): Promise<LoanApplicationDocument | null> {
    return LoanApplicationModel.findById(id).exec();
  }

  public async findByUserId(userId: string): Promise<readonly LoanApplicationDocument[]> {
    return LoanApplicationModel.find({ userId }).exec();
  }

  public async findByStatus(status: LoanStatus): Promise<readonly LoanApplicationDocument[]> {
    return LoanApplicationModel.find({ status }).exec();
  }

  public async findAll(): Promise<readonly LoanApplicationDocument[]> {
    return LoanApplicationModel.find({}).exec();
  }

  public async update(
    id: string,
    input: UpdateLoanApplicationInput,
  ): Promise<LoanApplicationDocument | null> {
    return LoanApplicationModel.findByIdAndUpdate(id, input, { new: true }).exec();
  }

  public async submit(id: string): Promise<LoanApplicationDocument | null> {
    return LoanApplicationModel.findByIdAndUpdate(
      id,
      {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      { new: true },
    ).exec();
  }

  public async startReview(id: string): Promise<LoanApplicationDocument | null> {
    return LoanApplicationModel.findByIdAndUpdate(
      id,
      {
        status: 'UNDER_REVIEW',
      },
      { new: true },
    ).exec();
  }

  public async approve(id: string): Promise<LoanApplicationDocument | null> {
    return LoanApplicationModel.findByIdAndUpdate(
      id,
      {
        status: 'APPROVED',
        decisionAt: new Date(),
      },
      { new: true },
    ).exec();
  }

  public async reject(id: string): Promise<LoanApplicationDocument | null> {
    return LoanApplicationModel.findByIdAndUpdate(
      id,
      {
        status: 'REJECTED',
        decisionAt: new Date(),
      },
      { new: true },
    ).exec();
  }

  public async requestMoreInfo(id: string): Promise<LoanApplicationDocument | null> {
    return LoanApplicationModel.findByIdAndUpdate(
      id,
      {
        status: 'MORE_INFO_REQUIRED',
      },
      { new: true },
    ).exec();
  }

  public async updateStatus(
    id: string,
    status: LoanStatus,
  ): Promise<LoanApplicationDocument | null> {
    return LoanApplicationModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }
}
