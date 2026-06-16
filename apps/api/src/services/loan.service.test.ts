import { describe, expect, it } from 'vitest';

import { EmploymentType, LoanStatus, UserRole } from '@finguard/shared';

import type { CreateLoanApplicationInput } from '../repositories/loan.repository';
import { LoanService } from '../services/loan.service';
import { createInMemoryLoanDependencies } from '../tests/in-memory-loan-dependencies';

const mockContext = {
  requestId: 'test-request-id',
  ipAddress: '127.0.0.1',
  userAgent: 'Test Agent',
};

const createMockLoan = (userId: string): CreateLoanApplicationInput => ({
  userId,
  loanAmount: 50000,
  loanPurpose: 'Home renovation',
  employmentType: EmploymentType.SALARIED,
  annualIncome: 120000,
  existingDebt: 0,
  creditScore: 750,
});

describe('LoanService', () => {
  describe('create', () => {
    it('creates a new loan in DRAFT status', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';

      const result = await service.create(userId, createMockLoan(userId), mockContext);

      expect(result.status).toBe(LoanStatus.DRAFT);
      expect(result.userId).toBe(userId);
      expect(result.loanAmount).toBe(50000);
    });
  });

  describe('state transitions', () => {
    it('allows DRAFT -> SUBMITTED transition', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';

      const created = await service.create(userId, createMockLoan(userId), mockContext);
      const submitted = await service.submit(created.id, userId, mockContext);

      expect(submitted.status).toBe(LoanStatus.SUBMITTED);
      expect(submitted.submittedAt).toBeDefined();
    });

    it('allows SUBMITTED -> UNDER_REVIEW transition', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';
      const officerId = 'officer-123';

      const created = await service.create(userId, createMockLoan(userId), mockContext);
      await service.submit(created.id, userId, mockContext);
      const underReview = await service.startReview(created.id, officerId, mockContext);

      expect(underReview.status).toBe(LoanStatus.UNDER_REVIEW);
    });

    it('allows UNDER_REVIEW -> APPROVED transition', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';
      const officerId = 'officer-123';

      const created = await service.create(userId, createMockLoan(userId), mockContext);
      await service.submit(created.id, userId, mockContext);
      await service.startReview(created.id, officerId, mockContext);
      const approved = await service.approve(created.id, officerId, mockContext);

      expect(approved.status).toBe(LoanStatus.APPROVED);
      expect(approved.decisionAt).toBeDefined();
    });

    it('allows UNDER_REVIEW -> REJECTED transition', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';
      const officerId = 'officer-123';

      const created = await service.create(userId, createMockLoan(userId), mockContext);
      await service.submit(created.id, userId, mockContext);
      await service.startReview(created.id, officerId, mockContext);
      const rejected = await service.reject(created.id, officerId, mockContext);

      expect(rejected.status).toBe(LoanStatus.REJECTED);
      expect(rejected.decisionAt).toBeDefined();
    });

    it('allows UNDER_REVIEW -> MORE_INFO_REQUIRED transition', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';
      const officerId = 'officer-123';

      const created = await service.create(userId, createMockLoan(userId), mockContext);
      await service.submit(created.id, userId, mockContext);
      await service.startReview(created.id, officerId, mockContext);
      const moreInfo = await service.requestMoreInfo(created.id, officerId, mockContext);

      expect(moreInfo.status).toBe(LoanStatus.MORE_INFO_REQUIRED);
    });

    it('allows MORE_INFO_REQUIRED -> SUBMITTED transition', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';
      const officerId = 'officer-123';

      const created = await service.create(userId, createMockLoan(userId), mockContext);
      await service.submit(created.id, userId, mockContext);
      await service.startReview(created.id, officerId, mockContext);
      await service.requestMoreInfo(created.id, officerId, mockContext);
      const resubmitted = await service.submit(created.id, userId, mockContext);

      expect(resubmitted.status).toBe(LoanStatus.SUBMITTED);
    });

    it('rejects invalid state transitions', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';

      const created = await service.create(userId, createMockLoan(userId), mockContext);

      await expect(service.approve(created.id, 'officer-123', mockContext)).rejects.toThrow();
    });
  });

  describe('authorization', () => {
    it('prevents non-owner from updating loan', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';
      const otherUserId = 'user-456';

      const created = await service.create(userId, createMockLoan(userId), mockContext);

      await expect(
        service.update(created.id, otherUserId, { loanAmount: 60000 }, mockContext),
      ).rejects.toThrow('You do not have permission');
    });

    it('prevents non-owner from submitting loan', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';
      const otherUserId = 'user-456';

      const created = await service.create(userId, createMockLoan(userId), mockContext);

      await expect(service.submit(created.id, otherUserId, mockContext)).rejects.toThrow(
        'You do not have permission',
      );
    });

    it('prevents customer from viewing other customers loans', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';
      const otherUserId = 'user-456';

      const created = await service.create(userId, createMockLoan(userId), mockContext);

      await expect(service.findById(created.id, otherUserId, UserRole.CUSTOMER)).rejects.toThrow(
        'You do not have permission',
      );
    });

    it('allows loan officer to view any loan', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';

      const created = await service.create(userId, createMockLoan(userId), mockContext);

      const viewed = await service.findById(created.id, 'officer-123', UserRole.LOAN_OFFICER);

      expect(viewed.id).toBe(created.id);
    });
  });

  describe('update', () => {
    it('allows updating DRAFT loan', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';

      const created = await service.create(userId, createMockLoan(userId), mockContext);
      const updated = await service.update(created.id, userId, { loanAmount: 60000 }, mockContext);

      expect(updated.loanAmount).toBe(60000);
    });

    it('allows updating MORE_INFO_REQUIRED loan', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';
      const officerId = 'officer-123';

      const created = await service.create(userId, createMockLoan(userId), mockContext);
      await service.submit(created.id, userId, mockContext);
      await service.startReview(created.id, officerId, mockContext);
      await service.requestMoreInfo(created.id, officerId, mockContext);
      const updated = await service.update(created.id, userId, { loanAmount: 60000 }, mockContext);

      expect(updated.loanAmount).toBe(60000);
    });

    it('prevents updating SUBMITTED loan', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';

      const created = await service.create(userId, createMockLoan(userId), mockContext);
      await service.submit(created.id, userId, mockContext);

      await expect(
        service.update(created.id, userId, { loanAmount: 60000 }, mockContext),
      ).rejects.toThrow('Can only update draft or more info required loans');
    });
  });

  describe('findByUser', () => {
    it('returns only loans for the specified user', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId1 = 'user-123';
      const userId2 = 'user-456';

      await service.create(userId1, createMockLoan(userId1), mockContext);
      await service.create(userId1, createMockLoan(userId1), mockContext);
      await service.create(userId2, createMockLoan(userId2), mockContext);

      const user1Loans = await service.findByUser(userId1);
      const user2Loans = await service.findByUser(userId2);

      expect(user1Loans).toHaveLength(2);
      expect(user2Loans).toHaveLength(1);
    });
  });

  describe('getReviewQueue', () => {
    it('returns only SUBMITTED loans', async () => {
      const { dependencies } = createInMemoryLoanDependencies();
      const service = new LoanService(dependencies);
      const userId = 'user-123';

      const created1 = await service.create(userId, createMockLoan(userId), mockContext);
      const created2 = await service.create(userId, createMockLoan(userId), mockContext);
      await service.submit(created1.id, userId, mockContext);
      await service.submit(created2.id, userId, mockContext);

      const queue = await service.getReviewQueue();

      expect(queue).toHaveLength(2);
      expect(queue.every((loan) => loan.status === LoanStatus.SUBMITTED)).toBe(true);
    });
  });
});
