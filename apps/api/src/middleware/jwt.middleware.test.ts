import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { UserRole } from '@finguard/shared';

import { env } from '../config/env';
import { TokenService } from '../services/token.service';
import { errorHandler } from './error.middleware';
import { createJwtMiddleware } from './jwt.middleware';
import { requestContextMiddleware } from './request-context.middleware';

interface JwtSuccessResponseBody {
  data: {
    sub: string;
    role: string;
    tokenType: string;
  };
}

interface JwtErrorResponseBody {
  error: {
    code: string;
  };
}

const createJwtTestApp = () => {
  const app = express();
  const userRepository = {
    findById: (id: string) =>
      Promise.resolve(
        id === 'user-123'
          ? {
              sessionVersion: 0,
            }
          : null,
      ),
  };

  app.use(requestContextMiddleware);
  app.get('/protected', createJwtMiddleware(new TokenService(), userRepository), (req, res) => {
    res.status(200).json({
      data: req.auth,
      meta: { requestId: req.requestId },
    });
  });
  app.use(errorHandler);

  return app;
};

describe('JWT middleware scaffold', () => {
  it('attaches auth payload for a valid access token', async () => {
    const token = jwt.sign(
      {
        sub: 'user-123',
        role: UserRole.ADMIN,
        sessionVersion: 0,
        tokenType: 'access',
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '5m' },
    );

    const response = await request(createJwtTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = response.body as JwtSuccessResponseBody;

    expect(body.data).toMatchObject({
      sub: 'user-123',
      role: UserRole.ADMIN,
      tokenType: 'access',
    });
  });

  it('rejects missing bearer tokens', async () => {
    const response = await request(createJwtTestApp()).get('/protected').expect(401);
    const body = response.body as JwtErrorResponseBody;

    expect(body.error.code).toBe('MISSING_TOKEN');
  });

  it('rejects malformed bearer tokens', async () => {
    const response = await request(createJwtTestApp())
      .get('/protected')
      .set('Authorization', 'Token abc')
      .expect(401);
    const body = response.body as JwtErrorResponseBody;

    expect(body.error.code).toBe('MALFORMED_TOKEN');
  });

  it('rejects expired bearer tokens', async () => {
    const token = jwt.sign(
      {
        sub: 'user-123',
        role: UserRole.ADMIN,
        sessionVersion: 0,
        tokenType: 'access',
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '-1s' },
    );

    const response = await request(createJwtTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    const body = response.body as JwtErrorResponseBody;

    expect(body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects tokens with invalid signatures', async () => {
    const token = jwt.sign(
      {
        sub: 'user-123',
        role: UserRole.ADMIN,
        sessionVersion: 0,
        tokenType: 'access',
      },
      'wrong-secret',
      { expiresIn: '5m' },
    );

    const response = await request(createJwtTestApp())
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
    const body = response.body as JwtErrorResponseBody;

    expect(body.error.code).toBe('INVALID_TOKEN');
  });
});
