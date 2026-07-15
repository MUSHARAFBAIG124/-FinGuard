import { describe, it, expect, beforeEach } from 'vitest';
import { LoanStatus, EmploymentType } from '@finguard/shared';
import type { InMemoryLoanStore } from './in-memory-loan-dependencies';
import { createInMemoryLoanDependencies } from './in-memory-loan-dependencies';
import type { LoanRepository } from '../repositories/loan.repository';

describe('InMemoryLoanRepository', () => {
  let repository: LoanRepository;
  let store: InMemoryLoanStore;

  beforeEach(() => {
    const dependencies = createInMemoryLoanDependencies();
    repository = dependencies.dependencies.loanRepository;
    store = dependencies.store;
  });

  it('should create a loan', async () => {
    const loan = await repository.create({
      userId: 'user-1',
      loanAmount: 1000,
      loanPurpose: 'home',
      employmentType: EmploymentType.UNEMPLOYED,
      annualIncome: 50000,
      existingDebt: 10000,
      creditScore: 700,
    });

    expect(loan).toBeDefined();
    expect(loan.userId.toString()).toBe('user-1');
    expect(loan.status).toBe(LoanStatus.DRAFT);
    expect(store.loans.length).toBe(1);
  });

  it('should submit a loan', async () => {
    const loan = await repository.create({
      userId: 'user-1',
      loanAmount: 1000,
      loanPurpose: 'home',
      employmentType: EmploymentType.UNEMPLOYED,
      annualIncome: 50000,
      existingDebt: 10000,
      creditScore: 700,
    });

    const submitted = await repository.submit(loan._id.toString());
    expect(submitted?.status).toBe(LoanStatus.SUBMITTED);
    expect(submitted?.submittedAt).toBeInstanceOf(Date);
  });
});
