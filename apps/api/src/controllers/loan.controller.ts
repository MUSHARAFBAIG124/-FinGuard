import type { Request, RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';

import type { EmploymentType } from '@finguard/shared';

import { AppError } from '../errors/app-error';
import type { LoanService } from '../services/loan.service';
import type { RequestContext } from '../services/auth.types';
import { sendSuccess } from '../utils/api-response';
import { asyncHandler } from '../utils/async-handler';

interface CreateLoanBody {
  readonly loanAmount: number;
  readonly loanPurpose: string;
  readonly employmentType: EmploymentType;
  readonly annualIncome: number;
  readonly existingDebt: number;
  readonly creditScore: number;
}

interface UpdateLoanBody {
  readonly loanAmount?: number;
  readonly loanPurpose?: string;
  readonly employmentType?: EmploymentType;
  readonly annualIncome?: number;
  readonly existingDebt?: number;
  readonly creditScore?: number;
}

const getRequestContext = (request: Request): RequestContext => ({
  requestId: request.requestId,
  ipAddress: request.ip ?? 'unknown',
  userAgent: request.header('user-agent') ?? 'unknown',
});

const assertAuthenticated = (request: Request): string => {
  if (!request.auth) {
    throw new AppError({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication is required',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
  }
  return request.auth.sub;
};

export class LoanController {
  public constructor(private readonly loanService: LoanService) {}

  public create: RequestHandler = asyncHandler(async (request, response) => {
    const userId = assertAuthenticated(request);
    const input = request.body as CreateLoanBody;

    const loan = await this.loanService.create(
      userId,
      {
        ...input,
        userId,
      },
      getRequestContext(request),
    );

    sendSuccess(response, {
      statusCode: StatusCodes.CREATED,
      data: { loan },
    });
  });

  public listOwn: RequestHandler = asyncHandler(async (request, response) => {
    const userId = assertAuthenticated(request);

    const loans = await this.loanService.findByUser(userId);

    sendSuccess(response, {
      data: { loans },
    });
  });

  public listAll: RequestHandler = asyncHandler(async (request, response) => {
    assertAuthenticated(request);

    if (!request.auth || !['LOAN_OFFICER', 'ADMIN', 'RISK_ANALYST'].includes(request.auth.role)) {
      throw new AppError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to access all loans',
        statusCode: StatusCodes.FORBIDDEN,
      });
    }

    const loans = await this.loanService.findAll();

    sendSuccess(response, {
      data: { loans },
    });
  });

  public getById: RequestHandler = asyncHandler(async (request, response) => {
    const userId = assertAuthenticated(request);
    const loanId = (request.params as { id: string }).id;

    const loan = await this.loanService.findById(loanId, userId, request.auth!.role);

    sendSuccess(response, {
      data: { loan },
    });
  });

  public update: RequestHandler = asyncHandler(async (request, response) => {
    const userId = assertAuthenticated(request);
    const loanId = (request.params as { id: string }).id;
    const input = request.body as UpdateLoanBody;

    const loan = await this.loanService.update(loanId, userId, input, getRequestContext(request));

    sendSuccess(response, {
      data: { loan },
    });
  });

  public submit: RequestHandler = asyncHandler(async (request, response) => {
    const userId = assertAuthenticated(request);
    const loanId = (request.params as { id: string }).id;

    const loan = await this.loanService.submit(loanId, userId, getRequestContext(request));

    sendSuccess(response, {
      data: { loan },
    });
  });

  public getReviewQueue: RequestHandler = asyncHandler(async (request, response) => {
    const loans = await this.loanService.getReviewQueue();

    sendSuccess(response, {
      data: { loans },
    });
  });

  public startReview: RequestHandler = asyncHandler(async (request, response) => {
    const officerId = assertAuthenticated(request);
    const loanId = (request.params as { id: string }).id;

    const loan = await this.loanService.startReview(loanId, officerId, getRequestContext(request));

    sendSuccess(response, {
      data: { loan },
    });
  });

  public requestMoreInfo: RequestHandler = asyncHandler(async (request, response) => {
    const officerId = assertAuthenticated(request);
    const loanId = (request.params as { id: string }).id;

    const loan = await this.loanService.requestMoreInfo(
      loanId,
      officerId,
      getRequestContext(request),
    );

    sendSuccess(response, {
      data: { loan },
    });
  });

  public approve: RequestHandler = asyncHandler(async (request, response) => {
    const officerId = assertAuthenticated(request);
    const loanId = (request.params as { id: string }).id;

    const loan = await this.loanService.approve(loanId, officerId, getRequestContext(request));

    sendSuccess(response, {
      data: { loan },
    });
  });

  public reject: RequestHandler = asyncHandler(async (request, response) => {
    const officerId = assertAuthenticated(request);
    const loanId = (request.params as { id: string }).id;

    const loan = await this.loanService.reject(loanId, officerId, getRequestContext(request));

    sendSuccess(response, {
      data: { loan },
    });
  });
}
