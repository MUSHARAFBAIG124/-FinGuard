import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { LoanStatus, UserRole } from '@finguard/shared';

import { createApp } from './app';
import { createInMemoryAuthDependencies } from './tests/in-memory-auth-dependencies';
import { createInMemoryLoanDependencies } from './tests/in-memory-loan-dependencies';

interface LoanResponse {
  readonly id: string;
  readonly status: LoanStatus;
  readonly userId: string;
  readonly loanAmount: number;
  readonly loanPurpose: string;
  readonly employmentType: string;
  readonly annualIncome: number;
  readonly existingDebt: number;
  readonly creditScore: number;
  readonly submittedAt?: string;
  readonly decisionAt?: string;
}

interface RegisterResponse {
  readonly data: {
    readonly user: {
      readonly id: string;
      readonly email: string;
      readonly role: string;
      readonly isEmailVerified: boolean;
    };
  };
}

interface AuthResponse {
  readonly data: {
    readonly user: {
      readonly id: string;
      readonly email: string;
    };
    readonly tokens: {
      readonly accessToken: string;
      readonly refreshToken: string;
    };
  };
}

interface LoanApiResponse {
  readonly data: {
    readonly loan: LoanResponse;
  };
}

interface LoansApiResponse {
  readonly data: {
    readonly loans: readonly LoanResponse[];
  };
}

interface ErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

const mockLoan = {
  loanAmount: 50000,
  loanPurpose: 'Home renovation',
  employmentType: 'SALARIED',
  annualIncome: 120000,
  existingDebt: 5000,
  creditScore: 750,
};

const strongPassword = 'StrongPass123!';

describe('loan API integration', () => {
  it('creates, views, submits, and reviews a loan application', async () => {
    const { dependencies: authDependencies, store } = createInMemoryAuthDependencies();
    const { dependencies: loanDependencies } = createInMemoryLoanDependencies();
    const app = createApp({
      authDependencies,
      loanDependencies,
    });

    // Register customer
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'customer@example.com',
        password: strongPassword,
        firstName: 'John',
        lastName: 'Doe',
      })
      .expect(201);

    // Register loan officer
    const officerRegisterRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'officer@example.com',
        password: strongPassword,
        firstName: 'Officer',
        lastName: 'Smith',
      })
      .expect(201);

    const officerUserId = (officerRegisterRes.body as RegisterResponse).data.user.id;
    const officerUser = store.users.find((u) => u._id.toString() === officerUserId);
    if (officerUser) {
      officerUser.role = UserRole.LOAN_OFFICER;
    }

    const officerLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'officer@example.com',
        password: strongPassword,
      })
      .expect(200);

    const officerToken = (officerLoginRes.body as AuthResponse).data.tokens.accessToken;

    // Get customer token via login
    const customerLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'customer@example.com',
        password: strongPassword,
      })
      .expect(200);

    const customerAccessToken = (customerLoginRes.body as AuthResponse).data.tokens.accessToken;

    // Create loan as customer
    const createRes = await request(app)
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .send(mockLoan)
      .expect(201);

    const loanId = (createRes.body as LoanApiResponse).data.loan.id;
    const createdLoan = (createRes.body as LoanApiResponse).data.loan;

    expect(createdLoan.status).toBe(LoanStatus.DRAFT);
    expect(createdLoan.loanAmount).toBe(mockLoan.loanAmount);

    // View own loan
    const getRes = await request(app)
      .get(`/api/v1/loans/${loanId}`)
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .expect(200);

    expect((getRes.body as LoanApiResponse).data.loan.id).toBe(loanId);

    // List own loans
    const listRes = await request(app)
      .get('/api/v1/loans')
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .expect(200);

    expect((listRes.body as LoansApiResponse).data.loans.length).toBeGreaterThan(0);

    // Update loan (while DRAFT)
    const updateRes = await request(app)
      .patch(`/api/v1/loans/${loanId}`)
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .send({ loanAmount: 60000 })
      .expect(200);

    expect((updateRes.body as LoanApiResponse).data.loan.loanAmount).toBe(60000);

    // Submit loan
    const submitRes = await request(app)
      .post(`/api/v1/loans/${loanId}/submit`)
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .expect(200);

    expect((submitRes.body as LoanApiResponse).data.loan.status).toBe(LoanStatus.SUBMITTED);

    // Officer views review queue
    const queueRes = await request(app)
      .get('/api/v1/review/queue')
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    expect((queueRes.body as LoansApiResponse).data.loans.length).toBeGreaterThan(0);

    // Officer starts review
    const startRes = await request(app)
      .post(`/api/v1/review/${loanId}/start`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    expect((startRes.body as LoanApiResponse).data.loan.status).toBe(LoanStatus.UNDER_REVIEW);

    // Officer requests more info
    const moreInfoRes = await request(app)
      .post(`/api/v1/review/${loanId}/request-info`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    expect((moreInfoRes.body as LoanApiResponse).data.loan.status).toBe(
      LoanStatus.MORE_INFO_REQUIRED,
    );

    // Customer updates and resubmits
    const updateRes2 = await request(app)
      .patch(`/api/v1/loans/${loanId}`)
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .send({ loanAmount: 65000 })
      .expect(200);

    expect((updateRes2.body as LoanApiResponse).data.loan.loanAmount).toBe(65000);

    const resubmitRes = await request(app)
      .post(`/api/v1/loans/${loanId}/submit`)
      .set('Authorization', `Bearer ${customerAccessToken}`)
      .expect(200);

    expect((resubmitRes.body as LoanApiResponse).data.loan.status).toBe(LoanStatus.SUBMITTED);

    // Officer starts review again
    await request(app)
      .post(`/api/v1/review/${loanId}/start`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    // Officer approves
    const approveRes = await request(app)
      .post(`/api/v1/review/${loanId}/approve`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(200);

    const approveLoan = (approveRes.body as LoanApiResponse).data.loan;
    expect(approveLoan.status).toBe(LoanStatus.APPROVED);
    expect(approveLoan.decisionAt).toBeDefined();
  });

  it('prevents unauthorized access', async () => {
    const { dependencies: authDependencies } = createInMemoryAuthDependencies();
    const { dependencies: loanDependencies } = createInMemoryLoanDependencies();
    const app = createApp({
      authDependencies,
      loanDependencies,
    });

    // Register two customers
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'customer1@example.com',
        password: strongPassword,
        firstName: 'John',
        lastName: 'Doe',
      })
      .expect(201);

    const login1 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'customer1@example.com',
        password: strongPassword,
      })
      .expect(200);

    const token1 = (login1.body as AuthResponse).data.tokens.accessToken;

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'customer2@example.com',
        password: strongPassword,
        firstName: 'Jane',
        lastName: 'Smith',
      })
      .expect(201);

    const login2 = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'customer2@example.com',
        password: strongPassword,
      })
      .expect(200);

    const token2 = (login2.body as AuthResponse).data.tokens.accessToken;

    // Customer 1 creates loan
    const createRes = await request(app)
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${token1}`)
      .send(mockLoan)
      .expect(201);

    const loanId = (createRes.body as LoanApiResponse).data.loan.id;

    // Customer 2 tries to access Customer 1's loan
    const getRes = await request(app)
      .get(`/api/v1/loans/${loanId}`)
      .set('Authorization', `Bearer ${token2}`)
      .expect(403);

    expect((getRes.body as ErrorResponse).error.code).toBe('FORBIDDEN');

    // Customer 2 tries to update Customer 1's loan
    const updateRes = await request(app)
      .patch(`/api/v1/loans/${loanId}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ loanAmount: 70000 })
      .expect(403);

    expect((updateRes.body as ErrorResponse).error.code).toBe('FORBIDDEN');
  });

  it('validates loan creation input', async () => {
    const { dependencies: authDependencies } = createInMemoryAuthDependencies();
    const { dependencies: loanDependencies } = createInMemoryLoanDependencies();
    const app = createApp({
      authDependencies,
      loanDependencies,
    });

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'customer@example.com',
        password: strongPassword,
        firstName: 'John',
        lastName: 'Doe',
      })
      .expect(201);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'customer@example.com',
        password: strongPassword,
      })
      .expect(200);

    const customerToken = (loginRes.body as AuthResponse).data.tokens.accessToken;

    // Invalid loan amount
    await request(app)
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ ...mockLoan, loanAmount: 0 })
      .expect(400);

    // Invalid credit score
    await request(app)
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ ...mockLoan, creditScore: 299 })
      .expect(400);

    // Invalid employment type
    await request(app)
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ ...mockLoan, employmentType: 'INVALID' })
      .expect(400);
  });

  it('enforces state transitions', async () => {
    const { dependencies: authDependencies, store } = createInMemoryAuthDependencies();
    const { dependencies: loanDependencies } = createInMemoryLoanDependencies();
    const app = createApp({
      authDependencies,
      loanDependencies,
    });

    // Setup
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'customer@example.com',
        password: strongPassword,
        firstName: 'John',
        lastName: 'Doe',
      })
      .expect(201);

    const customerLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'customer@example.com',
        password: strongPassword,
      })
      .expect(200);

    const customerToken = (customerLoginRes.body as AuthResponse).data.tokens.accessToken;

    const officerRegisterRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'officer@example.com',
        password: strongPassword,
        firstName: 'Officer',
        lastName: 'Smith',
      })
      .expect(201);

    const officerUserId = (officerRegisterRes.body as RegisterResponse).data.user.id;
    const officerUser = store.users.find((u) => u._id.toString() === officerUserId);
    if (officerUser) {
      officerUser.role = UserRole.LOAN_OFFICER;
    }

    const officerLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'officer@example.com',
        password: strongPassword,
      })
      .expect(200);

    const officerToken = (officerLoginRes.body as AuthResponse).data.tokens.accessToken;

    // Create and submit loan
    const createRes = await request(app)
      .post('/api/v1/loans')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(mockLoan)
      .expect(201);

    const loanId = (createRes.body as LoanApiResponse).data.loan.id;

    await request(app)
      .post(`/api/v1/loans/${loanId}/submit`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    // Try to approve before starting review
    const approveRes = await request(app)
      .post(`/api/v1/review/${loanId}/approve`)
      .set('Authorization', `Bearer ${officerToken}`)
      .expect(400);

    expect((approveRes.body as ErrorResponse).error.code).toBe('INVALID_STATE_TRANSITION');
  });
});
