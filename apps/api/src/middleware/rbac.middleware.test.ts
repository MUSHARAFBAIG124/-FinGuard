import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { UserRole } from '@finguard/shared';

import { createJwtMiddleware } from './jwt.middleware';
import { errorHandler } from './error.middleware';
import { requireRole } from './rbac.middleware';
import { requestContextMiddleware } from './request-context.middleware';
import { TokenService } from '../services/token.service';

const createRbacTestApp = (role?: UserRole) => {
  const app = express();

  app.use(requestContextMiddleware);
  app.get(
    '/admin',
    (request, _response, next) => {
      if (role) {
        request.auth = {
          sub: 'user-123',
          role,
          tokenType: 'access',
        };
      }

      next();
    },
    requireRole(UserRole.ADMIN),
    (_request, response) => response.status(204).send(),
  );
  app.use(errorHandler);

  return app;
};

const createSingleRoleAllowedApp = (authenticatedRole: UserRole, requiredRole: UserRole) => {
  const app = express();

  app.use(requestContextMiddleware);
  app.get(
    '/role',
    (request, _response, next) => {
      request.auth = {
        sub: 'user-123',
        role: authenticatedRole,
        tokenType: 'access',
      };
      next();
    },
    requireRole(requiredRole),
    (_request, response) => response.status(204).send(),
  );
  app.use(errorHandler);

  return app;
};

const createJwtRbacTestApp = () => {
  const tokenService = new TokenService();
  const app = express();

  app.use(requestContextMiddleware);
  app.get(
    '/analyst-or-admin',
    createJwtMiddleware(tokenService),
    requireRole(UserRole.RISK_ANALYST, UserRole.ADMIN),
    (_request, response) => response.status(204).send(),
  );
  app.use(errorHandler);

  return { app, tokenService };
};

interface ErrorBody {
  readonly error: {
    readonly code: string;
  };
}

describe('RBAC middleware', () => {
  it('allows users with an accepted role', async () => {
    await request(createRbacTestApp(UserRole.ADMIN)).get('/admin').expect(204);
  });

  it('allows each shared role when that exact role is required', async () => {
    for (const role of [
      UserRole.CUSTOMER,
      UserRole.LOAN_OFFICER,
      UserRole.RISK_ANALYST,
      UserRole.ADMIN,
    ]) {
      await request(createSingleRoleAllowedApp(role, role)).get('/role').expect(204);
    }
  });

  it('rejects authenticated users without an accepted role', async () => {
    const response = await request(createRbacTestApp(UserRole.CUSTOMER)).get('/admin').expect(403);
    const body = response.body as ErrorBody;

    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(createRbacTestApp()).get('/admin').expect(401);
    const body = response.body as ErrorBody;

    expect(body.error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('allows multiple role requirements with JWT authentication', async () => {
    const { app, tokenService } = createJwtRbacTestApp();
    const analystToken = tokenService.createAccessToken({
      sub: 'analyst-123',
      role: UserRole.RISK_ANALYST,
    });
    const adminToken = tokenService.createAccessToken({
      sub: 'admin-123',
      role: UserRole.ADMIN,
    });

    await request(app)
      .get('/analyst-or-admin')
      .set('Authorization', `Bearer ${analystToken}`)
      .expect(204);
    await request(app)
      .get('/analyst-or-admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('denies every non-allowed shared role and invalid tokens', async () => {
    const { app, tokenService } = createJwtRbacTestApp();

    for (const role of [UserRole.CUSTOMER, UserRole.LOAN_OFFICER]) {
      const token = tokenService.createAccessToken({
        sub: `${role.toLowerCase()}-123`,
        role,
      });
      const response = await request(app)
        .get('/analyst-or-admin')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      const body = response.body as ErrorBody;

      expect(body.error.code).toBe('FORBIDDEN');
    }

    const missingResponse = await request(app).get('/analyst-or-admin').expect(401);
    const invalidResponse = await request(app)
      .get('/analyst-or-admin')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);

    expect((missingResponse.body as ErrorBody).error.code).toBe('MISSING_TOKEN');
    expect((invalidResponse.body as ErrorBody).error.code).toBe('INVALID_TOKEN');
  });
});
