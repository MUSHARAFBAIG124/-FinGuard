import { describe, expect, it, vi } from 'vitest';

import { sendError, sendSuccess } from './api-response';

const createResponse = (requestId = 'request-123') => {
  const response = {
    req: { requestId },
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  return response;
};

describe('api response helpers', () => {
  it('emits the standard success envelope', () => {
    const response = createResponse();

    sendSuccess(response as never, { data: { ok: true } });

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      data: { ok: true },
      meta: { requestId: 'request-123' },
    });
  });

  it('emits the standard error envelope', () => {
    const response = createResponse();

    sendError(response as never, {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      statusCode: 400,
      details: [{ path: ['email'] }],
    });

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ path: ['email'] }],
      },
      meta: { requestId: 'request-123' },
    });
  });
});
