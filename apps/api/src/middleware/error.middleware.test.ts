import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError } from '../errors/app-error';
import { errorHandler, notFoundHandler } from './error.middleware';
import { requestContextMiddleware } from './request-context.middleware';
import { validateRequest } from './validation.middleware';

interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: readonly unknown[];
  };
  meta: {
    requestId: string;
  };
}

const createErrorTestApp = () => {
  const app = express();

  app.use(express.json());
  app.use(requestContextMiddleware);
  app.post(
    '/validation',
    validateRequest({
      body: z.object({
        email: z.string().email(),
      }),
    }),
    (_req, res) => res.status(204).send(),
  );
  app.get('/operational-error', (_req, _res, next) => {
    next(new AppError({ code: 'EXPECTED_FAILURE', message: 'Expected failure', statusCode: 409 }));
  });
  app.get('/unexpected-error', () => {
    throw new Error('Unexpected failure');
  });
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

describe('error middleware', () => {
  it('maps validation errors to the standard error envelope', async () => {
    const response = await request(createErrorTestApp())
      .post('/validation')
      .send({ email: 'invalid' })
      .expect(400);
    const body = response.body as ErrorResponseBody;

    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details).toHaveLength(1);
    expect(body.meta.requestId).toBeTruthy();
  });

  it('maps malformed JSON to bad request without changing validation errors', async () => {
    const response = await request(createErrorTestApp())
      .post('/validation')
      .set('Content-Type', 'application/json')
      .send('{bad-json')
      .expect(400);
    const body = response.body as ErrorResponseBody;

    expect(body.error).toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Malformed JSON request body',
    });
  });

  it('maps operational errors to their configured status and code', async () => {
    const response = await request(createErrorTestApp()).get('/operational-error').expect(409);
    const body = response.body as ErrorResponseBody;

    expect(body.error).toMatchObject({
      code: 'EXPECTED_FAILURE',
      message: 'Expected failure',
    });
  });

  it('maps unexpected errors to internal server errors', async () => {
    const response = await request(createErrorTestApp()).get('/unexpected-error').expect(500);
    const body = response.body as ErrorResponseBody;

    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('maps unknown routes to route not found errors', async () => {
    const response = await request(createErrorTestApp()).get('/missing').expect(404);
    const body = response.body as ErrorResponseBody;

    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
