import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';

import { UserStatus } from '@finguard/shared';

import { AuthService } from './auth.service';
import { createInMemoryAuthDependencies } from '../tests/in-memory-auth-dependencies';

const context = {
  requestId: 'service-test-request',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

describe('AuthService', () => {
  it('registers users as customers and prevents duplicate email registration', async () => {
    const { dependencies } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);

    const result = await service.register(
      {
        email: 'CUSTOMER@example.com',
        password: 'StrongPass123!',
        firstName: 'Ada',
        lastName: 'Lovelace',
      },
      context,
    );

    expect(result.user.email).toBe('customer@example.com');
    expect(result.user.role).toBe('CUSTOMER');
    await expect(
      service.register(
        {
          email: 'customer@example.com',
          password: 'StrongPass123!',
          firstName: 'Ada',
          lastName: 'Lovelace',
        },
        context,
      ),
    ).rejects.toThrow(/already exists/);
  });

  it('locks an account after repeated failed login attempts', async () => {
    const { dependencies, store } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);

    await service.register(
      {
        email: 'lockout@example.com',
        password: 'StrongPass123!',
        firstName: 'Grace',
        lastName: 'Hopper',
      },
      context,
    );

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.login(
          {
            email: 'lockout@example.com',
            password: 'WrongPass123!',
          },
          context,
        ),
      ).rejects.toThrow(/incorrect/);
    }

    expect(store.users[0]?.lockedUntil).toBeInstanceOf(Date);
    await expect(
      service.login(
        {
          email: 'lockout@example.com',
          password: 'StrongPass123!',
        },
        context,
      ),
    ).rejects.toThrow(/temporarily locked/);

    const lockedUser = store.users[0];
    if (lockedUser) {
      lockedUser.lockedUntil = new Date(Date.now() - 1000);
    }

    await expect(
      service.login(
        {
          email: 'lockout@example.com',
          password: 'StrongPass123!',
        },
        context,
      ),
    ).resolves.toMatchObject({
      user: {
        email: 'lockout@example.com',
      },
    });
    expect(store.users[0]?.failedLoginAttempts).toBe(0);
    expect(store.users[0]?.lockedUntil).toBeNull();
  });

  it('records audit events for register, login failure, login success, refresh, logout, and reset flows', async () => {
    const { dependencies, store } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);

    const registration = await service.register(
      {
        email: 'audit@example.com',
        password: 'StrongPass123!',
        firstName: 'Mary',
        lastName: 'Jackson',
      },
      context,
    );

    await expect(
      service.login(
        {
          email: 'audit@example.com',
          password: 'WrongPass123!',
        },
        context,
      ),
    ).rejects.toThrow(/incorrect/);

    const login = await service.login(
      {
        email: 'audit@example.com',
        password: 'StrongPass123!',
      },
      context,
    );
    const refreshed = await service.refresh(login.tokens.refreshToken, context);
    await service.logout(refreshed.tokens.refreshToken, context);
    await service.verifyEmail(registration.emailVerificationToken, context);
    const reset = await service.forgotPassword('audit@example.com', context);
    await service.resetPassword(reset.passwordResetToken ?? '', 'NewStrongPass123!', context);

    expect(store.auditLogs.map((log) => log.action)).toEqual(
      expect.arrayContaining([
        'REGISTER',
        'LOGIN_FAILURE',
        'LOGIN_SUCCESS',
        'TOKEN_REFRESH',
        'LOGOUT',
        'EMAIL_VERIFIED',
        'PASSWORD_RESET_REQUEST',
        'PASSWORD_RESET_SUCCESS',
      ]),
    );
    for (const auditLog of store.auditLogs) {
      expect(auditLog.userId.toString()).toBe(store.users[0]?._id.toString());
      expect(auditLog.requestId).toBe(context.requestId);
      expect(auditLog.timestamp).toBeInstanceOf(Date);
    }
  });

  it('rejects login for unknown or inactive users', async () => {
    const { dependencies, store } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);

    await expect(
      service.login(
        {
          email: 'missing@example.com',
          password: 'StrongPass123!',
        },
        context,
      ),
    ).rejects.toThrow(/incorrect/);

    await service.register(
      {
        email: 'inactive@example.com',
        password: 'StrongPass123!',
        firstName: 'Inactive',
        lastName: 'User',
      },
      context,
    );

    const inactiveUser = store.users[0];
    if (inactiveUser) {
      inactiveUser.status = UserStatus.SUSPENDED;
    }

    await expect(
      service.login(
        {
          email: 'inactive@example.com',
          password: 'StrongPass123!',
        },
        context,
      ),
    ).rejects.toThrow(/not active/);
  });

  it('rejects refresh tokens when the token user no longer exists', async () => {
    const { dependencies } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);
    const refreshToken = dependencies.tokenService.createRefreshToken();
    const missingUserId = new Types.ObjectId().toHexString();

    await dependencies.refreshTokenRepository.create({
      userId: missingUserId,
      tokenHash: refreshToken.tokenHash,
      expiresAt: refreshToken.expiresAt,
      deviceInfo: {
        userAgent: 'vitest',
        ipAddress: '127.0.0.1',
      },
    });

    await expect(service.refresh(refreshToken.token, context)).rejects.toThrow(
      /user was not found/,
    );
  });

  it('returns safe accepted responses for unknown password reset and verification resend emails', async () => {
    const { dependencies } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);

    await expect(service.forgotPassword('missing@example.com', context)).resolves.toEqual({
      accepted: true,
    });
    await expect(service.resendVerification('missing@example.com', context)).resolves.toEqual({
      accepted: true,
    });
  });

  it('rejects invalid verification and password reset tokens', async () => {
    const { dependencies } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);

    await expect(service.verifyEmail('invalid-verification-token', context)).rejects.toThrow(
      /invalid or expired/,
    );
    await expect(
      service.resetPassword('invalid-password-reset-token', 'NewStrongPass123!', context),
    ).rejects.toThrow(/invalid or expired/);
  });

  it('rejects current-user lookup when the authenticated user no longer exists', async () => {
    const { dependencies } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);

    await expect(service.getCurrentUser(new Types.ObjectId().toHexString())).rejects.toThrow(
      /not found/,
    );
  });

  it('treats logout with an invalid refresh token as idempotent', async () => {
    const { dependencies, store } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);

    await expect(service.logout('invalid-refresh-token', context)).resolves.toBeUndefined();
    expect(store.auditLogs.map((log) => log.action)).not.toContain('LOGOUT');
  });

  it('revokes logout refresh tokens without audit records when the token user is gone', async () => {
    const { dependencies, store } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);
    const refreshToken = dependencies.tokenService.createRefreshToken();
    const missingUserId = new Types.ObjectId().toHexString();

    await dependencies.refreshTokenRepository.create({
      userId: missingUserId,
      tokenHash: refreshToken.tokenHash,
      expiresAt: refreshToken.expiresAt,
      deviceInfo: {
        userAgent: 'vitest',
        ipAddress: '127.0.0.1',
      },
    });

    await expect(service.logout(refreshToken.token, context)).resolves.toBeUndefined();
    expect(store.refreshTokens[0]?.revokedAt).toBeInstanceOf(Date);
    expect(store.auditLogs.map((log) => log.action)).not.toContain('LOGOUT');
  });

  it('rejects verification tokens whose user no longer exists', async () => {
    const { dependencies } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);
    const verificationToken = dependencies.tokenService.createEmailVerificationToken();
    const missingUserId = new Types.ObjectId().toHexString();

    await dependencies.emailVerificationTokenRepository.create({
      userId: missingUserId,
      tokenHash: verificationToken.tokenHash,
      expiresAt: verificationToken.expiresAt,
    });

    await expect(service.verifyEmail(verificationToken.token, context)).rejects.toThrow(
      /user was not found/,
    );
  });

  it('resends verification tokens for existing unverified users', async () => {
    const { dependencies, store } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);

    await service.register(
      {
        email: 'resend@example.com',
        password: 'StrongPass123!',
        firstName: 'Resend',
        lastName: 'Verification',
      },
      context,
    );

    const result = await service.resendVerification('resend@example.com', context);

    expect(result.accepted).toBe(true);
    expect(result.emailVerificationToken).toBeTruthy();
    expect(store.emailVerificationTokens).toHaveLength(2);
    expect(store.auditLogs.map((log) => log.action)).toContain('EMAIL_VERIFICATION_RESENT');
  });

  it('consumes password reset tokens and revokes sessions without success audit when the user is gone', async () => {
    const { dependencies, store } = createInMemoryAuthDependencies();
    const service = new AuthService(dependencies);
    const resetToken = dependencies.tokenService.createPasswordResetToken();
    const missingUserId = new Types.ObjectId().toHexString();

    await dependencies.passwordResetTokenRepository.create({
      userId: missingUserId,
      tokenHash: resetToken.tokenHash,
      expiresAt: resetToken.expiresAt,
    });

    await expect(
      service.resetPassword(resetToken.token, 'NewStrongPass123!', context),
    ).resolves.toBeUndefined();
    expect(store.passwordResetTokens[0]?.usedAt).toBeInstanceOf(Date);
    expect(store.auditLogs.map((log) => log.action)).not.toContain('PASSWORD_RESET_SUCCESS');
  });
});
