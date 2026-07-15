import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';

import { UserRole } from '@finguard/shared';

import { env } from '../config/env';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const service = new TokenService();

  it('creates and verifies access tokens', () => {
    const token = service.createAccessToken({
      sub: 'user-123',
      role: UserRole.ADMIN,
      sessionVersion: 0,
    });

    expect(service.verifyAccessToken(token)).toMatchObject({
      sub: 'user-123',
      role: UserRole.ADMIN,
      sessionVersion: 0,
      tokenType: 'access',
    });
  });

  it('rejects expired access tokens', () => {
    const expiredToken = jwt.sign(
      {
        sub: 'user-123',
        role: UserRole.ADMIN,
        tokenType: 'access',
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '-1s' },
    );

    expect(() => service.verifyAccessToken(expiredToken)).toThrow(/expired/);
  });

  it('rejects access tokens with invalid signatures', () => {
    const invalidToken = jwt.sign(
      {
        sub: 'user-123',
        role: UserRole.ADMIN,
        tokenType: 'access',
      },
      'wrong-secret',
      { expiresIn: '5m' },
    );

    expect(() => service.verifyAccessToken(invalidToken)).toThrow(/invalid signature/);
  });

  it('hashes opaque tokens without storing raw values', () => {
    const token = service.createRefreshToken();

    expect(token.token).not.toBe(token.tokenHash);
    expect(token.tokenHash).toHaveLength(64);
    expect(service.hashOpaqueToken(token.token)).toBe(token.tokenHash);
  });

  it('creates email verification and password reset tokens with expirations', () => {
    const now = new Date('2026-06-13T00:00:00.000Z');

    expect(service.createEmailVerificationToken(now).expiresAt.getTime()).toBeGreaterThan(
      now.getTime(),
    );
    expect(service.createPasswordResetToken(now).expiresAt.getTime()).toBeGreaterThan(
      now.getTime(),
    );
  });
});
