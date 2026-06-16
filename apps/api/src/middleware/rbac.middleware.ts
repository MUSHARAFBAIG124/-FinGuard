import type { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';

import type { UserRole } from '@finguard/shared';

import { AppError } from '../errors/app-error';

export const requireRole =
  (...allowedRoles: readonly UserRole[]): RequestHandler =>
  (request, _response, next) => {
    if (!request.auth) {
      next(
        new AppError({
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required',
          statusCode: StatusCodes.UNAUTHORIZED,
        }),
      );
      return;
    }

    if (!allowedRoles.includes(request.auth.role)) {
      next(
        new AppError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource',
          statusCode: StatusCodes.FORBIDDEN,
        }),
      );
      return;
    }

    next();
  };
