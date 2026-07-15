import type { ErrorRequestHandler, RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';

import { AppError, isAppError } from '../errors/app-error';
import { sendError } from '../utils/api-response';

const isMalformedJsonError = (error: unknown): error is { type: string; status?: number } =>
  typeof error === 'object' &&
  error !== null &&
  'type' in error &&
  (error as { type?: unknown }).type === 'entity.parse.failed';

export const normalizeError = (error: unknown): AppError => {
  if (isAppError(error)) {
    return error;
  }

  if (isMalformedJsonError(error)) {
    return new AppError({
      code: 'BAD_REQUEST',
      message: 'Malformed JSON request body',
      statusCode: StatusCodes.BAD_REQUEST,
    });
  }

  if (error instanceof ZodError) {
    return new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      statusCode: StatusCodes.BAD_REQUEST,
      details: error.issues,
    });
  }

  if (error instanceof jwt.TokenExpiredError) {
    return new AppError({
      code: 'TOKEN_EXPIRED',
      message: 'Access token has expired',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
  }

  if (error instanceof jwt.JsonWebTokenError) {
    return new AppError({
      code: 'INVALID_TOKEN',
      message: 'Access token is invalid',
      statusCode: StatusCodes.UNAUTHORIZED,
    });
  }

  console.error('Unhandled error:', error);
  return new AppError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
  });
};

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new AppError({
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${request.method} ${request.originalUrl} not found`,
      statusCode: StatusCodes.NOT_FOUND,
    }),
  );
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  void _next;

  const normalizedError = normalizeError(error);

  request.log?.error(normalizedError.message, {
    code: normalizedError.code,
    statusCode: normalizedError.statusCode,
    stack: normalizedError.stack,
  });

  sendError(response, {
    code: normalizedError.code,
    message: normalizedError.message,
    statusCode: normalizedError.statusCode,
    details: normalizedError.details,
    requestId: request.requestId,
  });
};
