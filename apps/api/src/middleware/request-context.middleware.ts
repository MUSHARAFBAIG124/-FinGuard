import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

import { createRequestLogger } from '../config/logger';

export const requestContextMiddleware: RequestHandler = (request, response, next) => {
  const inboundRequestId = request.header('X-Request-Id')?.trim();
  const requestId = inboundRequestId || randomUUID();

  request.requestId = requestId;
  request.log = createRequestLogger(requestId);
  response.setHeader('X-Request-Id', requestId);

  request.log.info('Request started', {
    method: request.method,
    path: request.originalUrl,
  });

  response.on('finish', () => {
    request.log?.info('Request completed', {
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
    });
  });

  next();
};
