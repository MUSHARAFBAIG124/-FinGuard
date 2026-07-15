import mongoose, { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import {
  EmailVerificationTokenModel,
  EmailVerificationTokenSchema,
  PasswordResetTokenModel,
  PasswordResetTokenSchema,
  RefreshTokenModel,
  RefreshTokenSchema,
} from './index';
import { USER_MODEL_NAME } from './user.model';

interface SchemaPathOptions {
  readonly options: Record<string, unknown>;
}

const indexNames = (schema: typeof RefreshTokenSchema): readonly string[] =>
  schema.indexes().map(([, options]) => String(options?.name));

const pathOptions = (schema: typeof RefreshTokenSchema, path: string): Record<string, unknown> =>
  (schema.path(path) as unknown as SchemaPathOptions).options;

const userId = () => new Types.ObjectId();

describe('authentication token schemas', () => {
  it('validates refresh tokens and defines rotation/revocation indexes', async () => {
    const token = new RefreshTokenModel({
      userId: userId(),
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 1000),
      deviceInfo: {
        userAgent: 'vitest',
        ipAddress: '127.0.0.1',
      },
    });

    await expect(token.validate()).resolves.toBeUndefined();
    expect(pathOptions(RefreshTokenSchema, 'userId').ref).toBe(USER_MODEL_NAME);
    expect(indexNames(RefreshTokenSchema)).toEqual(
      expect.arrayContaining([
        'ux_refresh_tokens_hash',
        'ix_refresh_tokens_user_revoked',
        'ix_refresh_tokens_expires_at',
      ]),
    );
  });

  it('rejects invalid refresh tokens', () => {
    const error = new RefreshTokenModel({
      userId: userId(),
      tokenHash: 'short',
      expiresAt: new Date(),
      deviceInfo: {
        userAgent: '',
        ipAddress: '127.0.0.1',
      },
    }).validateSync();

    expect(error?.errors.tokenHash).toBeDefined();
    expect(error?.errors['deviceInfo.userAgent']).toBeDefined();
  });

  it('validates email verification token indexes', async () => {
    const token = new EmailVerificationTokenModel({
      userId: userId(),
      tokenHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() + 1000),
    });

    await expect(token.validate()).resolves.toBeUndefined();
    expect(indexNames(EmailVerificationTokenSchema)).toEqual(
      expect.arrayContaining([
        'ux_email_verification_tokens_hash',
        'ix_email_verification_tokens_user_used',
        'ix_email_verification_tokens_expires_at',
      ]),
    );
  });

  it('validates password reset token indexes', async () => {
    const token = new PasswordResetTokenModel({
      userId: userId(),
      tokenHash: 'c'.repeat(64),
      expiresAt: new Date(Date.now() + 1000),
    });

    await expect(token.validate()).resolves.toBeUndefined();
    expect(indexNames(PasswordResetTokenSchema)).toEqual(
      expect.arrayContaining([
        'ux_password_reset_tokens_hash',
        'ix_password_reset_tokens_user_used',
        'ix_password_reset_tokens_expires_at',
      ]),
    );
  });
});
