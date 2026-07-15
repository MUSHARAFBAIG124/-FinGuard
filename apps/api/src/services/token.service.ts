import { createHash, randomBytes } from 'node:crypto';

import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';

import { UserRole } from '@finguard/shared';

import { env } from '../config/env';

const durationSchema = z
  .string()
  .regex(/^(\d+)(s|m|h|d)$/u, 'Duration must use s, m, h, or d suffix');

const durationToMs = (duration: string): number => {
  const [, amountRaw, unit] = durationSchema.parse(duration).match(/^(\d+)(s|m|h|d)$/u) ?? [];
  const amount = Number(amountRaw);
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  } as const;

  return amount * multipliers[unit as keyof typeof multipliers];
};

export interface AccessTokenPayload {
  readonly sub: string;
  readonly role: UserRole;
  readonly sessionVersion: number;
  readonly tokenType: 'access';
}

export interface RefreshTokenPair {
  readonly token: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export class TokenService {
  public createAccessToken(payload: Omit<AccessTokenPayload, 'tokenType'>): string {
    const options: SignOptions = {
      expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
    };

    return jwt.sign(
      {
        ...payload,
        tokenType: 'access',
      },
      env.JWT_ACCESS_SECRET,
      options,
    );
  }

  public verifyAccessToken(token: string): AccessTokenPayload {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const payload = z
      .object({
        sub: z.string().min(1),
        role: z.nativeEnum(UserRole),
        sessionVersion: z.number().int().nonnegative(),
        tokenType: z.literal('access'),
      })
      .parse(decoded);

    return payload;
  }

  public createRefreshToken(now = new Date()): RefreshTokenPair {
    const token = randomBytes(48).toString('base64url');
    return {
      token,
      tokenHash: this.hashOpaqueToken(token),
      expiresAt: new Date(now.getTime() + durationToMs(env.JWT_REFRESH_TTL)),
    };
  }

  public createEmailVerificationToken(now = new Date()): RefreshTokenPair {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      tokenHash: this.hashOpaqueToken(token),
      expiresAt: new Date(now.getTime() + env.EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000),
    };
  }

  public createPasswordResetToken(now = new Date()): RefreshTokenPair {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      tokenHash: this.hashOpaqueToken(token),
      expiresAt: new Date(now.getTime() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
    };
  }

  public hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
