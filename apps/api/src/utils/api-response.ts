import type { Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export interface ApiMeta {
  readonly requestId: string;
}

export interface ApiSuccessResponse<TData> {
  readonly data: TData;
  readonly meta: ApiMeta;
}

export interface ApiErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: readonly unknown[];
  };
  readonly meta: ApiMeta;
}

export const sendSuccess = <TData>(
  response: Response,
  {
    data,
    statusCode = StatusCodes.OK,
  }: {
    data: TData;
    statusCode?: number;
  },
): Response => {
  const body: ApiSuccessResponse<TData> = {
    data,
    meta: {
      requestId: response.req.requestId,
    },
  };

  return response.status(statusCode).json(body);
};

export const sendError = (
  response: Response,
  {
    code,
    message,
    statusCode,
    details,
    requestId,
  }: {
    code: string;
    message: string;
    statusCode: number;
    details?: readonly unknown[];
    requestId?: string;
  },
): Response => {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    meta: {
      requestId: requestId ?? response.req.requestId,
    },
  };

  return response.status(statusCode).json(body);
};
