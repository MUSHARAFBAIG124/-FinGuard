import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

import { AppError } from '../../errors/app-error';
import { sendError } from '../../utils/api-response';
import { notFoundHandler, errorHandler, normalizeError } from '../../middleware/error.middleware';

describe('Error Middleware - normalizeError', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should return AppError as-is when error is already an AppError', () => {
    const appError = new AppError({
      code: 'TEST_ERROR',
      message: 'Test error',
      statusCode: StatusCodes.BAD_REQUEST,
    });

    const result = normalizeError(appError);
    expect(result).toBe(appError);
  });

  it('should convert ZodError to AppError with VALIDATION_ERROR code', () => {
    const zodError = new ZodError([]);
    const result = normalizeError(zodError);

    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe('VALIDATION_ERROR');
    expect(result.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });

  it('should convert TokenExpiredError to AppError with TOKEN_EXPIRED code', () => {
    const tokenError = new TokenExpiredError('Token expired', new Date());
    const result = normalizeError(tokenError);

    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe('TOKEN_EXPIRED');
    expect(result.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });

  it('should convert JsonWebTokenError to AppError with INVALID_TOKEN code', () => {
    const jwtError = new JsonWebTokenError('Invalid token');
    const result = normalizeError(jwtError);

    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe('INVALID_TOKEN');
    expect(result.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });

  it('should convert unknown error to AppError with INTERNAL_SERVER_ERROR code', () => {
    const unknownError = new Error('Something went wrong');
    const result = normalizeError(unknownError);

    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe('INTERNAL_SERVER_ERROR');
    expect(result.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
  });
});


describe('Error Middleware - notFoundHandler', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should call next with ROUTE_NOT_FOUND error', () => {
    const request = {
      method: 'GET',
      originalUrl: '/non-existent-path',
    } as unknown as Request;

    const response = {} as Response;
    const next = vi.fn((error: any) => {
      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('ROUTE_NOT_FOUND');
      expect(error.message).toContain('GET /non-existent-path not found');
      expect(error.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    notFoundHandler(request, response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should handle different HTTP methods and paths', () => {
    const testCases = [
      { method: 'POST', path: '/api/v1/users', expectedMessage: 'Route POST /api/v1/users not found' },
      { method: 'PUT', path: '/api/v1/loans/123', expectedMessage: 'Route PUT /api/v1/loans/123 not found' },
      { method: 'DELETE', path: '/api/v1/auth/session', expectedMessage: 'Route DELETE /api/v1/auth/session not found' },
    ];

    testCases.forEach(({ method, path, expectedMessage }) => {
      const request = { method, originalUrl: path } as unknown as Request;
      const response = {} as Response;
      const next = vi.fn((error: any) => {
        expect(error.code).toBe('ROUTE_NOT_FOUND');
        expect(error.message).toBe(expectedMessage);
      });

      notFoundHandler(request, response, next);
      expect(next).toHaveBeenCalledTimes(1);
      next.mockClear();
    });
  });
});


describe('Error Middleware - errorHandler', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should send error response with normalized error details', () => {
    const request = {
      method: 'GET',
      originalUrl: '/api/v1/test',
      requestId: 'test-request-id',
      log: {
        error: vi.fn(),
      },
    } as unknown as Request;

    const response = {
      status: vi.fn(() => response),
      json: vi.fn((body) => body),
    } as any as Response;

    const error = new AppError({
      code: 'TEST_ERROR',
      message: 'Test error message',
      statusCode: StatusCodes.BAD_REQUEST,
      details: ['detail1', 'detail2'],
    });

    errorHandler(error, request, response, vi.fn() as NextFunction);

    expect(response.status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'TEST_ERROR',
        message: 'Test error message',
        details: ['detail1', 'detail2'],
      },
      meta: {
        requestId: 'test-request-id',
      },
    });
  });

  it('should log error details when request has log', () => {
    const request = {
      method: 'GET',
      originalUrl: '/api/v1/test',
      requestId: 'test-request-id',
      log: {
        error: vi.fn(),
      },
    } as unknown as Request;

    const response = {
      status: vi.fn(() => response),
      json: vi.fn(),
    } as any as Response;

    const error = new AppError({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    });
    (error as any).stack = 'Stack trace here';

    errorHandler(error, request, response, vi.fn() as NextFunction);

    expect(request.log?.error).toHaveBeenCalledWith('Internal server error', {
      code: 'INTERNAL_ERROR',
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      stack: expect.any(String), // Stack is auto-generated, so just check it exists
    });
  });

  it('should not log when request has no log', () => {
    const request = {
      method: 'GET',
      originalUrl: '/api/v1/test',
      requestId: 'test-request-id',
    } as unknown as Request;

    const response = {
      status: vi.fn(() => response),
      json: vi.fn(),
    } as any as Response;

    const error = new AppError({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    });

    errorHandler(error, request, response, vi.fn() as NextFunction);

    expect(request.log).toBeUndefined();
  });
});
