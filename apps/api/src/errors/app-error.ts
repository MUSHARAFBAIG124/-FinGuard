import { StatusCodes } from 'http-status-codes';

export type ErrorDetails = readonly unknown[];

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: ErrorDetails;
  public readonly isOperational = true;

  public constructor({
    code,
    message,
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR,
    details,
  }: {
    code: string;
    message: string;
    statusCode?: number;
    details?: ErrorDetails;
  }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
