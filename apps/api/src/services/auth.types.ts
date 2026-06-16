import type { UserRole, UserStatus } from '@finguard/shared';

export interface RequestContext {
  readonly requestId: string;
  readonly ipAddress: string;
  readonly userAgent: string;
}

export interface PublicUser {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly isEmailVerified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuthTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: string;
  readonly tokenType: 'Bearer';
}
