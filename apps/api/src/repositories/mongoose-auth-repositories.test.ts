import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { UserRole, UserStatus } from '@finguard/shared';

import { AuditLogModel, type AuditLogDocument } from '../models/audit-log.model';
import {
  EmailVerificationTokenModel,
  type EmailVerificationTokenDocument,
} from '../models/email-verification-token.model';
import {
  PasswordResetTokenModel,
  type PasswordResetTokenDocument,
} from '../models/password-reset-token.model';
import { RefreshTokenModel, type RefreshTokenDocument } from '../models/refresh-token.model';
import { UserModel, type UserDocument } from '../models/user.model';
import {
  MongooseAuditLogRepository,
  MongooseEmailVerificationTokenRepository,
  MongoosePasswordResetTokenRepository,
  MongooseRefreshTokenRepository,
  MongooseUserRepository,
} from './index';

const execResult = <T>(value: T) => ({
  exec: vi.fn<() => Promise<T>>().mockResolvedValue(value as Awaited<T>),
});

const userId = new Types.ObjectId();
const user = {
  _id: userId,
  email: 'customer@example.com',
  passwordHash: 'hashed-password-value-that-is-long-enough',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: UserRole.CUSTOMER,
  status: UserStatus.ACTIVE,
  isEmailVerified: false,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as UserDocument;

describe('Mongoose auth repositories', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates users with normalized email and finds users by id/email', async () => {
    const repository = new MongooseUserRepository();
    const select = vi.fn().mockReturnValue(execResult(user));
    const findOneQuery = {
      ...execResult(user),
      select,
    };

    const createSpy = vi.spyOn(UserModel, 'create').mockResolvedValue(user as never);
    vi.spyOn(UserModel, 'findById').mockReturnValue(execResult(user) as never);
    vi.spyOn(UserModel, 'findOne').mockReturnValue(findOneQuery as never);
    vi.spyOn(UserModel, 'exists').mockReturnValue(execResult({ _id: userId }) as never);

    await expect(
      repository.create({
        email: 'CUSTOMER@example.com',
        passwordHash: 'hashed-password-value-that-is-long-enough',
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: UserRole.CUSTOMER,
      }),
    ).resolves.toBe(user);
    await expect(repository.findById(userId.toHexString())).resolves.toBe(user);
    await expect(repository.findByEmail('CUSTOMER@example.com')).resolves.toBe(user);
    await expect(repository.findByEmailWithPassword('CUSTOMER@example.com')).resolves.toBe(user);
    await expect(repository.existsByEmail('CUSTOMER@example.com')).resolves.toBe(true);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'customer@example.com',
      }),
    );
    expect(select).toHaveBeenCalledWith(
      '+passwordHash +failedLoginAttempts +lockedUntil +lastLoginAt',
    );
  });

  it('updates user verification, password, and login state', async () => {
    const repository = new MongooseUserRepository();
    const updateSpy = vi
      .spyOn(UserModel, 'findByIdAndUpdate')
      .mockReturnValue(execResult(user) as never);

    await expect(repository.markEmailVerified(userId.toHexString())).resolves.toBe(user);
    await expect(repository.updatePassword(userId.toHexString(), 'new-hash')).resolves.toBe(user);
    await expect(
      repository.recordFailedLogin(userId.toHexString(), 3, null),
    ).resolves.toBeUndefined();
    await expect(
      repository.recordFailedLogin(userId.toHexString(), 5, new Date('2026-06-13T00:15:00.000Z')),
    ).resolves.toBeUndefined();
    await expect(
      repository.recordSuccessfulLogin(userId.toHexString(), new Date()),
    ).resolves.toBeUndefined();

    expect(updateSpy).toHaveBeenCalledTimes(5);
    expect(updateSpy).toHaveBeenCalledWith(
      userId.toHexString(),
      expect.objectContaining({
        passwordHash: 'new-hash',
        failedLoginAttempts: 0,
        lockedUntil: null,
      }),
      { new: true },
    );
    expect(updateSpy).toHaveBeenCalledWith(
      userId.toHexString(),
      expect.objectContaining({
        failedLoginAttempts: 5,
        lockedUntil: new Date('2026-06-13T00:15:00.000Z'),
      }),
    );
    expect(updateSpy).toHaveBeenCalledWith(
      userId.toHexString(),
      expect.objectContaining({
        failedLoginAttempts: 0,
        lockedUntil: null,
      }),
    );
  });

  it('creates and revokes refresh tokens', async () => {
    const repository = new MongooseRefreshTokenRepository();
    const deviceInfo = {
      userAgent: 'vitest',
      ipAddress: '127.0.0.1',
    };
    const refreshToken = {
      _id: new Types.ObjectId(),
      userId,
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 1000),
      revokedAt: null,
      deviceInfo,
    } as unknown as RefreshTokenDocument;

    vi.spyOn(RefreshTokenModel, 'create').mockResolvedValue(refreshToken as never);
    const findRefreshTokenSpy = vi
      .spyOn(RefreshTokenModel, 'findOne')
      .mockReturnValue(execResult(refreshToken) as never);
    vi.spyOn(RefreshTokenModel, 'updateOne').mockReturnValue(
      execResult({ modifiedCount: 1 }) as never,
    );
    vi.spyOn(RefreshTokenModel, 'findByIdAndUpdate').mockReturnValue(
      execResult(refreshToken) as never,
    );
    vi.spyOn(RefreshTokenModel, 'updateMany').mockReturnValue(
      execResult({ modifiedCount: 1 }) as never,
    );

    await expect(
      repository.create({
        userId: userId.toHexString(),
        tokenHash: refreshToken.tokenHash,
        expiresAt: refreshToken.expiresAt,
        deviceInfo,
      }),
    ).resolves.toBe(refreshToken);
    await expect(repository.findActiveByHash(refreshToken.tokenHash, new Date())).resolves.toBe(
      refreshToken,
    );
    await expect(
      repository.revokeByHash(refreshToken.tokenHash, new Date()),
    ).resolves.toBeUndefined();
    await expect(
      repository.revokeById(refreshToken._id.toString(), new Date()),
    ).resolves.toBeUndefined();
    await expect(
      repository.revokeAllForUser(userId.toHexString(), new Date()),
    ).resolves.toBeUndefined();
    const refreshQuery = findRefreshTokenSpy.mock.calls[0]?.[0] as {
      tokenHash: string;
      revokedAt: null;
      expiresAt: { $gt: Date };
    };
    expect(refreshQuery.tokenHash).toBe(refreshToken.tokenHash);
    expect(refreshQuery.revokedAt).toBeNull();
    expect(refreshQuery.expiresAt.$gt).toBeInstanceOf(Date);
  });

  it('returns null for expired or revoked refresh tokens when the active query misses', async () => {
    const repository = new MongooseRefreshTokenRepository();

    vi.spyOn(RefreshTokenModel, 'findOne').mockReturnValue(execResult(null) as never);

    await expect(repository.findActiveByHash('a'.repeat(64), new Date())).resolves.toBeNull();
  });

  it('creates and consumes email verification tokens', async () => {
    const repository = new MongooseEmailVerificationTokenRepository();
    const token = {
      _id: new Types.ObjectId(),
      userId,
      tokenHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() + 1000),
      usedAt: null,
    } as unknown as EmailVerificationTokenDocument;

    vi.spyOn(EmailVerificationTokenModel, 'create').mockResolvedValue(token as never);
    const findEmailTokenSpy = vi
      .spyOn(EmailVerificationTokenModel, 'findOne')
      .mockReturnValue(execResult(token) as never);
    vi.spyOn(EmailVerificationTokenModel, 'findByIdAndUpdate').mockReturnValue(
      execResult(token) as never,
    );

    await expect(
      repository.create({
        userId: userId.toHexString(),
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
      }),
    ).resolves.toBe(token);
    await expect(repository.findActiveByHash(token.tokenHash, new Date())).resolves.toBe(token);
    await expect(repository.markUsed(token._id.toString(), new Date())).resolves.toBeUndefined();
    const emailTokenQuery = findEmailTokenSpy.mock.calls[0]?.[0] as {
      tokenHash: string;
      usedAt: null;
      expiresAt: { $gt: Date };
    };
    expect(emailTokenQuery.tokenHash).toBe(token.tokenHash);
    expect(emailTokenQuery.usedAt).toBeNull();
    expect(emailTokenQuery.expiresAt.$gt).toBeInstanceOf(Date);
  });

  it('returns null for expired email verification tokens', async () => {
    const repository = new MongooseEmailVerificationTokenRepository();

    vi.spyOn(EmailVerificationTokenModel, 'findOne').mockReturnValue(execResult(null) as never);

    await expect(repository.findActiveByHash('b'.repeat(64), new Date())).resolves.toBeNull();
  });

  it('creates and consumes password reset tokens', async () => {
    const repository = new MongoosePasswordResetTokenRepository();
    const token = {
      _id: new Types.ObjectId(),
      userId,
      tokenHash: 'c'.repeat(64),
      expiresAt: new Date(Date.now() + 1000),
      usedAt: null,
    } as unknown as PasswordResetTokenDocument;

    vi.spyOn(PasswordResetTokenModel, 'create').mockResolvedValue(token as never);
    const findPasswordResetTokenSpy = vi
      .spyOn(PasswordResetTokenModel, 'findOne')
      .mockReturnValue(execResult(token) as never);
    vi.spyOn(PasswordResetTokenModel, 'findByIdAndUpdate').mockReturnValue(
      execResult(token) as never,
    );

    await expect(
      repository.create({
        userId: userId.toHexString(),
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
      }),
    ).resolves.toBe(token);
    await expect(repository.findActiveByHash(token.tokenHash, new Date())).resolves.toBe(token);
    await expect(repository.markUsed(token._id.toString(), new Date())).resolves.toBeUndefined();
    const passwordResetQuery = findPasswordResetTokenSpy.mock.calls[0]?.[0] as {
      tokenHash: string;
      usedAt: null;
      expiresAt: { $gt: Date };
    };
    expect(passwordResetQuery.tokenHash).toBe(token.tokenHash);
    expect(passwordResetQuery.usedAt).toBeNull();
    expect(passwordResetQuery.expiresAt.$gt).toBeInstanceOf(Date);
  });

  it('returns null for expired password reset tokens', async () => {
    const repository = new MongoosePasswordResetTokenRepository();

    vi.spyOn(PasswordResetTokenModel, 'findOne').mockReturnValue(execResult(null) as never);

    await expect(repository.findActiveByHash('c'.repeat(64), new Date())).resolves.toBeNull();
  });

  it('creates and queries audit logs', async () => {
    const repository = new MongooseAuditLogRepository();
    const auditLog = {
      _id: new Types.ObjectId(),
      userId,
      action: 'AUTH_LOGIN_SUCCEEDED',
      resourceType: 'User',
      resourceId: userId.toHexString(),
      ipAddress: '127.0.0.1',
      requestId: 'request-12345678',
      timestamp: new Date(),
    } as unknown as AuditLogDocument;
    const sort = vi.fn().mockReturnValue(execResult([auditLog]));

    vi.spyOn(AuditLogModel, 'create').mockResolvedValue(auditLog as never);
    vi.spyOn(AuditLogModel, 'find').mockReturnValue({ sort } as never);

    await expect(
      repository.create({
        userId: userId.toHexString(),
        action: auditLog.action,
        resourceType: auditLog.resourceType,
        resourceId: auditLog.resourceId,
        ipAddress: auditLog.ipAddress,
        requestId: auditLog.requestId,
      }),
    ).resolves.toBe(auditLog);
    await expect(repository.findByUserId(userId.toHexString())).resolves.toEqual([auditLog]);
    await expect(repository.findByResource('User', userId.toHexString())).resolves.toEqual([
      auditLog,
    ]);
    expect(sort).toHaveBeenCalledWith({ timestamp: -1 });
  });
});
