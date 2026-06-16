import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app';
import { createInMemoryAuthDependencies } from './tests/in-memory-auth-dependencies';

interface RegisterBody {
  readonly data: {
    readonly user: {
      readonly id: string;
      readonly email: string;
      readonly role: string;
      readonly isEmailVerified: boolean;
    };
    readonly emailVerification: {
      readonly token: string;
    };
  };
}

interface AuthBody {
  readonly data: {
    readonly user: {
      readonly id: string;
      readonly email: string;
    };
    readonly tokens: {
      readonly accessToken: string;
      readonly refreshToken: string;
    };
  };
}

interface ErrorBody {
  readonly error: {
    readonly code: string;
  };
}

interface TokenEnvelope {
  readonly data: {
    readonly passwordReset?: {
      readonly token?: string;
    };
    readonly emailVerification?: {
      readonly token?: string;
    };
    readonly accepted?: boolean;
  };
}

const strongPassword = 'StrongPass123!';

const createAuthTestApp = () => {
  const { dependencies, store } = createInMemoryAuthDependencies();
  return {
    app: createApp({ authDependencies: dependencies }),
    store,
  };
};

describe('auth API integration', () => {
  it('registers, logs in, returns current user, refreshes, and logs out', async () => {
    const { app, store } = createAuthTestApp();

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'CUSTOMER@example.com',
        password: strongPassword,
        firstName: 'Ada',
        lastName: 'Lovelace',
      })
      .expect(201);
    const registerBody = registerResponse.body as RegisterBody;

    expect(registerBody.data.user).toMatchObject({
      email: 'customer@example.com',
      role: 'CUSTOMER',
      isEmailVerified: false,
    });
    expect(store.users).toHaveLength(1);
    expect(store.users[0]?.passwordHash).not.toBe(strongPassword);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'customer@example.com',
        password: strongPassword,
      })
      .expect(200);
    const loginBody = loginResponse.body as AuthBody;

    expect(loginResponse.headers['set-cookie']).toBeDefined();
    expect(loginBody.data.tokens.accessToken).toBeTruthy();
    expect(loginBody.data.tokens.refreshToken).toBeTruthy();

    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginBody.data.tokens.accessToken}`)
      .expect(200);
    const meBody = meResponse.body as { data: { user: { email: string } } };

    expect(meBody.data.user.email).toBe('customer@example.com');

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginBody.data.tokens.refreshToken })
      .expect(200);
    const refreshBody = refreshResponse.body as AuthBody;

    expect(refreshBody.data.tokens.refreshToken).not.toBe(loginBody.data.tokens.refreshToken);
    expect(store.refreshTokens.filter((token) => token.revokedAt !== null)).toHaveLength(1);

    const oldRefreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginBody.data.tokens.refreshToken })
      .expect(401);
    const oldRefreshBody = oldRefreshResponse.body as ErrorBody;

    expect(oldRefreshBody.error.code).toBe('INVALID_REFRESH_TOKEN');

    const secondRefreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refreshBody.data.tokens.refreshToken })
      .expect(200);
    const secondRefreshBody = secondRefreshResponse.body as AuthBody;
    expect(secondRefreshBody.data.tokens.accessToken).toBeTruthy();
    expect(secondRefreshBody.data.tokens.refreshToken).not.toBe(
      refreshBody.data.tokens.refreshToken,
    );

    await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: secondRefreshBody.data.tokens.refreshToken })
      .expect(200);
    expect(store.refreshTokens.every((token) => token.revokedAt !== null)).toBe(true);
  });

  it('verifies email and resends verification tokens without external email provider', async () => {
    const { app, store } = createAuthTestApp();

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'verify@example.com',
        password: strongPassword,
        firstName: 'Alan',
        lastName: 'Turing',
      })
      .expect(201);
    const registerBody = registerResponse.body as RegisterBody;

    await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: registerBody.data.emailVerification.token })
      .expect(200);
    expect(store.users[0]?.isEmailVerified).toBe(true);
    expect(store.emailVerificationTokens[0]?.usedAt).toBeInstanceOf(Date);

    const resendResponse = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'verify@example.com' })
      .expect(200);
    const resendBody = resendResponse.body as TokenEnvelope;

    expect(resendBody.data.accepted).toBe(true);
    expect(resendBody.data.emailVerification?.token).toBeUndefined();
  });

  it('supports forgot-password and reset-password token lifecycle', async () => {
    const { app, store } = createAuthTestApp();

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'reset@example.com',
        password: strongPassword,
        firstName: 'Katherine',
        lastName: 'Johnson',
      })
      .expect(201);

    const forgotResponse = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@example.com' })
      .expect(200);
    const forgotBody = forgotResponse.body as TokenEnvelope;
    const resetToken = forgotBody.data.passwordReset?.token;

    expect(resetToken).toBeTruthy();

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: resetToken,
        password: 'NewStrongPass123!',
      })
      .expect(200);
    expect(store.passwordResetTokens[0]?.usedAt).toBeInstanceOf(Date);

    await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'reset@example.com',
        password: strongPassword,
      })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'reset@example.com',
        password: 'NewStrongPass123!',
      })
      .expect(200);
  });

  it('validates registration payloads and rejects duplicate email addresses', async () => {
    const { app } = createAuthTestApp();

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid@example.com',
        password: 'weak',
        firstName: 'Weak',
        lastName: 'Password',
      })
      .expect(400);

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: strongPassword,
        firstName: 'First',
        lastName: 'User',
      })
      .expect(201);
    const duplicateResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'DUPLICATE@example.com',
        password: strongPassword,
        firstName: 'Second',
        lastName: 'User',
      })
      .expect(409);
    const duplicateBody = duplicateResponse.body as ErrorBody;

    expect(duplicateBody.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });
});
