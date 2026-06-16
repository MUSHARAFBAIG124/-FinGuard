import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { LoanController } from '../../controllers/loan.controller';
import { AppError } from '../../errors/app-error';

describe('LoanController listAll (role-based access control)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should throw FORBIDDEN when user lacks required role', async () => {
    const mockLoanService = {
      findAll: vi.fn(async () => []),
    };
    const controller = new LoanController(mockLoanService as any);

    const nextFn = vi.fn();
    const req: any = {
      auth: { sub: 'user-1', role: 'CUSTOMER' },
      requestId: 'req-1',
      ip: '127.0.0.1',
      header: () => 'test-agent',
    };

    const res: any = {
      status: vi.fn(() => res),
      json: vi.fn((body) => body),
    };

    // Call the handler - asyncHandler will call next(error) on throw
    await controller.listAll(req, res, nextFn);

    // Verify next was called with an AppError with FORBIDDEN code
    const error = nextFn!.mock.calls[0]![0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.statusCode).toBe(StatusCodes.FORBIDDEN);
  });
});


describe('LoanController reject (authenticated user)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should successfully reject a loan when authenticated', async () => {
    const rejectResponse = {
      id: 'loan-1',
      userId: 'user-1',
      status: 'REJECTED',
      loanAmount: 5000,
      loanPurpose: 'Home improvement',
      employmentType: 'FULL_TIME',
      annualIncome: 50000,
      existingDebt: 0,
      creditScore: 700,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockLoanService = {
      reject: vi.fn().mockResolvedValue(rejectResponse),
    };
    const controller = new LoanController(mockLoanService as any);

    const req: any = {
      auth: { sub: 'user-1', role: 'LOAN_OFFICER' },
      requestId: 'req-1',
      ip: '127.0.0.1',
      header: () => 'test-agent',
      params: { id: 'loan-1' },
      req: { requestId: 'req-1' }, // Needed for response.req.requestId
    };

    const res: any = {
      status: vi.fn(() => res),
      json: vi.fn((body) => body),
      req,
    };

    const nextFn = vi.fn();
    
    // Call the handler
    controller.reject(req, res, nextFn);
    
    // Give it time to execute async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify the service was called
    expect(mockLoanService.reject).toHaveBeenCalledWith('loan-1', 'user-1', expect.any(Object));
  });
});


describe('LoanController requestMoreInfo (unauthorized access)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should throw AUTHENTICATION_REQUIRED when user not authenticated', async () => {
    const mockLoanService = {
      requestMoreInfo: vi.fn(async () => null),
    };
    const controller = new LoanController(mockLoanService as any);

    const nextFn = vi.fn();
    const req: any = {
      // No auth - should fail authentication check
      requestId: 'req-1',
      ip: '127.0.0.1',
      header: () => 'test-agent',
      params: { id: 'loan-1' },
    };

    const res: any = {
      status: vi.fn(() => res),
      json: vi.fn((body) => body),
    };

    await controller.requestMoreInfo(req, res, nextFn);

    const error = nextFn!.mock.calls[0]![0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(error.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });
});


describe('LoanController approve (unauthorized access)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should throw AUTHENTICATION_REQUIRED when user not authenticated', async () => {
    const mockLoanService = {
      approve: vi.fn(async () => null),
    };
    const controller = new LoanController(mockLoanService as any);

    const nextFn = vi.fn();
    const req: any = {
      // No auth - should fail authentication check
      requestId: 'req-1',
      ip: '127.0.0.1',
      header: () => 'test-agent',
      params: { id: 'loan-1' },
    };

    const res: any = {
      status: vi.fn(() => res),
      json: vi.fn((body) => body),
    };

    await controller.approve(req, res, nextFn);

    const error = nextFn!.mock.calls[0]![0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(error.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });
});


describe('LoanController getById (unauthorized access)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should throw AUTHENTICATION_REQUIRED when user not authenticated', async () => {
    const mockLoanService = {
      findById: vi.fn(async () => null),
    };
    const controller = new LoanController(mockLoanService as any);

    const nextFn = vi.fn();
    const req: any = {
      // No auth - should fail authentication check
      requestId: 'req-1',
      ip: '127.0.0.1',
      header: () => 'test-agent',
      params: { id: 'loan-1' },
    };

    const res: any = {
      status: vi.fn(() => res),
      json: vi.fn((body) => body),
    };

    await controller.getById(req, res, nextFn);

    const error = nextFn!.mock.calls[0]![0];
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(error.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });
});
